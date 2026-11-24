using OZE.Application.Helpers;
using Microsoft.Extensions.Logging;
using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace OZE.Application.Services
{
    public class QueueService : IQueueService
    {
        private readonly IQueueRepository _queueRepository;
        private readonly ILogger<QueueService> _logger;
        private readonly INotificationService? _notifications;

        // Notifications are optional so unit tests can build the service without them
        public QueueService(IQueueRepository queueRepository, ILogger<QueueService> logger, INotificationService? notifications = null)
        {
            _queueRepository = queueRepository;
            _logger = logger;
            _notifications = notifications;
        }

        public async Task<QueueEntry> EnqueueAsync(
            long appointmentId,
            string queueType,
            int? roomId = null,
            int? assignedStaffId = null,
            int priority = 0,
            string? notes = null,
            CancellationToken cancellationToken = default)
        {
            var now = DateTimeOffset.UtcNow;

            var entry = new QueueEntry
            {
                AppointmentId = appointmentId,
                QueueType = queueType,
                RoomId = roomId,
                AssignedStaffId = assignedStaffId,
                Priority = priority,
                Status = QueueConstants.Waiting,
                Notes = notes,
                CreatedAt = now
            };

            // The number is given by the repository, together with saving, so desks checking in together never share one
            var created = await _queueRepository.AddWithNextNumberAsync(entry, DateOnly.FromDateTime(ClinicClock.Today), cancellationToken);
            _logger.LogInformation("Enqueued appointment {AppointmentId} to {QueueType} queue as number {QueueNumber}",
                appointmentId, queueType, created.QueueNumber);

            return created;
        }

        public async Task<QueueEntry?> UpdateStatusAsync(
            long appointmentId,
            string queueType,
            string newStatus,
            CancellationToken cancellationToken = default)
        {
            var entry = await _queueRepository.GetActiveByAppointmentAndTypeAsync(appointmentId, queueType, cancellationToken);
            if (entry == null)
            {
                _logger.LogWarning("No active queue entry found for appointment {AppointmentId} and type {QueueType}", appointmentId, queueType);
                return null;
            }

            var now = DateTimeOffset.UtcNow;
            entry.Status = newStatus;

            if (newStatus == QueueConstants.Called)
            {
                entry.CalledAt = now;
            }
            else if (newStatus == QueueConstants.InProgress)
            {
                entry.StartedAt = now;
            }
            else if (newStatus == QueueConstants.Completed || newStatus == QueueConstants.Skipped || newStatus == QueueConstants.Cancelled)
            {
                entry.CompletedAt = now;
            }

            await _queueRepository.UpdateAsync(entry, cancellationToken);
            _logger.LogInformation("Updated queue entry {QueueId} for appointment {AppointmentId} to {Status}",
                entry.Id, appointmentId, newStatus);

            return entry;
        }

        public async Task<QueueEntry?> UpdatePriorityAsync(
            long appointmentId,
            string queueType,
            int priority,
            CancellationToken cancellationToken = default)
        {
            var entry = await _queueRepository.GetActiveByAppointmentAndTypeAsync(appointmentId, queueType, cancellationToken);
            if (entry == null)
            {
                _logger.LogWarning("No active queue entry found for appointment {AppointmentId} and type {QueueType}", appointmentId, queueType);
                return null;
            }

            entry.Priority = priority;
            await _queueRepository.UpdateAsync(entry, cancellationToken);
            return entry;
        }

        public async Task<List<QueueEntryResponse>> GetQueueEntriesAsync(
            string? queueType = null,
            int? roomId = null,
            bool includePatientDetails = false,
            CancellationToken cancellationToken = default)
        {
            var entries = await _queueRepository.GetActiveEntriesAsync(queueType, roomId, null, cancellationToken);
            entries = await OrderForCallingAsync(entries, queueType, cancellationToken);
            return entries.Select(x => MapToResponse(x, includePatientDetails)).ToList();
        }

        public async Task<QueueEntryResponse?> CallNextAsync(
            string queueType,
            int? roomId = null,
            string? doctorUserId = null,
            CancellationToken cancellationToken = default)
        {
            // Patients of the examination queue belong to the doctor they booked, so a doctor only calls those
            int? assignedStaffId = null;
            var offDuty = false;
            if (doctorUserId != null && queueType == QueueConstants.ExaminationType)
            {
                assignedStaffId = await _queueRepository.GetStaffProfileIdByUserIdAsync(doctorUserId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(assignedStaffId != null, ErrorConstants.AppointmentMessage.DoctorProfileNotFound);
                offDuty = await IsDoctorOffDutyAsync(assignedStaffId!.Value, cancellationToken);
            }

            var entries = await _queueRepository.GetActiveEntriesAsync(queueType, roomId, assignedStaffId, cancellationToken);
            entries = await OrderForCallingAsync(entries, queueType, cancellationToken);
            var atImaging = await GetAppointmentsAtImagingAsync(queueType, cancellationToken);
            // A doctor off duty (shift not started, or ended) is only handed patients already examined (back from the X-ray).
            // A patient still in the imaging room is waiting for the result, not for the doctor, so the next one is called instead
            foreach (var next in entries.Where(x => x.Status == QueueConstants.Waiting
                && !atImaging.Contains(x.AppointmentId)
                && (!offDuty || x.Appointment?.Examination != null)))
            {
                var calledAt = DateTimeOffset.UtcNow;
                // Someone else may have called this patient a moment ago, then the next one in line is ours
                if (!await _queueRepository.TryMarkCalledAsync(next.Id, roomId, calledAt, cancellationToken))
                {
                    continue;
                }

                // Saved by the update above; the copy below only builds the answer and must not be saved again
                _queueRepository.Detach(next);

                next.Status = QueueConstants.Called;
                next.CalledAt = calledAt;
                if (roomId.HasValue)
                {
                    next.RoomId = roomId.Value;
                }

                var called = MapToResponse(next, includePatientDetails: true);
                await NotifyCalledAsync(next, called, cancellationToken);
                return called;
            }

            return null;
        }

        public async Task<QueueEntryResponse> CallAsync(
            long queueEntryId,
            int? roomId = null,
            string? doctorUserId = null,
            CancellationToken cancellationToken = default)
        {
            var entry = await _queueRepository.GetByIdAsync(queueEntryId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(entry != null, ErrorConstants.QueueMessage.EntryNotFound);

            if (doctorUserId != null && entry!.QueueType == QueueConstants.ExaminationType)
            {
                var staffId = await _queueRepository.GetStaffProfileIdByUserIdAsync(doctorUserId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(staffId != null, ErrorConstants.AppointmentMessage.DoctorProfileNotFound);
                ConditionGuard.Ensure<ForbiddenException>(entry.AssignedStaffId == staffId, ErrorConstants.QueueMessage.NotYourPatientToCall);
                ConditionGuard.ThrowIf(entry.Appointment?.Examination == null && await IsDoctorOffDutyAsync(staffId!.Value, cancellationToken),
                    ErrorConstants.QueueMessage.DoctorNotOnShift);
            }

            // Numbers of earlier days are history, they cannot be called any more
            ConditionGuard.Ensure(DateOnly.FromDateTime(entry!.CreatedAt.LocalDateTime) == DateOnly.FromDateTime(ClinicClock.Today), ErrorConstants.QueueMessage.NotInTodayQueue);
            ConditionGuard.Ensure(entry.Status == QueueConstants.Waiting, ErrorConstants.QueueMessage.OnlyWaitingCanBeCalled);

            var calledAt = DateTimeOffset.UtcNow;
            // Checked again in the update itself: someone else may have called this number a moment ago
            ConditionGuard.Ensure(await _queueRepository.TryMarkCalledAsync(entry.Id, roomId, calledAt, cancellationToken),
                ErrorConstants.QueueMessage.OnlyWaitingCanBeCalled);
            // Saved by the update above; the copy below only builds the answer and must not be saved again
            _queueRepository.Detach(entry);

            entry.Status = QueueConstants.Called;
            entry.CalledAt = calledAt;
            if (roomId.HasValue)
            {
                entry.RoomId = roomId.Value;
            }

            var response = MapToResponse(entry, includePatientDetails: true);
            await NotifyCalledAsync(entry, response, cancellationToken);
            return response;
        }

        // The patient learns at once that it is their turn; a failed notification never undoes the call
        private async Task NotifyCalledAsync(QueueEntry entry, QueueEntryResponse called, CancellationToken cancellationToken)
        {
            var patientId = entry.Appointment?.PatientId;
            if (_notifications == null || patientId == null)
            {
                return;
            }

            var number = called.QueueNumber.ToString("D2");
            var message = string.IsNullOrWhiteSpace(called.RoomName)
                ? string.Format(NotificationConstants.Text.YourTurnAtDeskMessage, number)
                : string.Format(NotificationConstants.Text.YourTurnMessage, number, called.RoomName);
            await NotifyPatientOfEntryAsync(entry, patientId.Value, NotificationConstants.Text.YourTurnTitle, message, cancellationToken);
        }

        // Called and not there: the patient keeps the number and is called again later
        private async Task NotifySkippedAsync(QueueEntry entry, CancellationToken cancellationToken)
        {
            var patientId = entry.Appointment?.PatientId;
            if (_notifications == null || patientId == null)
            {
                return;
            }

            var message = string.Format(NotificationConstants.Text.MissedTurnMessage, entry.QueueNumber.ToString("D2"));
            await NotifyPatientOfEntryAsync(entry, patientId.Value, NotificationConstants.Text.MissedTurnTitle, message, cancellationToken);
        }

        // A notification never fails the queue action it reports
        private async Task NotifyPatientOfEntryAsync(QueueEntry entry, int patientId, string title, string message, CancellationToken cancellationToken)
        {
            try
            {
                await _notifications!.NotifyPatientAsync(patientId,
                    new NotificationContent(title, message, NotificationConstants.Reference.Appointment, entry.AppointmentId.ToString()), cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not notify the patient of queue entry {QueueEntryId}", entry.Id);
            }
        }

        // Appointments that still have an open imaging entry today. Only the examination queue needs them
        private async Task<HashSet<long>> GetAppointmentsAtImagingAsync(string queueType, CancellationToken cancellationToken)
        {
            if (queueType != QueueConstants.ExaminationType)
            {
                return new HashSet<long>();
            }

            var imaging = await _queueRepository.GetActiveEntriesAsync(QueueConstants.ImagingType, null, null, cancellationToken);
            return (imaging ?? new List<QueueEntry>()).Select(x => x.AppointmentId).ToHashSet();
        }

        // The examination queue uses the waiting-list order, so "call next" calls the patient shown on top of the
        // waiting list. Other queues keep the order of the repository (missed calls, priority, queue number).
        private async Task<List<QueueEntry>> OrderForCallingAsync(List<QueueEntry> entries, string? queueType, CancellationToken cancellationToken)
        {
            if (queueType != QueueConstants.ExaminationType)
            {
                return entries;
            }

            var value = await _queueRepository.GetConfigValueAsync(ConfigKeyConstants.CheckInLateMinutes, cancellationToken);
            ConditionGuard.Ensure(int.TryParse(value, out var lateMinutes),
                string.Format(ErrorConstants.AppointmentMessage.ConfigMissing, ConfigKeyConstants.CheckInLateMinutes));

            return WaitingOrder.Sort(entries, e => e.Appointment, e => e.SkipCount, lateMinutes);
        }

        public async Task<QueueEntry?> ReassignAsync(
            long appointmentId,
            string queueType,
            int? roomId,
            int? assignedStaffId,
            CancellationToken cancellationToken = default)
        {
            var entry = await _queueRepository.GetActiveByAppointmentAndTypeAsync(appointmentId, queueType, cancellationToken);
            if (entry == null)
            {
                return null;
            }

            entry.RoomId = roomId;
            entry.AssignedStaffId = assignedStaffId;
            // Called by the doctor who left: waiting again, now for the new doctor
            if (entry.Status == QueueConstants.Called)
            {
                entry.Status = QueueConstants.Waiting;
                entry.CalledAt = null;
            }

            await _queueRepository.UpdateAsync(entry, cancellationToken);
            _logger.LogInformation("Queue entry {QueueId} of appointment {AppointmentId} moved to staff {StaffId}, keeping number {QueueNumber}",
                entry.Id, appointmentId, assignedStaffId, entry.QueueNumber);
            return entry;
        }

        public Task<QueueEntry?> GetActiveEntryAsync(long appointmentId, string queueType, CancellationToken cancellationToken = default)
        {
            return _queueRepository.GetActiveByAppointmentAndTypeAsync(appointmentId, queueType, cancellationToken);
        }

        public async Task<bool> IsDoctorOffDutyAsync(int staffId, CancellationToken cancellationToken = default)
        {
            return await _queueRepository.IsOffDutyAsync(staffId, DateOnly.FromDateTime(ClinicClock.Today), cancellationToken);
        }

        public async Task<QueueEntryResponse> SkipAsync(
            long queueEntryId,
            string? doctorUserId = null,
            CancellationToken cancellationToken = default)
        {
            var entry = await _queueRepository.GetByIdAsync(queueEntryId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(entry != null, ErrorConstants.QueueMessage.EntryNotFound);

            if (doctorUserId != null && entry!.QueueType == QueueConstants.ExaminationType)
            {
                var staffId = await _queueRepository.GetStaffProfileIdByUserIdAsync(doctorUserId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(staffId != null, ErrorConstants.AppointmentMessage.DoctorProfileNotFound);
                ConditionGuard.Ensure<ForbiddenException>(entry.AssignedStaffId == staffId, ErrorConstants.QueueMessage.NotYourPatient);
            }

            ConditionGuard.Ensure(entry!.Status == QueueConstants.Called, ErrorConstants.QueueMessage.OnlyCalledCanBeSkipped);

            // Checked again in the update itself: the patient may have walked in at this very moment
            ConditionGuard.Ensure(await _queueRepository.TryMoveBackAsync(entry.Id, cancellationToken),
                ErrorConstants.QueueMessage.OnlyCalledCanBeSkipped);
            // Saved by the update above; the copy below only builds the answer and must not be saved again
            _queueRepository.Detach(entry);

            entry.Status = QueueConstants.Waiting;
            entry.CalledAt = null;
            entry.SkipCount++;
            _logger.LogInformation("Queue entry {QueueId} of appointment {AppointmentId} was called and not there, now skipped {SkipCount} time(s)",
                entry.Id, entry.AppointmentId, entry.SkipCount);

            await NotifySkippedAsync(entry, cancellationToken);
            return MapToResponse(entry, includePatientDetails: true);
        }

        private static QueueEntryResponse MapToResponse(QueueEntry x, bool includePatientDetails) => new()
        {
            Id = x.Id,
            AppointmentId = x.AppointmentId,
            QueueType = x.QueueType,
            RoomId = x.RoomId,
            RoomName = x.Room?.RoomName,
            AssignedStaffId = x.AssignedStaffId,
            StaffName = x.AssignedStaff?.FullName,
            PatientName = includePatientDetails
                ? x.Appointment?.Patient?.FullName ?? string.Empty
                : MaskName(x.Appointment?.Patient?.FullName),
            PatientCode = includePatientDetails ? x.Appointment?.Patient?.PatientCode ?? string.Empty : string.Empty,
            QueueNumber = x.QueueNumber,
            Priority = x.Priority,
            SkipCount = x.SkipCount,
            Status = x.Status,
            CalledAt = x.CalledAt,
            StartedAt = x.StartedAt,
            CompletedAt = x.CompletedAt,
            Notes = includePatientDetails ? x.Notes : null,
            CreatedAt = x.CreatedAt
        };

        // "Nguyen Van An" -> "N*** V*** A***": enough for a patient to recognise the name, not for a stranger to learn it
        private static string MaskName(string? fullName)
        {
            var words = (fullName ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', words.Select(word => word[0] + new string(QueueConstants.MaskCharacter, QueueConstants.MaskedLength)));
        }
    }
}

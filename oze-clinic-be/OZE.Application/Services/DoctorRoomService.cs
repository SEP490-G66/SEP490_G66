using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.Services
{
    public class DoctorRoomService : IDoctorRoomService
    {
        private readonly IQueueRepository _queueRepository;

        public DoctorRoomService(IQueueRepository queueRepository)
        {
            _queueRepository = queueRepository;
        }

        public async Task<DoctorRoomResponse> GetAsync(string doctorUserId, CancellationToken cancellationToken = default)
        {
            var doctorId = await _queueRepository.GetStaffProfileIdByUserIdAsync(doctorUserId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(doctorId.HasValue, ErrorConstants.MedicalRecordMessage.DoctorNotFound);

            // Already in call order (skipped last, then priority, then number)
            var entries = await _queueRepository.GetActiveEntriesAsync(QueueConstants.ExaminationType, null, doctorId, cancellationToken);
            var appointmentIds = entries.Select(x => x.AppointmentId).ToList();

            var atImaging = (await _queueRepository.GetActiveEntriesAsync(QueueConstants.ImagingType, null, null, cancellationToken))
                .Select(x => x.AppointmentId)
                .Where(appointmentIds.Contains)
                .ToHashSet();
            var services = appointmentIds.Count == 0
                ? new List<AppointmentServiceItem>()
                : await _queueRepository.GetServiceItemsAsync(appointmentIds, cancellationToken);
            var done = await _queueRepository.GetCompletedTodayAsync(QueueConstants.ExaminationType, doctorId!.Value, cancellationToken);

            return new DoctorRoomResponse
            {
                Queue = entries.Select(entry => ToPatient(entry, atImaging.Contains(entry.AppointmentId), services)).ToList(),
                Done = done.Select(entry => new DoctorRoomDoneResponse
                {
                    AppointmentId = entry.AppointmentId,
                    QueueNumber = entry.QueueNumber,
                    PatientName = entry.Appointment?.Patient?.FullName?.Trim() ?? string.Empty,
                    CompletedAt = entry.CompletedAt
                }).ToList()
            };
        }

        private static DoctorRoomPatientResponse ToPatient(QueueEntry entry, bool atImaging, List<AppointmentServiceItem> services)
        {
            var appointment = entry.Appointment;
            var patient = appointment?.Patient;
            var examination = appointment?.Examination;
            return new DoctorRoomPatientResponse
            {
                QueueEntryId = entry.Id,
                AppointmentId = entry.AppointmentId,
                AppointmentCode = $"LH{entry.AppointmentId:D6}",
                ExaminationId = examination?.Id,
                ExaminationStatus = examination?.ExaminationStatus,
                QueueNumber = entry.QueueNumber,
                Status = entry.Status,
                Priority = entry.Priority,
                SkipCount = entry.SkipCount,
                AtImaging = atImaging,
                IsReturning = !atImaging && examination?.ExaminationStatus == ExaminationConstants.InProgress && entry.Status != QueueConstants.InProgress,
                CalledAt = entry.CalledAt,
                StartedAt = entry.StartedAt,
                CheckInAt = appointment?.CheckInAt,
                TimeSlotStart = appointment?.TimeSlotStart,
                Reason = examination?.ChiefComplaint ?? appointment?.Notes,
                Note = entry.Notes,
                PatientId = appointment?.PatientId ?? 0,
                PatientCode = patient?.PatientCode ?? string.Empty,
                PatientName = patient?.FullName?.Trim() ?? string.Empty,
                Gender = patient?.Gender,
                DateOfBirth = patient?.DateOfBirth,
                PhoneNumber = patient?.PhoneNumber,
                Address = patient?.Address,
                EmergencyContactPhone = patient?.EmergencyContactPhone,
                Services = services
                    .Where(x => x.AppointmentId == entry.AppointmentId)
                    .Select(x => new DoctorRoomServiceResponse
                    {
                        ServiceId = x.ServiceId,
                        Name = x.Variant == null ? x.Service.ServiceName : $"{x.Service.ServiceName} - {x.Variant.VariantName}"
                    }).ToList()
            };
        }
    }
}

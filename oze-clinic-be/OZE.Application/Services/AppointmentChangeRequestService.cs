using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.Services
{
    // "Xin đổi / huỷ lịch": the patient asks about a visit the clinic arranged (a booked session or follow-up, or a
    // session with no appointment yet). The visit stays as it is; the front desk calls back, changes it with its usual
    // tools and records here what it did.
    public class AppointmentChangeRequestService : IAppointmentChangeRequestService
    {
        private static readonly string[] OpenAppointmentStatuses = { AppointmentConstants.PendingStatus, AppointmentConstants.ConfirmedStatus };
        private static readonly string[] OpenStageStatuses = { TreatmentPlanConstants.StageStatus.Scheduled, TreatmentPlanConstants.StageStatus.InProgress };

        private readonly IAppointmentChangeRequestRepository _repository;
        private readonly IPatientRepository _patientRepository;
        private readonly INotificationService? _notifications;

        public AppointmentChangeRequestService(
            IAppointmentChangeRequestRepository repository,
            IPatientRepository patientRepository,
            INotificationService? notifications = null)
        {
            _repository = repository;
            _patientRepository = patientRepository;
            _notifications = notifications;
        }

        public async Task<AppointmentChangeRequestResponse> CreateAsync(string patientUserId, CreateAppointmentChangeRequest request, CancellationToken cancellationToken = default)
        {
            var patient = await _patientRepository.GetByUserIdAsync(patientUserId ?? string.Empty);
            ConditionGuard.Ensure<NotFoundException>(patient != null, ErrorConstants.AppointmentChangeRequestMessage.PatientNotFound);

            var type = request?.Type?.Trim() ?? string.Empty;
            var reason = request?.Reason?.Trim() ?? string.Empty;
            var note = request?.Note?.Trim() ?? string.Empty;
            var preferred = (request?.PreferredTimes ?? new List<string>()).Select(t => t?.Trim() ?? string.Empty).Where(t => t.Length > 0).ToList();
            ConditionGuard.Ensure(request!.AppointmentId.HasValue != request.TreatmentPlanStageId.HasValue, ErrorConstants.AppointmentChangeRequestMessage.TargetRequired);
            ConditionGuard.Ensure(AppointmentChangeRequestConstants.Types.Contains(type), ErrorConstants.AppointmentChangeRequestMessage.TypeInvalid);
            ConditionGuard.Ensure(reason.Length > 0, ErrorConstants.AppointmentChangeRequestMessage.ReasonRequired);
            ConditionGuard.Ensure(reason.Length <= AppointmentChangeRequestConstants.ReasonMaxLength, ErrorConstants.AppointmentChangeRequestMessage.ReasonInvalid);
            ConditionGuard.Ensure(note.Length <= AppointmentChangeRequestConstants.NoteMaxLength, ErrorConstants.AppointmentChangeRequestMessage.NoteInvalid);
            // Preferred times only matter when asking to move the visit
            if (type == AppointmentChangeRequestConstants.Type.Cancel)
            {
                preferred.Clear();
            }
            ConditionGuard.Ensure(
                preferred.Count <= AppointmentChangeRequestConstants.MaxPreferredTimes && preferred.All(t => t.Length <= AppointmentChangeRequestConstants.PreferredTimeMaxLength),
                ErrorConstants.AppointmentChangeRequestMessage.PreferredTimesInvalid);

            Appointment? appointment = null;
            TreatmentPlanStage? stage = null;
            if (request.AppointmentId is long appointmentId)
            {
                appointment = await _repository.GetAppointmentAsync(appointmentId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(appointment != null && appointment.PatientId == patient!.Id, ErrorConstants.AppointmentChangeRequestMessage.VisitNotFound);
                ConditionGuard.Ensure(OpenAppointmentStatuses.Contains(appointment!.Status), ErrorConstants.AppointmentChangeRequestMessage.VisitNotOpen);
                // Their own booking they change directly
                ConditionGuard.Ensure(!AppointmentOwnershipHelper.IsBookedByPatient(appointment), ErrorConstants.AppointmentChangeRequestMessage.BookedByPatient);
            }
            else
            {
                stage = await _repository.GetStageAsync(request.TreatmentPlanStageId!.Value, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(stage != null && stage.TreatmentPlan.PatientId == patient!.Id, ErrorConstants.AppointmentChangeRequestMessage.VisitNotFound);
                ConditionGuard.Ensure(OpenStageStatuses.Contains(stage!.StageStatus), ErrorConstants.AppointmentChangeRequestMessage.VisitNotOpen);
            }

            // One open request per visit: the front desk calls back once
            ConditionGuard.Ensure(
                !await _repository.HasPendingAsync(appointment?.Id, stage?.Id, cancellationToken),
                ErrorConstants.AppointmentChangeRequestMessage.AlreadyRequested);

            var changeRequest = new AppointmentChangeRequest
            {
                PatientId = patient!.Id,
                AppointmentId = appointment?.Id,
                TreatmentPlanStageId = stage?.Id,
                RequestType = type,
                Reason = reason,
                PreferredTimes = preferred.Count > 0 ? string.Join('\n', preferred) : null,
                Note = note.Length > 0 ? note : null,
                Status = AppointmentChangeRequestConstants.Status.Pending,
                CreatedAt = ClinicClock.UtcNow
            };
            _repository.Add(changeRequest);
            await _repository.SaveChangesAsync(cancellationToken);

            changeRequest.Patient = patient;
            changeRequest.Appointment = appointment;
            changeRequest.TreatmentPlanStage = stage;
            var response = ToResponse(changeRequest);

            await NotifyAsync(n => n.NotifyRolesAsync(new[] { RoleConstants.ReceptionistRole },
                new NotificationContent(NotificationConstants.Text.ChangeRequestedTitle,
                    string.Format(NotificationConstants.Text.ChangeRequestedMessage, patient.FullName?.Trim() ?? string.Empty,
                        type == AppointmentChangeRequestConstants.Type.Reschedule ? "xin đổi" : "xin huỷ", VisitLabel(response), reason),
                    NotificationConstants.Reference.AppointmentChangeRequest, changeRequest.Id.ToString()), cancellationToken: cancellationToken));

            return response;
        }

        public async Task<List<AppointmentChangeRequestResponse>> GetMineAsync(string patientUserId, CancellationToken cancellationToken = default)
        {
            var patient = await _patientRepository.GetByUserIdAsync(patientUserId ?? string.Empty);
            ConditionGuard.Ensure<NotFoundException>(patient != null, ErrorConstants.AppointmentChangeRequestMessage.PatientNotFound);
            return (await _repository.GetByPatientAsync(patient!.Id, cancellationToken)).Select(ToResponse).ToList();
        }

        public async Task<AppointmentChangeRequestResponse> WithdrawAsync(string patientUserId, long id, CancellationToken cancellationToken = default)
        {
            var request = await _repository.GetTrackedAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(
                request != null && !string.IsNullOrEmpty(patientUserId) && request.Patient?.UserId == patientUserId,
                ErrorConstants.AppointmentChangeRequestMessage.RequestNotFound);
            ConditionGuard.Ensure(request!.Status == AppointmentChangeRequestConstants.Status.Pending, ErrorConstants.AppointmentChangeRequestMessage.NotPending);

            request.Status = AppointmentChangeRequestConstants.Status.Withdrawn;
            request.HandledAt = ClinicClock.UtcNow;
            await _repository.SaveChangesAsync(cancellationToken);
            return ToResponse(request);
        }

        public async Task<List<AppointmentChangeRequestResponse>> GetAllAsync(string? status, CancellationToken cancellationToken = default)
        {
            return (await _repository.GetAllAsync(string.IsNullOrWhiteSpace(status) ? null : status.Trim(), cancellationToken)).Select(ToResponse).ToList();
        }

        public async Task<AppointmentChangeRequestResponse> ResolveAsync(string staffUserId, long id, ResolveAppointmentChangeRequest request, CancellationToken cancellationToken = default)
        {
            var outcome = request?.Outcome?.Trim() ?? string.Empty;
            var note = request?.Note?.Trim() ?? string.Empty;
            ConditionGuard.Ensure(AppointmentChangeRequestConstants.Outcomes.Contains(outcome), ErrorConstants.AppointmentChangeRequestMessage.OutcomeInvalid);
            ConditionGuard.Ensure(note.Length <= AppointmentChangeRequestConstants.NoteMaxLength, ErrorConstants.AppointmentChangeRequestMessage.NoteInvalid);

            var changeRequest = await _repository.GetTrackedAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(changeRequest != null, ErrorConstants.AppointmentChangeRequestMessage.RequestNotFound);
            ConditionGuard.Ensure(changeRequest!.Status == AppointmentChangeRequestConstants.Status.Pending, ErrorConstants.AppointmentChangeRequestMessage.NotPending);

            changeRequest.Status = outcome;
            changeRequest.HandledByUserId = staffUserId;
            changeRequest.HandledAt = ClinicClock.UtcNow;
            changeRequest.HandlerNote = note.Length > 0 ? note : null;
            await _repository.SaveChangesAsync(cancellationToken);

            var response = ToResponse(changeRequest);
            var what = outcome switch
            {
                AppointmentChangeRequestConstants.Status.Rescheduled => "đã đổi lịch",
                AppointmentChangeRequestConstants.Status.Cancelled => "đã huỷ lịch",
                _ => "giữ nguyên lịch"
            };
            await NotifyAsync(n => n.NotifyPatientAsync(changeRequest.PatientId,
                new NotificationContent(NotificationConstants.Text.ChangeRequestHandledTitle,
                    string.Format(NotificationConstants.Text.ChangeRequestHandledMessage, VisitLabel(response), note.Length > 0 ? $"{what} ({note})" : what),
                    NotificationConstants.Reference.AppointmentChangeRequest, changeRequest.Id.ToString()), cancellationToken));
            return response;
        }

        private Task NotifyAsync(Func<INotificationService, Task> send) => _notifications == null ? Task.CompletedTask : send(_notifications);

        private static string VisitLabel(AppointmentChangeRequestResponse response)
        {
            var day = response.VisitDate?.ToString("dd/MM") ?? "buổi chưa có ngày";
            return $"{response.VisitTitle} ({day})";
        }

        private static AppointmentChangeRequestResponse ToResponse(AppointmentChangeRequest request)
        {
            var appointment = request.Appointment;
            // A request about a booked session reads its plan through the appointment
            var stage = request.TreatmentPlanStage ?? appointment?.TreatmentPlanStage;
            var plan = stage?.TreatmentPlan;
            var counted = plan?.Stages?.Where(s => s.StageStatus != TreatmentPlanConstants.StageStatus.Cancelled).OrderBy(s => s.StageNumber).ToList();
            var position = counted != null && stage != null ? counted.FindIndex(s => s.Id == stage.Id) : -1;

            string title;
            if (appointment != null)
            {
                var names = appointment.ServiceItems.Select(i => i.Variant?.VariantName ?? i.Service?.ServiceName).Where(n => !string.IsNullOrWhiteSpace(n)).ToList();
                title = stage?.StageName ?? (names.Count > 0 ? string.Join(", ", names) : "Lịch hẹn");
            }
            else
            {
                title = stage?.StageName ?? "Buổi điều trị";
            }

            return new AppointmentChangeRequestResponse
            {
                Id = request.Id,
                Type = request.RequestType,
                Status = request.Status,
                Reason = request.Reason,
                PreferredTimes = string.IsNullOrEmpty(request.PreferredTimes) ? new List<string>() : request.PreferredTimes.Split('\n').ToList(),
                Note = request.Note,
                CreatedAt = request.CreatedAt,
                HandledAt = request.HandledAt,
                HandlerNote = request.HandlerNote,
                PatientId = request.PatientId,
                PatientCode = request.Patient?.PatientCode ?? string.Empty,
                PatientName = request.Patient?.FullName ?? string.Empty,
                PatientPhoneNumber = request.Patient?.PhoneNumber ?? string.Empty,
                AppointmentId = request.AppointmentId,
                AppointmentCode = request.AppointmentId is long id ? $"LH{id:D6}" : null,
                TreatmentPlanStageId = stage?.Id,
                VisitDate = appointment?.AppointmentDate ?? stage?.ScheduledDate,
                TimeSlotStart = appointment?.TimeSlotStart,
                TimeSlotEnd = appointment?.TimeSlotEnd,
                VisitTitle = title,
                DoctorName = appointment?.Doctor?.FullName ?? plan?.CreatedByDoctor?.FullName,
                PlanName = plan?.PlanName,
                StageNumber = position >= 0 ? position + 1 : stage?.StageNumber,
                TotalStages = counted?.Count ?? plan?.TotalStages,
                IsFollowUp = appointment?.ParentAppointmentId != null && stage == null
            };
        }
    }
}

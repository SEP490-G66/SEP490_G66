using OZE.Domain.Entities;

namespace OZE.Application.Interfaces
{
    public interface IAppointmentChangeRequestRepository
    {
        // With patient, doctor, services and plan session
        Task<Appointment?> GetAppointmentAsync(long appointmentId, CancellationToken cancellationToken = default);
        // With its plan and the plan's stages
        Task<TreatmentPlanStage?> GetStageAsync(long stageId, CancellationToken cancellationToken = default);
        Task<bool> HasPendingAsync(long? appointmentId, long? stageId, CancellationToken cancellationToken = default);
        // Tracked, with everything the response needs
        Task<AppointmentChangeRequest?> GetTrackedAsync(long id, CancellationToken cancellationToken = default);
        Task<List<AppointmentChangeRequest>> GetByPatientAsync(int patientId, CancellationToken cancellationToken = default);
        // status null: every request; newest first
        Task<List<AppointmentChangeRequest>> GetAllAsync(string? status, CancellationToken cancellationToken = default);
        void Add(AppointmentChangeRequest request);
        Task SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}

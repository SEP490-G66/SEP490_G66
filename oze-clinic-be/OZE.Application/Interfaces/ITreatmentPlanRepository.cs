using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;

namespace OZE.Application.Interfaces
{
    public interface ITreatmentPlanRepository
    {
        Task<TreatmentPlan?> GetByIdWithStagesAsync(long id, CancellationToken cancellationToken = default);
        Task<TreatmentPlan?> GetTrackedByIdWithStagesAsync(long id, CancellationToken cancellationToken = default);
        Task<Examination?> GetExaminationAsync(long examinationId, CancellationToken cancellationToken = default);
        Task<bool> HasOpenPlanAsync(long examinationId, CancellationToken cancellationToken = default);
        Task AddAsync(TreatmentPlan plan, CancellationToken cancellationToken = default);
        Task<bool> PatientExistsAsync(int patientId, CancellationToken cancellationToken = default);
        Task<List<TreatmentPlanSummaryResponse>> GetByPatientAsync(int patientId, bool includeClosed, CancellationToken cancellationToken = default);
        Task<PagedResult<TreatmentPlanSummaryResponse>> GetAllAsync(TreatmentPlanQueryParameters query, CancellationToken cancellationToken = default);
        Task<TreatmentPlanStage?> GetStageByIdAsync(long stageId, CancellationToken cancellationToken = default);
        Task<TreatmentPlan?> GetByStageIdWithStagesAsync(long stageId, CancellationToken cancellationToken = default);
        Task<bool> IsInvoicedAsync(long treatmentPlanId, CancellationToken cancellationToken = default);
        // The ids among these that belong to active staff with the Doctor role
        Task<List<int>> GetActiveDoctorIdsAsync(IReadOnlyCollection<int> staffIds, CancellationToken cancellationToken = default);
        // The next open session of every plan being carried out that has no active appointment yet
        Task<List<PendingPlanSessionResponse>> GetPendingSessionsAsync(CancellationToken cancellationToken = default);
        // Active doctors; Suggested = has a shift in a room of this type between from and to
        Task<List<PlanDoctorOptionResponse>> GetDoctorOptionsAsync(string roomType, DateOnly from, DateOnly to, CancellationToken cancellationToken = default);
        void Remove(TreatmentPlan plan);
        Task SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}

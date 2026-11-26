using Microsoft.EntityFrameworkCore;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;

namespace OZE.Persistence.Repositories
{
    public class TreatmentPlanRepository : ITreatmentPlanRepository
    {
        private readonly AppIdentityDbContext _context;

        public TreatmentPlanRepository(AppIdentityDbContext context)
        {
            _context = context;
        }

        public Task<List<Appointment>> GetOpenSessionAppointmentsAsync(IReadOnlyCollection<long> stageIds, CancellationToken cancellationToken = default)
        {
            return _context.Appointments
                .Where(x => x.TreatmentPlanStageId != null && stageIds.Contains(x.TreatmentPlanStageId.Value)
                    && (x.Status == AppointmentConstants.PendingStatus || x.Status == AppointmentConstants.ConfirmedStatus))
                .ToListAsync(cancellationToken);
        }

        public async Task<TreatmentPlan?> GetByIdWithStagesAsync(long id, CancellationToken cancellationToken = default)
        {
            return await _context.TreatmentPlans
                .AsNoTracking()
                .Include(x => x.Patient)
                .Include(x => x.CreatedByDoctor)
                .Include(x => x.Stages)
                    .ThenInclude(s => s.Service)
                .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        }

        public async Task<TreatmentPlan?> GetTrackedByIdWithStagesAsync(long id, CancellationToken cancellationToken = default)
        {
            return await _context.TreatmentPlans
                .Include(x => x.Patient)
                .Include(x => x.CreatedByDoctor)
                .Include(x => x.Stages)
                    .ThenInclude(s => s.Service)
                .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        }

        // Tracked: the caller touches the examination so its row version guards against a concurrent "complete"
        public async Task<Examination?> GetExaminationAsync(long examinationId, CancellationToken cancellationToken = default)
        {
            return await _context.Examinations.FirstOrDefaultAsync(x => x.Id == examinationId, cancellationToken);
        }

        public async Task<bool> HasOpenPlanAsync(long examinationId, CancellationToken cancellationToken = default)
        {
            return await _context.TreatmentPlans.AnyAsync(x => x.ExaminationId == examinationId
                && TreatmentPlanConstants.OpenStatuses.Contains(x.Status), cancellationToken);
        }

        public async Task AddAsync(TreatmentPlan plan, CancellationToken cancellationToken = default)
        {
            await _context.TreatmentPlans.AddAsync(plan, cancellationToken);
        }

        public async Task<bool> PatientExistsAsync(int patientId, CancellationToken cancellationToken = default)
        {
            return await _context.Patients.AnyAsync(x => x.Id == patientId, cancellationToken);
        }

        // One query: counts and the next stage are worked out by SQL instead of loading every stage
        public async Task<List<TreatmentPlanSummaryResponse>> GetByPatientAsync(int patientId, bool includeClosed, CancellationToken cancellationToken = default)
        {
            return await _context.TreatmentPlans
                .AsNoTracking()
                .Where(x => x.PatientId == patientId
                    && (includeClosed || TreatmentPlanConstants.OpenStatuses.Contains(x.Status)))
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new TreatmentPlanSummaryResponse
                {
                    Id = x.Id,
                    PlanName = x.PlanName,
                    Status = x.Status,
                    TotalStages = x.Stages.Count(),
                    CompletedStages = x.Stages.Count(s => s.StageStatus == TreatmentPlanConstants.StageStatus.Completed),
                    CancelledStages = x.Stages.Count(s => s.StageStatus == TreatmentPlanConstants.StageStatus.Cancelled),
                    EstimatedTotalCost = x.EstimatedTotalCost,
                    NextStageName = x.Stages
                        .Where(s => s.StageStatus == TreatmentPlanConstants.StageStatus.InProgress
                            || s.StageStatus == TreatmentPlanConstants.StageStatus.Scheduled)
                        .OrderBy(s => s.StageNumber)
                        .Select(s => s.StageName)
                        .FirstOrDefault(),
                    NextStageScheduledDate = x.Stages
                        .Where(s => s.StageStatus == TreatmentPlanConstants.StageStatus.InProgress
                            || s.StageStatus == TreatmentPlanConstants.StageStatus.Scheduled)
                        .OrderBy(s => s.StageNumber)
                        .Select(s => s.ScheduledDate)
                        .FirstOrDefault(),
                    CreatedByDoctorName = x.CreatedByDoctor.FullName,
                    CreatedAt = x.CreatedAt
                })
                .ToListAsync(cancellationToken);
        }

        public async Task<PagedResult<TreatmentPlanSummaryResponse>> GetAllAsync(TreatmentPlanQueryParameters parameters, CancellationToken cancellationToken = default)
        {
            var query = _context.TreatmentPlans.AsNoTracking().AsQueryable();

            if (parameters.PatientId.HasValue)
            {
                query = query.Where(x => x.PatientId == parameters.PatientId.Value);
            }

            if (parameters.DoctorId.HasValue)
            {
                query = query.Where(x => x.CreatedByDoctorId == parameters.DoctorId.Value);
            }

            if (!string.IsNullOrWhiteSpace(parameters.Status))
            {
                var normalizedStatus = parameters.Status.Trim();
                query = query.Where(x => x.Status == normalizedStatus);
            }
            else if (!parameters.IncludeClosed)
            {
                query = query.Where(x => TreatmentPlanConstants.OpenStatuses.Contains(x.Status));
            }

            if (!string.IsNullOrWhiteSpace(parameters.Keyword))
            {
                var keyword = parameters.Keyword.Trim();
                query = query.Where(x => (x.PlanName != null && x.PlanName.Contains(keyword))
                    || x.Patient.FullName.Contains(keyword)
                    || x.Patient.PhoneNumber.Contains(keyword));
            }

            var totalCount = await query.CountAsync(cancellationToken);
            if (totalCount == 0)
            {
                return new PagedResult<TreatmentPlanSummaryResponse>(new List<TreatmentPlanSummaryResponse>(), 0, parameters.PageNumber, parameters.PageSize);
            }

            var items = await query
                .OrderByDescending(x => x.CreatedAt)
                .Skip((parameters.PageNumber - 1) * parameters.PageSize)
                .Take(parameters.PageSize)
                .Select(x => new TreatmentPlanSummaryResponse
                {
                    Id = x.Id,
                    PlanName = x.PlanName,
                    Status = x.Status,
                    TotalStages = x.Stages.Count(),
                    CompletedStages = x.Stages.Count(s => s.StageStatus == TreatmentPlanConstants.StageStatus.Completed),
                    CancelledStages = x.Stages.Count(s => s.StageStatus == TreatmentPlanConstants.StageStatus.Cancelled),
                    EstimatedTotalCost = x.EstimatedTotalCost,
                    NextStageName = x.Stages
                        .Where(s => s.StageStatus == TreatmentPlanConstants.StageStatus.InProgress
                            || s.StageStatus == TreatmentPlanConstants.StageStatus.Scheduled)
                        .OrderBy(s => s.StageNumber)
                        .Select(s => s.StageName)
                        .FirstOrDefault(),
                    NextStageScheduledDate = x.Stages
                        .Where(s => s.StageStatus == TreatmentPlanConstants.StageStatus.InProgress
                            || s.StageStatus == TreatmentPlanConstants.StageStatus.Scheduled)
                        .OrderBy(s => s.StageNumber)
                        .Select(s => s.ScheduledDate)
                        .FirstOrDefault(),
                    CreatedByDoctorName = x.CreatedByDoctor.FullName,
                    CreatedAt = x.CreatedAt
                })
                .ToListAsync(cancellationToken);

            foreach (var item in items)
            {
                var nonCancelled = item.TotalStages - item.CancelledStages;
                item.ProgressPercent = nonCancelled == 0 ? 0m : Math.Round((decimal)item.CompletedStages / nonCancelled * 100m, 2);
            }

            return new PagedResult<TreatmentPlanSummaryResponse>(items, totalCount, parameters.PageNumber, parameters.PageSize);
        }

        public async Task<TreatmentPlanStage?> GetStageByIdAsync(long stageId, CancellationToken cancellationToken = default)
        {
            return await _context.TreatmentPlanStages
                .Include(s => s.Service)
                .Include(s => s.TreatmentPlan)
                .FirstOrDefaultAsync(s => s.Id == stageId, cancellationToken);
        }

        public async Task<TreatmentPlan?> GetByStageIdWithStagesAsync(long stageId, CancellationToken cancellationToken = default)
        {
            var planId = await _context.TreatmentPlanStages
                .Where(s => s.Id == stageId)
                .Select(s => s.TreatmentPlanId)
                .FirstOrDefaultAsync(cancellationToken);

            if (planId == 0) return null;

            return await GetTrackedByIdWithStagesAsync(planId, cancellationToken);
        }

        // Billed on the plan itself or on one of its stages
        public async Task<bool> IsInvoicedAsync(long treatmentPlanId, CancellationToken cancellationToken = default)
        {
            return await _context.Invoices.AnyAsync(x => x.TreatmentPlanId == treatmentPlanId, cancellationToken)
                || await _context.InvoiceItems.AnyAsync(x => x.TreatmentPlanStage != null
                    && x.TreatmentPlanStage.TreatmentPlanId == treatmentPlanId, cancellationToken);
        }

        // Stages go with the plan (cascade)
        public void Remove(TreatmentPlan plan)
        {
            _context.TreatmentPlans.Remove(plan);
        }

        public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}

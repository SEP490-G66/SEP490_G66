using Microsoft.EntityFrameworkCore;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;

namespace OZE.Persistence.Repositories
{
    public class AppointmentChangeRequestRepository : IAppointmentChangeRequestRepository
    {
        private readonly AppIdentityDbContext _context;

        public AppointmentChangeRequestRepository(AppIdentityDbContext context)
        {
            _context = context;
        }

        public Task<Appointment?> GetAppointmentAsync(long appointmentId, CancellationToken cancellationToken = default)
        {
            return _context.Appointments
                .AsNoTracking()
                .Include(x => x.Patient)
                .Include(x => x.Doctor)
                .Include(x => x.ServiceItems).ThenInclude(i => i.Service)
                .Include(x => x.ServiceItems).ThenInclude(i => i.Variant)
                .Include(x => x.TreatmentPlanStage).ThenInclude(s => s!.TreatmentPlan).ThenInclude(p => p.Stages)
                .AsSplitQuery()
                .FirstOrDefaultAsync(x => x.Id == appointmentId, cancellationToken);
        }

        public Task<TreatmentPlanStage?> GetStageAsync(long stageId, CancellationToken cancellationToken = default)
        {
            return _context.TreatmentPlanStages
                .AsNoTrackingWithIdentityResolution()
                .Include(x => x.TreatmentPlan).ThenInclude(p => p.Stages)
                .Include(x => x.TreatmentPlan).ThenInclude(p => p.CreatedByDoctor)
                .FirstOrDefaultAsync(x => x.Id == stageId, cancellationToken);
        }

        public Task<bool> HasPendingAsync(long? appointmentId, long? stageId, CancellationToken cancellationToken = default)
        {
            return _context.AppointmentChangeRequests.AnyAsync(x =>
                x.Status == AppointmentChangeRequestConstants.Status.Pending
                && ((appointmentId != null && x.AppointmentId == appointmentId) || (stageId != null && x.TreatmentPlanStageId == stageId)),
                cancellationToken);
        }

        public Task<AppointmentChangeRequest?> GetTrackedAsync(long id, CancellationToken cancellationToken = default)
        {
            return WithDetails(_context.AppointmentChangeRequests).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        }

        public Task<List<AppointmentChangeRequest>> GetByPatientAsync(int patientId, CancellationToken cancellationToken = default)
        {
            return WithDetails(_context.AppointmentChangeRequests.AsNoTrackingWithIdentityResolution())
                .Where(x => x.PatientId == patientId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);
        }

        public Task<List<AppointmentChangeRequest>> GetAllAsync(string? status, CancellationToken cancellationToken = default)
        {
            var query = WithDetails(_context.AppointmentChangeRequests.AsNoTrackingWithIdentityResolution());
            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(x => x.Status == status);
            }
            return query.OrderByDescending(x => x.CreatedAt).Take(500).ToListAsync(cancellationToken);
        }

        public void Add(AppointmentChangeRequest request) => _context.AppointmentChangeRequests.Add(request);

        public Task SaveChangesAsync(CancellationToken cancellationToken = default) => _context.SaveChangesAsync(cancellationToken);

        private static IQueryable<AppointmentChangeRequest> WithDetails(IQueryable<AppointmentChangeRequest> query) => query
            .Include(x => x.Patient)
            .Include(x => x.Appointment).ThenInclude(a => a!.Doctor)
            .Include(x => x.Appointment).ThenInclude(a => a!.ServiceItems).ThenInclude(i => i.Service)
            .Include(x => x.Appointment).ThenInclude(a => a!.ServiceItems).ThenInclude(i => i.Variant)
            .Include(x => x.Appointment).ThenInclude(a => a!.TreatmentPlanStage).ThenInclude(s => s!.TreatmentPlan).ThenInclude(p => p.Stages)
            .Include(x => x.TreatmentPlanStage).ThenInclude(s => s!.TreatmentPlan).ThenInclude(p => p.CreatedByDoctor)
            // "Buổi n/N" counts the plan's sessions
            .Include(x => x.TreatmentPlanStage).ThenInclude(s => s!.TreatmentPlan).ThenInclude(p => p.Stages)
            .AsSplitQuery();
    }
}

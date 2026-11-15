using Microsoft.EntityFrameworkCore;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;

namespace OZE.Persistence.Repositories
{
    public class ImagingRequestRepository : IImagingRequestRepository
    {
        private readonly AppIdentityDbContext _context;

        public ImagingRequestRepository(AppIdentityDbContext context)
        {
            _context = context;
        }

        public Task<Examination?> GetExaminationAsync(long examinationId, CancellationToken cancellationToken = default)
        {
            return _context.Examinations
                .Include(x => x.Patient)
                .Include(x => x.Appointment)
                .FirstOrDefaultAsync(x => x.Id == examinationId, cancellationToken);
        }

        public Task<List<ImagingRequest>> GetByExaminationIdAsync(long examinationId, CancellationToken cancellationToken = default)
        {
            return _context.ImagingRequests
                .AsNoTracking()
                .Where(x => x.ExaminationId == examinationId)
                .OrderBy(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .ToListAsync(cancellationToken);
        }

        public Task<ImagingRequest?> GetByIdAsync(long id, CancellationToken cancellationToken = default)
        {
            return _context.ImagingRequests
                .AsNoTracking()
                .Include(x => x.Examination)
                .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        }

        public Task<ImagingRequest?> GetTrackedByIdAsync(long id, CancellationToken cancellationToken = default)
        {
            return _context.ImagingRequests
                .Include(x => x.Examination)
                .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        }

        public Task<List<ImagingRequest>> GetQueueAsync(CancellationToken cancellationToken = default)
        {
            return _context.ImagingRequests
                .AsNoTracking()
                .Include(x => x.Examination)
                    .ThenInclude(x => x.Patient)
                .Include(x => x.RequestedByDoctor)
                .Where(x => x.RequestStatus == ImagingRequestConstants.Pending
                    || x.RequestStatus == ImagingRequestConstants.InProgress)
                .OrderBy(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .ToListAsync(cancellationToken);
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return _context.SaveChangesAsync(cancellationToken);
        }

        public async Task AddAsync(ImagingRequest request, CancellationToken cancellationToken = default)
        {
            _context.ImagingRequests.Add(request);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}

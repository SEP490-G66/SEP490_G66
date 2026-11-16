using Microsoft.EntityFrameworkCore;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;
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

        public async Task<PagedResult<ImagingRequest>> GetHistoryAsync(
            ImagingHistoryQuery query,
            long? requestId,
            DateTimeOffset? from,
            DateTimeOffset? toExclusive,
            CancellationToken cancellationToken = default)
        {
            var requests = _context.ImagingRequests
                .AsNoTracking()
                .Where(x => ImagingRequestConstants.HistoryStatuses.Contains(x.RequestStatus));

            if (!string.IsNullOrWhiteSpace(query.Status))
            {
                requests = requests.Where(x => x.RequestStatus == query.Status);
            }
            if (!string.IsNullOrWhiteSpace(query.ImagingType))
            {
                requests = requests.Where(x => x.ImagingType == query.ImagingType);
            }
            if (from.HasValue)
            {
                requests = requests.Where(x => x.CreatedAt >= from.Value);
            }
            if (toExclusive.HasValue)
            {
                requests = requests.Where(x => x.CreatedAt < toExclusive.Value);
            }
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var keyword = query.Keyword.Trim();
                requests = requests.Where(x => x.Examination.Patient.FullName.Contains(keyword)
                    || x.Examination.Patient.PatientCode.Contains(keyword)
                    || (requestId.HasValue && x.Id == requestId.Value));
            }

            var totalCount = await requests.CountAsync(cancellationToken);
            if (totalCount == 0)
            {
                return new PagedResult<ImagingRequest>(new List<ImagingRequest>(), 0, query.Page, query.PageSize);
            }

            var items = await requests
                .Include(x => x.Examination)
                    .ThenInclude(x => x.Patient)
                .Include(x => x.RequestedByDoctor)
                .Include(x => x.Results)
                .AsSplitQuery()
                .OrderByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Id)
                .Skip((query.Page - 1) * query.PageSize)
                .Take(query.PageSize)
                .ToListAsync(cancellationToken);

            return new PagedResult<ImagingRequest>(items, totalCount, query.Page, query.PageSize);
        }

        public Task<ImagingRequest?> GetHistoryDetailAsync(long id, CancellationToken cancellationToken = default)
        {
            return _context.ImagingRequests
                .AsNoTracking()
                .Include(x => x.Examination)
                    .ThenInclude(x => x.Patient)
                .Include(x => x.RequestedByDoctor)
                .Include(x => x.Results)
                    .ThenInclude(x => x.UploadedByTechnician)
                .AsSplitQuery()
                .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
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

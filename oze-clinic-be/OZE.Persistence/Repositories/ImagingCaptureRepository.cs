using Microsoft.EntityFrameworkCore;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;

namespace OZE.Persistence.Repositories
{
    public class ImagingCaptureRepository : IImagingCaptureRepository
    {
        private readonly AppIdentityDbContext _context;

        public ImagingCaptureRepository(AppIdentityDbContext context)
        {
            _context = context;
        }

        public async Task AddAsync(ImagingCapture capture, CancellationToken cancellationToken = default)
        {
            await _context.ImagingCaptures.AddAsync(capture, cancellationToken);
        }

        public Task<ImagingCapture?> GetBySimulationIdAsync(string simulationId, CancellationToken cancellationToken = default)
        {
            return _context.ImagingCaptures.FirstOrDefaultAsync(x => x.SimulationId == simulationId, cancellationToken);
        }

        public Task<bool> HasRunningCaptureAsync(long imagingRequestId, CancellationToken cancellationToken = default)
        {
            return _context.ImagingCaptures.AnyAsync(
                x => x.ImagingRequestId == imagingRequestId && ImagingCaptureConstants.RunningStatuses.Contains(x.Status),
                cancellationToken);
        }

        public Task<List<ImagingCapture>> GetCompletedByRequestIdsAsync(IReadOnlyCollection<long> imagingRequestIds, CancellationToken cancellationToken = default)
        {
            return _context.ImagingCaptures
                .AsNoTracking()
                .Where(x => imagingRequestIds.Contains(x.ImagingRequestId) && x.Status == ImagingCaptureConstants.Completed)
                .OrderByDescending(x => x.CompletedAt)
                .ThenByDescending(x => x.Id)
                .ToListAsync(cancellationToken);
        }

        public Task<List<ImagingResult>> GetResultsAsync(long imagingRequestId, CancellationToken cancellationToken = default)
        {
            return _context.ImagingResults
                .AsNoTracking()
                .Where(x => x.ImagingRequestId == imagingRequestId)
                .OrderBy(x => x.Id)
                .ToListAsync(cancellationToken);
        }

        public void AddResults(IEnumerable<ImagingResult> results)
        {
            _context.ImagingResults.AddRange(results);
        }

        public Task<ImagingResult?> GetResultWithOwnerAsync(long resultId, CancellationToken cancellationToken = default)
        {
            return _context.ImagingResults
                .AsNoTracking()
                .Include(x => x.ImagingRequest)
                    .ThenInclude(x => x.Examination)
                        .ThenInclude(x => x.Patient)
                .FirstOrDefaultAsync(x => x.Id == resultId, cancellationToken);
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return _context.SaveChangesAsync(cancellationToken);
        }
    }
}

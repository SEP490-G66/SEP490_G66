using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;

namespace OZE.Application.Interfaces
{
    public interface IImagingRequestRepository
    {
        Task<Examination?> GetExaminationAsync(long examinationId, CancellationToken cancellationToken = default);
        Task<List<ImagingRequest>> GetByExaminationIdAsync(long examinationId, CancellationToken cancellationToken = default);
        Task<ImagingRequest?> GetByIdAsync(long id, CancellationToken cancellationToken = default);
        Task<ImagingRequest?> GetTrackedByIdAsync(long id, CancellationToken cancellationToken = default);
        Task<List<ImagingRequest>> GetQueueAsync(CancellationToken cancellationToken = default);
        // Done or cancelled requests for the history page, newest first. toExclusive is the start of the day after the last day.
        Task<PagedResult<ImagingRequest>> GetHistoryAsync(ImagingHistoryQuery query, long? requestId, DateTimeOffset? from, DateTimeOffset? toExclusive, CancellationToken cancellationToken = default);
        // A request with its patient, doctor and pictures (with the technician who took them)
        Task<ImagingRequest?> GetHistoryDetailAsync(long id, CancellationToken cancellationToken = default);
        // Done or cancelled requests a doctor ordered, with patient, pictures and technician, newest first
        Task<List<ImagingRequest>> GetForReviewAsync(int doctorId, int limit, CancellationToken cancellationToken = default);
        // A request with its examination and pictures, tracked for changes
        Task<ImagingRequest?> GetTrackedWithResultsAsync(long id, CancellationToken cancellationToken = default);
        Task SaveChangesAsync(CancellationToken cancellationToken = default);
        Task AddAsync(ImagingRequest request, CancellationToken cancellationToken = default);
    }
}

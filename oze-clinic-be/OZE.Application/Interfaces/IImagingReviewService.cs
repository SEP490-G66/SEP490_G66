using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    // The doctor reads the pictures of the imaging requests they ordered: approve them or send them back for a retake
    public interface IImagingReviewService
    {
        Task<List<ImagingReviewResponse>> GetReviewsAsync(string doctorUserId, string? status, CancellationToken cancellationToken = default);
        Task<ImagingReviewResponse> ApproveAsync(string doctorUserId, long imagingRequestId, CancellationToken cancellationToken = default);
        Task<ImagingReviewResponse> RetakeAsync(string doctorUserId, long imagingRequestId, RetakeImagingRequest request, CancellationToken cancellationToken = default);
    }
}

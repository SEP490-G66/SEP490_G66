using OZE.Domain.Entities;

namespace OZE.Application.Interfaces
{
    public interface IImagingCaptureRepository
    {
        Task AddAsync(ImagingCapture capture, CancellationToken cancellationToken = default);
        // Tracked, so the capture can be updated
        Task<ImagingCapture?> GetBySimulationIdAsync(string simulationId, CancellationToken cancellationToken = default);
        Task<bool> HasRunningCaptureAsync(long imagingRequestId, CancellationToken cancellationToken = default);
        Task<List<ImagingResult>> GetResultsAsync(long imagingRequestId, CancellationToken cancellationToken = default);
        void AddResults(IEnumerable<ImagingResult> results);
        // With its request, examination and patient, to check who may see it
        Task<ImagingResult?> GetResultWithOwnerAsync(long resultId, CancellationToken cancellationToken = default);
        Task SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}

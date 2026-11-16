using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    // Calls the X-ray simulator (oze-xray-simulator /api/v1). Never throws for a failed call: the result says what went wrong.
    public interface ISimulatorClient
    {
        Task<SimulatorResult<SimulatorCapture>> StartCaptureAsync(SimulatorCaptureRequest request, CancellationToken cancellationToken = default);
        Task<SimulatorResult<SimulatorCapture>> GetCaptureAsync(string simulationId, CancellationToken cancellationToken = default);
        Task<SimulatorResult<bool>> CancelCaptureAsync(string simulationId, CancellationToken cancellationToken = default);
        Task<SimulatorResult<byte[]>> DownloadImageAsync(string simulationId, string imageId, CancellationToken cancellationToken = default);
        Task<SimulatorResult<List<SimulatorDevice>>> GetDevicesAsync(CancellationToken cancellationToken = default);
    }

    // Keeps the pictures of imaging results; paths are relative to the storage root
    public interface IImagingFileStore
    {
        Task SaveAsync(string relativePath, byte[] data, CancellationToken cancellationToken = default);
        // Null when the file is not there
        Task<byte[]?> ReadAsync(string relativePath, CancellationToken cancellationToken = default);
    }
}

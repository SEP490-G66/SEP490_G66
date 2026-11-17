using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    // Capturing imaging requests on the X-ray simulator and serving the stored pictures
    public interface IImagingCaptureService
    {
        Task<ImagingCaptureResponse> StartAsync(string technicianUserId, long imagingRequestId, StartImagingCaptureRequest request, CancellationToken cancellationToken = default);
        // Asks the simulator for the latest state while the capture runs; stores the pictures once it is done
        Task<ImagingCaptureResponse> GetAsync(long imagingRequestId, string simulationId, CancellationToken cancellationToken = default);
        Task<ImagingCaptureResponse> CancelAsync(long imagingRequestId, string simulationId, CancellationToken cancellationToken = default);
        Task<List<ImagingDeviceResponse>> GetDevicesAsync(CancellationToken cancellationToken = default);
        // False asks the simulator to send the event again (for example when a picture could not be downloaded)
        Task<bool> HandleWebhookAsync(ImagingSimulatorWebhookPayload payload, CancellationToken cancellationToken = default);
        Task<ImagingFileResult> GetResultFileAsync(string userId, bool isPatient, long resultId, CancellationToken cancellationToken = default);
        // Pictures the technician uploads by hand (.png, .jpg, .jpeg, .dcm) for an open request
        Task<List<ImagingCaptureImageResponse>> UploadAsync(string technicianUserId, long imagingRequestId, List<UploadedImagingFile> files, string? note = null, CancellationToken cancellationToken = default);
    }
}

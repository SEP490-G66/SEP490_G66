using System.Globalization;
using System.Net;
using System.Text;
using Microsoft.Extensions.Logging;
using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.Services
{
    // The technician starts a capture here; the simulator takes the pictures and tells the backend through its webhook
    // (or the technician screen asks for the state). Once the capture is completed, every picture is downloaded,
    // saved on disk (IImagingFileStore) and recorded as an ImagingResult, and the imaging request is completed.
    public class ImagingCaptureService : IImagingCaptureService
    {
        // The webhook and the technician screen may both see "completed" at once: only one stores the pictures
        private static readonly SemaphoreSlim StoreLock = new(1, 1);

        private readonly IImagingCaptureRepository _captureRepository;
        private readonly IImagingRequestRepository _imagingRequestRepository;
        private readonly IStaffRepository _staffRepository;
        private readonly IImagingRequestService _imagingRequestService;
        private readonly ISimulatorClient _simulator;
        private readonly IImagingFileStore _fileStore;
        private readonly ILogger<ImagingCaptureService> _logger;

        public ImagingCaptureService(
            IImagingCaptureRepository captureRepository,
            IImagingRequestRepository imagingRequestRepository,
            IStaffRepository staffRepository,
            IImagingRequestService imagingRequestService,
            ISimulatorClient simulator,
            IImagingFileStore fileStore,
            ILogger<ImagingCaptureService> logger)
        {
            _captureRepository = captureRepository;
            _imagingRequestRepository = imagingRequestRepository;
            _staffRepository = staffRepository;
            _imagingRequestService = imagingRequestService;
            _simulator = simulator;
            _fileStore = fileStore;
            _logger = logger;
        }

        public async Task<ImagingCaptureResponse> StartAsync(
            string technicianUserId,
            long imagingRequestId,
            StartImagingCaptureRequest request,
            CancellationToken cancellationToken = default)
        {
            var deviceId = request.DeviceId?.Trim() ?? string.Empty;
            ConditionGuard.Ensure(deviceId.Length > 0, ErrorConstants.ImagingCaptureMessage.DeviceRequired);
            ConditionGuard.Ensure(
                request.ImageCount >= ImagingCaptureConstants.MinImageCount && request.ImageCount <= ImagingCaptureConstants.MaxImageCount,
                ErrorConstants.ImagingCaptureMessage.ImageCountInvalid);

            var technician = await _staffRepository.GetByUserIdAsync(technicianUserId);
            ConditionGuard.Ensure<NotFoundException>(technician != null, ErrorConstants.ImagingCaptureMessage.TechnicianNotFound);

            var imagingRequest = await _imagingRequestRepository.GetTrackedByIdAsync(imagingRequestId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(imagingRequest != null, ErrorConstants.ImagingRequestMessage.RequestNotFound);
            ConditionGuard.Ensure(
                ImagingRequestConstants.QueueStatuses.Contains(imagingRequest!.RequestStatus),
                string.Format(ErrorConstants.ImagingCaptureMessage.RequestNotOpen, imagingRequest.RequestStatus));
            ConditionGuard.Ensure(
                ImagingCaptureConstants.ModalityByImagingType.TryGetValue(imagingRequest.ImagingType, out var modality),
                string.Format(ErrorConstants.ImagingCaptureMessage.ImagingTypeNotSupported, imagingRequest.ImagingType));
            ConditionGuard.Ensure(
                !await _captureRepository.HasRunningCaptureAsync(imagingRequestId, cancellationToken),
                ErrorConstants.ImagingCaptureMessage.CaptureAlreadyRunning);

            var started = await _simulator.StartCaptureAsync(new SimulatorCaptureRequest
            {
                CaptureRequestId = Guid.NewGuid().ToString("N"),
                OrderReference = ImagingCaptureConstants.OrderReferencePrefix + imagingRequestId,
                DeviceId = deviceId,
                Modality = modality!,
                BodyRegion = imagingRequest.TargetArea,
                ImageCount = request.ImageCount,
                Exposure = new SimulatorExposure { KV = request.Kv, MA = request.Ma, Seconds = request.ExposureSeconds }
            }, cancellationToken);
            EnsureSimulatorAnswered(started);

            var now = DateTimeOffset.UtcNow;
            var capture = new ImagingCapture
            {
                ImagingRequestId = imagingRequestId,
                TechnicianId = technician!.Id,
                SimulationId = started.Data!.SimulationId,
                DeviceId = deviceId,
                Modality = modality!,
                BodyRegion = imagingRequest.TargetArea,
                ImageCount = request.ImageCount,
                Kv = request.Kv,
                Ma = request.Ma,
                ExposureSeconds = request.ExposureSeconds,
                Status = NormalizeStatus(started.Data.Status, ImagingCaptureConstants.Accepted),
                Progress = Math.Clamp(started.Data.Progress, 0, 100),
                CreatedAt = now
            };
            await _captureRepository.AddAsync(capture, cancellationToken);

            if (imagingRequest.RequestStatus == ImagingRequestConstants.Pending)
            {
                imagingRequest.RequestStatus = ImagingRequestConstants.InProgress;
                imagingRequest.UpdatedAt = now;
            }

            // The capture and the request share one database context, so one save stores both
            await _captureRepository.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Capture {SimulationId} started for imaging request {RequestId} on {DeviceId}", capture.SimulationId, imagingRequestId, deviceId);
            return ToResponse(capture, new List<ImagingResult>());
        }

        public async Task<List<ImagingCaptureImageResponse>> UploadAsync(
            string technicianUserId,
            long imagingRequestId,
            List<UploadedImagingFile> files,
            string? note,
            CancellationToken cancellationToken = default)
        {
            ConditionGuard.Ensure(files != null && files.Count > 0, ErrorConstants.ImagingCaptureMessage.UploadFilesRequired);
            ConditionGuard.Ensure(files!.Count <= ImagingRequestConstants.UploadMaxFiles, ErrorConstants.ImagingCaptureMessage.UploadTooManyFiles);
            foreach (var file in files)
            {
                var extension = Path.GetExtension(file.FileName ?? string.Empty).ToLowerInvariant();
                ConditionGuard.Ensure(
                    ImagingRequestConstants.UploadExtensions.Contains(extension),
                    string.Format(ErrorConstants.ImagingCaptureMessage.UploadFileTypeInvalid, file.FileName));
                ConditionGuard.Ensure(file.Data.Length > 0, string.Format(ErrorConstants.ImagingCaptureMessage.UploadFileEmpty, file.FileName));
                ConditionGuard.Ensure(
                    file.Data.LongLength <= ImagingRequestConstants.UploadMaxFileBytes,
                    string.Format(ErrorConstants.ImagingCaptureMessage.UploadFileTooLarge, file.FileName));
            }

            var technician = await _staffRepository.GetByUserIdAsync(technicianUserId);
            ConditionGuard.Ensure<NotFoundException>(technician != null, ErrorConstants.ImagingCaptureMessage.TechnicianNotFound);

            var imagingRequest = await _imagingRequestRepository.GetTrackedByIdAsync(imagingRequestId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(imagingRequest != null, ErrorConstants.ImagingRequestMessage.RequestNotFound);
            ConditionGuard.Ensure(
                ImagingRequestConstants.QueueStatuses.Contains(imagingRequest!.RequestStatus),
                string.Format(ErrorConstants.ImagingCaptureMessage.RequestNotOpen, imagingRequest.RequestStatus));

            var now = DateTimeOffset.UtcNow;
            var results = new List<ImagingResult>();
            foreach (var file in files)
            {
                var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
                // The stored name never comes from the user: only the checked extension is kept
                var relativePath = string.Join('/',
                    now.ToString("yyyy", CultureInfo.InvariantCulture),
                    now.ToString("MM", CultureInfo.InvariantCulture),
                    ImagingCaptureConstants.OrderReferencePrefix + imagingRequestId,
                    $"{ImagingRequestConstants.UploadFolderPrefix}_{Guid.NewGuid():N}{extension}");
                await _fileStore.SaveAsync(relativePath, file.Data, cancellationToken);

                var originalName = Path.GetFileName(file.FileName);
                results.Add(new ImagingResult
                {
                    ImagingRequestId = imagingRequestId,
                    UploadedByTechnicianId = technician!.Id,
                    FilePath = relativePath,
                    FileName = originalName.Length > ImagingCaptureConstants.FileNameMaxLength
                        ? originalName[..ImagingCaptureConstants.FileNameMaxLength]
                        : originalName,
                    FileSize = file.Data.LongLength,
                    MimeType = MimeTypeOf(extension),
                    TechnicianNotes = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
                    ReviewStatus = MedicalRecordConstants.PendingImageStatus,
                    CreatedAt = now
                });
            }
            _captureRepository.AddResults(results);

            if (imagingRequest.RequestStatus == ImagingRequestConstants.Pending)
            {
                imagingRequest.RequestStatus = ImagingRequestConstants.InProgress;
                imagingRequest.UpdatedAt = now;
            }
            await _captureRepository.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("{Count} images uploaded by hand for imaging request {RequestId}", results.Count, imagingRequestId);
            return results.Select(r => new ImagingCaptureImageResponse
            {
                ResultId = r.Id,
                FileName = r.FileName,
                FileUrl = $"/api/imaging-results/{r.Id}/file"
            }).ToList();
        }

        private static string MimeTypeOf(string extension) => extension switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            _ => ImagingRequestConstants.DicomMimeType
        };

        public async Task<ImagingCaptureResponse> GetAsync(long imagingRequestId, string simulationId, CancellationToken cancellationToken = default)
        {
            var capture = await GetCaptureAsync(imagingRequestId, simulationId, cancellationToken);

            if (IsRunning(capture))
            {
                var latest = await _simulator.GetCaptureAsync(capture.SimulationId, cancellationToken);
                if (latest.Success)
                {
                    await ApplyAsync(capture, latest.Data!.Status, latest.Data.Progress, latest.Data.FailureCode, latest.Data.FailureMessage,
                        latest.Data.Images, cancellationToken);
                }
                else if (latest.StatusCode == (int)HttpStatusCode.NotFound)
                {
                    // The simulator forgets captures after a restart or an hour; a lost one would block new captures
                    await ApplyAsync(capture, ImagingCaptureConstants.Failed, capture.Progress, "SESSION_LOST",
                        "The device no longer knows this capture.", null, cancellationToken);
                }
            }

            return ToResponse(capture, await GetCaptureResultsAsync(capture, cancellationToken));
        }

        public async Task<ImagingCaptureResponse> CancelAsync(long imagingRequestId, string simulationId, CancellationToken cancellationToken = default)
        {
            var capture = await GetCaptureAsync(imagingRequestId, simulationId, cancellationToken);
            ConditionGuard.Ensure(IsRunning(capture), string.Format(ErrorConstants.ImagingCaptureMessage.CaptureNotRunning, capture.Status));

            var cancelled = await _simulator.CancelCaptureAsync(capture.SimulationId, cancellationToken);
            EnsureSimulatorAnswered(cancelled);

            await ApplyAsync(capture, ImagingCaptureConstants.Cancelled, capture.Progress, null, null, null, cancellationToken);
            return ToResponse(capture, new List<ImagingResult>());
        }

        public async Task<List<ImagingDeviceResponse>> GetDevicesAsync(CancellationToken cancellationToken = default)
        {
            var devices = await _simulator.GetDevicesAsync(cancellationToken);
            EnsureSimulatorAnswered(devices);

            return devices.Data!.Select(d => new ImagingDeviceResponse
            {
                Id = d.Id,
                Name = d.Name,
                SerialNumber = d.SerialNumber,
                SupportedModalities = d.SupportedModalities,
                State = d.State
            }).ToList();
        }

        public async Task<bool> HandleWebhookAsync(ImagingSimulatorWebhookPayload payload, CancellationToken cancellationToken = default)
        {
            var capture = string.IsNullOrWhiteSpace(payload.SimulationId)
                ? null
                : await _captureRepository.GetBySimulationIdAsync(payload.SimulationId, cancellationToken);

            // A capture not started from OZE (for example from the simulator's own page): only complete the request, as before
            if (capture == null)
            {
                return await _imagingRequestService.ProcessSimulatorWebhookAsync(payload, cancellationToken);
            }

            // The same event may come twice; a finished capture stays as it is
            if (!IsRunning(capture))
            {
                return true;
            }

            var status = payload.EventType switch
            {
                ImagingCaptureConstants.EventCompleted => ImagingCaptureConstants.Completed,
                ImagingCaptureConstants.EventFailed => ImagingCaptureConstants.Failed,
                ImagingCaptureConstants.EventCancelled => ImagingCaptureConstants.Cancelled,
                _ => NormalizeStatus(payload.State, capture.Status)
            };

            // The webhook lists the pictures without their body region; the capture itself has everything
            List<SimulatorImage>? images = null;
            if (status == ImagingCaptureConstants.Completed)
            {
                var latest = await _simulator.GetCaptureAsync(capture.SimulationId, cancellationToken);
                images = latest.Success
                    ? latest.Data!.Images
                    : payload.Images.Select(i => new SimulatorImage
                    {
                        ImageId = i.ImageId,
                        FileName = i.FileName,
                        ContentType = i.ContentType,
                        SizeBytes = i.SizeBytes,
                        SequenceNumber = i.SequenceNumber
                    }).ToList();
            }

            return await ApplyAsync(capture, status, payload.Progress, payload.FailureCode, payload.FailureMessage, images, cancellationToken);
        }

        public async Task<ImagingFileResult> GetResultFileAsync(string userId, bool isPatient, long resultId, CancellationToken cancellationToken = default)
        {
            var result = await _captureRepository.GetResultWithOwnerAsync(resultId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(result != null, ErrorConstants.ImagingCaptureMessage.ResultNotFound);

            // A patient only sees the films of their own examinations
            if (isPatient)
            {
                ConditionGuard.Ensure<ForbiddenException>(
                    result!.ImagingRequest?.Examination?.Patient?.UserId == userId,
                    ErrorConstants.ImagingCaptureMessage.CannotViewResult);
            }

            // Sample films live in the frontend, not on the server
            ConditionGuard.Ensure<NotFoundException>(
                !result!.FilePath.StartsWith(ImagingCaptureConstants.MockFilePrefix, StringComparison.OrdinalIgnoreCase),
                ErrorConstants.ImagingCaptureMessage.ResultNotFound);

            var data = await _fileStore.ReadAsync(result.FilePath, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(data != null, ErrorConstants.ImagingCaptureMessage.ResultNotFound);

            return new ImagingFileResult
            {
                Data = data!,
                ContentType = string.IsNullOrWhiteSpace(result.MimeType) ? ServiceImageContentType.Png : result.MimeType!,
                FileName = result.FileName
            };
        }

        // Records the new state. A completed capture first gets its pictures stored; false when that could not be done.
        private async Task<bool> ApplyAsync(
            ImagingCapture capture,
            string status,
            int progress,
            string? failureCode,
            string? failureMessage,
            List<SimulatorImage>? images,
            CancellationToken cancellationToken)
        {
            var now = DateTimeOffset.UtcNow;

            if (status == ImagingCaptureConstants.Completed)
            {
                return await StorePicturesAndCompleteAsync(capture, images ?? new List<SimulatorImage>(), cancellationToken);
            }

            capture.Status = status;
            capture.Progress = Math.Clamp(progress, 0, 100);
            capture.UpdatedAt = now;
            if (status is ImagingCaptureConstants.Failed or ImagingCaptureConstants.Cancelled)
            {
                capture.FailureCode = Truncate(failureCode, ImagingCaptureConstants.FailureCodeMaxLength);
                capture.FailureMessage = Truncate(failureMessage, ImagingCaptureConstants.FailureMessageMaxLength);
                capture.CompletedAt = now;
            }

            await _captureRepository.SaveChangesAsync(cancellationToken);
            return true;
        }

        private async Task<bool> StorePicturesAndCompleteAsync(ImagingCapture capture, List<SimulatorImage> images, CancellationToken cancellationToken)
        {
            await StoreLock.WaitAsync(cancellationToken);
            try
            {
                // Read from the database again: another call may have stored them while this one waited
                var stored = await GetCaptureResultsAsync(capture, cancellationToken);
                var storedPaths = stored.Select(r => r.FilePath).ToHashSet(StringComparer.OrdinalIgnoreCase);

                var now = DateTimeOffset.UtcNow;
                var results = new List<ImagingResult>();
                foreach (var image in images.OrderBy(i => i.SequenceNumber))
                {
                    var relativePath = BuildFilePath(capture, image, now);
                    if (storedPaths.Contains(relativePath))
                    {
                        continue;
                    }

                    var download = await _simulator.DownloadImageAsync(capture.SimulationId, image.ImageId, cancellationToken);
                    if (!download.Success)
                    {
                        _logger.LogWarning("Picture {ImageId} of capture {SimulationId} could not be downloaded: {Error}",
                            image.ImageId, capture.SimulationId, download.Error);
                        return false;
                    }

                    await _fileStore.SaveAsync(relativePath, download.Data!, cancellationToken);
                    results.Add(new ImagingResult
                    {
                        ImagingRequestId = capture.ImagingRequestId,
                        UploadedByTechnicianId = capture.TechnicianId,
                        FilePath = relativePath,
                        FileName = string.IsNullOrWhiteSpace(image.FileName) ? Path.GetFileName(relativePath) : image.FileName,
                        FileSize = download.Data!.LongLength,
                        MimeType = string.IsNullOrWhiteSpace(image.ContentType) ? ServiceImageContentType.Png : image.ContentType,
                        TechnicianNotes = BuildTechnicianNotes(capture, image, images.Count),
                        ReviewStatus = MedicalRecordConstants.PendingImageStatus,
                        CreatedAt = now
                    });
                }

                _captureRepository.AddResults(results);
                capture.Status = ImagingCaptureConstants.Completed;
                capture.Progress = 100;
                capture.UpdatedAt = now;
                capture.CompletedAt = now;
                await _captureRepository.SaveChangesAsync(cancellationToken);

                _logger.LogInformation("Capture {SimulationId} completed, {Count} picture(s) stored", capture.SimulationId, results.Count);
            }
            finally
            {
                StoreLock.Release();
            }

            // Complete the imaging request and send the patient back to the doctor (unless already done)
            var imagingRequest = await _imagingRequestRepository.GetTrackedByIdAsync(capture.ImagingRequestId, cancellationToken);
            if (imagingRequest != null && ImagingRequestConstants.QueueStatuses.Contains(imagingRequest.RequestStatus))
            {
                await _imagingRequestService.CompleteAsync(capture.ImagingRequestId, null, null, cancellationToken);
            }

            return true;
        }

        private async Task<ImagingCapture> GetCaptureAsync(long imagingRequestId, string simulationId, CancellationToken cancellationToken)
        {
            var capture = await _captureRepository.GetBySimulationIdAsync(simulationId?.Trim() ?? string.Empty, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(
                capture != null && capture.ImagingRequestId == imagingRequestId,
                ErrorConstants.ImagingCaptureMessage.CaptureNotFound);
            return capture!;
        }

        // The pictures of one capture: their file names start with its simulation id
        private async Task<List<ImagingResult>> GetCaptureResultsAsync(ImagingCapture capture, CancellationToken cancellationToken)
        {
            var marker = "/" + SafeName(capture.SimulationId) + "_";
            var results = await _captureRepository.GetResultsAsync(capture.ImagingRequestId, cancellationToken);
            return results.Where(r => r.FilePath.Contains(marker, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        private static bool IsRunning(ImagingCapture capture) => ImagingCaptureConstants.RunningStatuses.Contains(capture.Status);

        private static string NormalizeStatus(string? status, string fallback)
        {
            var upper = status?.Trim().ToUpperInvariant();
            return upper != null && ImagingCaptureConstants.AllStatuses.Contains(upper) ? upper : fallback;
        }

        // 2026/11/IR-12/SIM-AB12_1.png
        private static string BuildFilePath(ImagingCapture capture, SimulatorImage image, DateTimeOffset now)
        {
            var extension = image.ContentType?.ToLowerInvariant() switch
            {
                "image/jpeg" => ".jpg",
                "image/webp" => ".webp",
                _ => ".png"
            };
            var created = capture.CreatedAt == default ? now : capture.CreatedAt;
            return string.Create(CultureInfo.InvariantCulture,
                $"{created:yyyy}/{created:MM}/{ImagingCaptureConstants.OrderReferencePrefix}{capture.ImagingRequestId}/{SafeName(capture.SimulationId)}_{image.SequenceNumber}{extension}");
        }

        // XR-PANO-01 · PANORAMIC · Tooth 36 · 1/2 · 70 kV · 10 mA · 12 s
        private static string BuildTechnicianNotes(ImagingCapture capture, SimulatorImage image, int total)
        {
            var parts = new List<string> { capture.DeviceId, capture.Modality };
            var region = image.BodyRegion ?? capture.BodyRegion;
            if (!string.IsNullOrWhiteSpace(region))
            {
                parts.Add(region);
            }

            parts.Add($"{image.SequenceNumber}/{total}");
            if (capture.Kv.HasValue) parts.Add(string.Create(CultureInfo.InvariantCulture, $"{capture.Kv} kV"));
            if (capture.Ma.HasValue) parts.Add(string.Create(CultureInfo.InvariantCulture, $"{capture.Ma} mA"));
            if (capture.ExposureSeconds.HasValue) parts.Add(string.Create(CultureInfo.InvariantCulture, $"{capture.ExposureSeconds} s"));
            return string.Join(" · ", parts);
        }

        // Keeps letters, digits, '-' and '_' so a simulation id is safe in a file name
        private static string SafeName(string value)
        {
            var builder = new StringBuilder(value.Length);
            foreach (var c in value)
            {
                builder.Append(char.IsLetterOrDigit(c) || c is '-' or '_' ? c : '_');
            }

            return builder.ToString();
        }

        private static string? Truncate(string? value, int maxLength) =>
            value == null || value.Length <= maxLength ? value : value[..maxLength];

        // 503 when the simulator is down or refuses our key, 400 with its reason when it refuses the capture itself
        private static void EnsureSimulatorAnswered<T>(SimulatorResult<T> result)
        {
            if (result.Success)
            {
                return;
            }

            if (result.Unreachable)
            {
                throw new AppException(ErrorConstants.ImagingCaptureMessage.SimulatorUnavailable, HttpStatusCode.ServiceUnavailable);
            }

            throw new BadRequestException(string.Format(ErrorConstants.ImagingCaptureMessage.SimulatorRejected, result.Error));
        }

        private static ImagingCaptureResponse ToResponse(ImagingCapture capture, List<ImagingResult> results) => new()
        {
            SimulationId = capture.SimulationId,
            ImagingRequestId = capture.ImagingRequestId,
            DeviceId = capture.DeviceId,
            Modality = capture.Modality,
            Status = capture.Status,
            Progress = capture.Progress,
            ImageCount = capture.ImageCount,
            FailureMessage = capture.FailureMessage,
            StartedAt = capture.CreatedAt,
            CompletedAt = capture.CompletedAt,
            Images = results.Select(r => new ImagingCaptureImageResponse
            {
                ResultId = r.Id,
                FileName = r.FileName,
                FileUrl = $"/api/imaging-results/{r.Id}/file"
            }).ToList()
        };

        private static class ServiceImageContentType
        {
            public const string Png = "image/png";
        }
    }
}

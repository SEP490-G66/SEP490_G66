using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    // Capturing an imaging request on the X-ray simulator, and reading the stored pictures
    [ApiController]
    [Authorize]
    [Route("api")]
    public class ImagingCapturesController : BaseApiController
    {
        private readonly IImagingCaptureService _captureService;

        public ImagingCapturesController(IImagingCaptureService captureService)
        {
            _captureService = captureService;
        }

        /// <summary>
        /// Lists the X-ray devices of the simulator with their state.
        /// </summary>
        [Authorize(Roles = RoleConstants.DentalImagingTechnicianRole)]
        [HttpGet("imaging-devices")]
        public async Task<ActionResult<ApiResponse<List<ImagingDeviceResponse>>>> GetDevicesAsync(CancellationToken cancellationToken)
        {
            var devices = await _captureService.GetDevicesAsync(cancellationToken);
            return Ok(ApiResponse<List<ImagingDeviceResponse>>.SuccessResult(devices));
        }

        /// <summary>
        /// Sends the capture order of an imaging request to an X-ray device. The pictures come back by themselves when it is done.
        /// </summary>
        [Authorize(Roles = RoleConstants.DentalImagingTechnicianRole)]
        [HttpPost("imaging-requests/{id:long}/captures")]
        public async Task<ActionResult<ApiResponse<ImagingCaptureResponse>>> StartAsync(
            long id,
            [FromBody] StartImagingCaptureRequest request,
            CancellationToken cancellationToken)
        {
            var capture = await _captureService.StartAsync(CurrentUserId ?? string.Empty, id, request, cancellationToken);
            return Ok(ApiResponse<ImagingCaptureResponse>.SuccessResult(capture, ErrorConstants.ImagingCaptureMessage.CaptureStarted));
        }

        /// <summary>
        /// State and progress of a capture; the stored pictures once it is completed. The technician screen asks every 1-2 seconds.
        /// </summary>
        [Authorize(Roles = RoleConstants.DentalImagingTechnicianRole)]
        [HttpGet("imaging-requests/{id:long}/captures/{simulationId}")]
        public async Task<ActionResult<ApiResponse<ImagingCaptureResponse>>> GetAsync(
            long id,
            string simulationId,
            CancellationToken cancellationToken)
        {
            var capture = await _captureService.GetAsync(id, simulationId, cancellationToken);
            return Ok(ApiResponse<ImagingCaptureResponse>.SuccessResult(capture));
        }

        /// <summary>
        /// Stops a capture that is still running.
        /// </summary>
        [Authorize(Roles = RoleConstants.DentalImagingTechnicianRole)]
        [HttpPost("imaging-requests/{id:long}/captures/{simulationId}/cancel")]
        public async Task<ActionResult<ApiResponse<ImagingCaptureResponse>>> CancelAsync(
            long id,
            string simulationId,
            CancellationToken cancellationToken)
        {
            var capture = await _captureService.CancelAsync(id, simulationId, cancellationToken);
            return Ok(ApiResponse<ImagingCaptureResponse>.SuccessResult(capture, ErrorConstants.ImagingCaptureMessage.CaptureCancelled));
        }

        /// <summary>
        /// Pictures uploaded by hand when the device cannot take them (form fields "files": .png, .jpg, .jpeg, .dcm, up to 10, 20 MB each; "note": optional technician note).
        /// </summary>
        [Authorize(Roles = RoleConstants.DentalImagingTechnicianRole)]
        [HttpPost("imaging-requests/{id:long}/results")]
        [RequestSizeLimit(ImagingRequestConstants.UploadMaxFiles * ImagingRequestConstants.UploadMaxFileBytes)]
        [RequestFormLimits(MultipartBodyLengthLimit = ImagingRequestConstants.UploadMaxFiles * ImagingRequestConstants.UploadMaxFileBytes)]
        public async Task<ActionResult<ApiResponse<List<ImagingCaptureImageResponse>>>> UploadAsync(
            long id,
            [FromForm] List<IFormFile> files,
            [FromForm] string? note,
            CancellationToken cancellationToken)
        {
            var uploaded = new List<UploadedImagingFile>();
            foreach (var file in files ?? new List<IFormFile>())
            {
                using var stream = new MemoryStream();
                await file.CopyToAsync(stream, cancellationToken);
                uploaded.Add(new UploadedImagingFile(file.FileName, file.ContentType, stream.ToArray()));
            }

            var images = await _captureService.UploadAsync(CurrentUserId ?? string.Empty, id, uploaded, note, cancellationToken);
            return Ok(ApiResponse<List<ImagingCaptureImageResponse>>.SuccessResult(images, ErrorConstants.ImagingCaptureMessage.ImagesUploaded));
        }

        /// <summary>
        /// Returns a stored picture. Staff who work with films may read any; a patient only the films of their own examinations.
        /// </summary>
        [Authorize(Roles = RoleConstants.DoctorRole + "," + RoleConstants.DentalImagingTechnicianRole + ","
            + RoleConstants.ClinicManagerRole + "," + RoleConstants.PatientRole)]
        [HttpGet("imaging-results/{id:long}/file")]
        public async Task<IActionResult> GetResultFileAsync(long id, CancellationToken cancellationToken)
        {
            var isStaff = IsInRole(RoleConstants.DoctorRole) || IsInRole(RoleConstants.DentalImagingTechnicianRole) || IsInRole(RoleConstants.ClinicManagerRole);
            var file = await _captureService.GetResultFileAsync(CurrentUserId ?? string.Empty, !isStaff, id, cancellationToken);

            // Medical images: the browser may keep them, shared caches may not
            Response.Headers.CacheControl = "private, max-age=86400";
            return File(file.Data, file.ContentType, file.FileName);
        }
    }
}

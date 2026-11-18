using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    // "Yêu cầu bổ sung tài liệu": the doctor asks for a document during an examination, the patient uploads it
    [ApiController]
    [Authorize]
    [Route("api")]
    public class DocumentRequestsController : BaseApiController
    {
        private readonly IDocumentRequestService _documentRequestService;

        public DocumentRequestsController(IDocumentRequestService documentRequestService)
        {
            _documentRequestService = documentRequestService;
        }

        /// <summary>
        /// Asks the patient of an in-progress examination for a document (free-text name, optional note). The patient is notified.
        /// </summary>
        [Authorize(Roles = RoleConstants.DoctorRole)]
        [HttpPost("examinations/{examinationId:long}/document-requests")]
        public async Task<ActionResult<ApiResponse<DocumentRequestResponse>>> CreateAsync(
            long examinationId,
            [FromBody] CreateDocumentRequest request,
            CancellationToken cancellationToken)
        {
            var created = await _documentRequestService.CreateAsync(CurrentUserId ?? string.Empty, examinationId, request, cancellationToken);
            return Ok(ApiResponse<DocumentRequestResponse>.SuccessResult(created, ErrorConstants.DocumentRequestMessage.RequestCreated));
        }

        /// <summary>
        /// Every document request of the examination's patient (this visit and earlier ones, any doctor), newest first, with the uploaded files.
        /// </summary>
        [Authorize(Roles = RoleConstants.DoctorRole)]
        [HttpGet("examinations/{examinationId:long}/document-requests")]
        public async Task<ActionResult<ApiResponse<List<DocumentRequestResponse>>>> GetByExaminationAsync(
            long examinationId,
            CancellationToken cancellationToken)
        {
            var requests = await _documentRequestService.GetByExaminationAsync(CurrentUserId ?? string.Empty, examinationId, cancellationToken);
            return Ok(ApiResponse<List<DocumentRequestResponse>>.SuccessResult(requests));
        }

        /// <summary>
        /// Cancels a document request the patient has not answered yet.
        /// </summary>
        [Authorize(Roles = RoleConstants.DoctorRole)]
        [HttpPost("document-requests/{id:long}/cancel")]
        public async Task<ActionResult<ApiResponse<DocumentRequestResponse>>> CancelAsync(
            long id,
            CancellationToken cancellationToken)
        {
            var cancelled = await _documentRequestService.CancelAsync(CurrentUserId ?? string.Empty, id, cancellationToken);
            return Ok(ApiResponse<DocumentRequestResponse>.SuccessResult(cancelled, ErrorConstants.DocumentRequestMessage.RequestCancelled));
        }

        /// <summary>
        /// Document requests of the signed-in patient, newest first; examinationId keeps only those of one examination.
        /// </summary>
        [Authorize(Roles = RoleConstants.PatientRole)]
        [HttpGet("document-requests/my")]
        public async Task<ActionResult<ApiResponse<List<DocumentRequestResponse>>>> GetMineAsync(
            [FromQuery] long? examinationId,
            CancellationToken cancellationToken)
        {
            var requests = await _documentRequestService.GetMineAsync(CurrentUserId ?? string.Empty, examinationId, cancellationToken);
            return Ok(ApiResponse<List<DocumentRequestResponse>>.SuccessResult(requests));
        }

        /// <summary>
        /// The patient uploads files for their request (form field "files": .pdf, .jpg, .jpeg, .png, up to 10, 20 MB each).
        /// </summary>
        [Authorize(Roles = RoleConstants.PatientRole)]
        [HttpPost("document-requests/{id:long}/files")]
        [RequestSizeLimit(DocumentRequestConstants.UploadMaxRequestBytes)]
        [RequestFormLimits(MultipartBodyLengthLimit = DocumentRequestConstants.UploadMaxRequestBytes)]
        public async Task<ActionResult<ApiResponse<DocumentRequestResponse>>> SubmitAsync(
            long id,
            [FromForm] List<IFormFile> files,
            CancellationToken cancellationToken)
        {
            var uploaded = new List<UploadedImagingFile>();
            foreach (var file in files ?? new List<IFormFile>())
            {
                using var stream = new MemoryStream();
                await file.CopyToAsync(stream, cancellationToken);
                uploaded.Add(new UploadedImagingFile(file.FileName, file.ContentType, stream.ToArray()));
            }

            var submitted = await _documentRequestService.SubmitAsync(CurrentUserId ?? string.Empty, id, uploaded, cancellationToken);
            return Ok(ApiResponse<DocumentRequestResponse>.SuccessResult(submitted, ErrorConstants.DocumentRequestMessage.FilesUploaded));
        }

        /// <summary>
        /// Returns a stored patient document. Doctors and the clinic manager may open any; a patient only their own.
        /// </summary>
        [Authorize(Roles = RoleConstants.DoctorRole + "," + RoleConstants.ClinicManagerRole + "," + RoleConstants.PatientRole)]
        [HttpGet("patient-documents/{id:long}/file")]
        public async Task<IActionResult> GetFileAsync(long id, CancellationToken cancellationToken)
        {
            var isStaff = IsInRole(RoleConstants.DoctorRole) || IsInRole(RoleConstants.ClinicManagerRole);
            var file = await _documentRequestService.GetFileAsync(CurrentUserId ?? string.Empty, !isStaff, id, cancellationToken);

            // Medical documents: the browser may keep them, shared caches may not
            Response.Headers.CacheControl = "private, max-age=86400";
            return File(file.Data, file.ContentType, file.FileName);
        }
    }
}

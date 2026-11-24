using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    // "Cung cấp tài liệu": documents the patient uploads from elsewhere without a doctor's request.
    // Files are opened through GET api/patient-documents/{id}/file (DocumentRequestsController).
    [ApiController]
    [Authorize]
    [Route("api")]
    public class ProvidedDocumentsController : BaseApiController
    {
        private readonly IProvidedDocumentService _providedDocumentService;

        public ProvidedDocumentsController(IProvidedDocumentService providedDocumentService)
        {
            _providedDocumentService = providedDocumentService;
        }

        /// <summary>
        /// The patient uploads a document: name, performed date (optional), provider address and the files
        /// (form field "files": .pdf, .jpg, .jpeg, .png, .dcm, up to 5, 20 MB each).
        /// </summary>
        [Authorize(Roles = RoleConstants.PatientRole)]
        [HttpPost("provided-documents")]
        [RequestSizeLimit(ProvidedDocumentConstants.UploadMaxRequestBytes)]
        [RequestFormLimits(MultipartBodyLengthLimit = ProvidedDocumentConstants.UploadMaxRequestBytes)]
        public async Task<ActionResult<ApiResponse<ProvidedDocumentResponse>>> CreateAsync(
            [FromForm] CreateProvidedDocumentRequest request,
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

            var created = await _providedDocumentService.CreateAsync(CurrentUserId ?? string.Empty, request, uploaded, cancellationToken);
            return Ok(ApiResponse<ProvidedDocumentResponse>.SuccessResult(created, ErrorConstants.ProvidedDocumentMessage.Uploaded));
        }

        /// <summary>
        /// Documents the signed-in patient uploaded, newest first.
        /// </summary>
        [Authorize(Roles = RoleConstants.PatientRole)]
        [HttpGet("provided-documents/my")]
        public async Task<ActionResult<ApiResponse<List<ProvidedDocumentResponse>>>> GetMineAsync(CancellationToken cancellationToken)
        {
            var documents = await _providedDocumentService.GetMineAsync(CurrentUserId ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<List<ProvidedDocumentResponse>>.SuccessResult(documents));
        }

        /// <summary>
        /// Deletes one of the patient's own uploads with its files.
        /// </summary>
        [Authorize(Roles = RoleConstants.PatientRole)]
        [HttpDelete("provided-documents/{id:guid}")]
        public async Task<ActionResult<ApiResponse>> DeleteAsync(Guid id, CancellationToken cancellationToken)
        {
            await _providedDocumentService.DeleteAsync(CurrentUserId ?? string.Empty, id, cancellationToken);
            return Ok(ApiResponse.SuccessResult(ErrorConstants.ProvidedDocumentMessage.Deleted));
        }

        /// <summary>
        /// For the doctor of the examination: every document the patient provided, newest first.
        /// </summary>
        [Authorize(Roles = RoleConstants.DoctorRole)]
        [HttpGet("examinations/{examinationId:long}/provided-documents")]
        public async Task<ActionResult<ApiResponse<List<ProvidedDocumentResponse>>>> GetByExaminationAsync(
            long examinationId,
            CancellationToken cancellationToken)
        {
            var documents = await _providedDocumentService.GetByExaminationAsync(CurrentUserId ?? string.Empty, examinationId, cancellationToken);
            return Ok(ApiResponse<List<ProvidedDocumentResponse>>.SuccessResult(documents));
        }
    }
}

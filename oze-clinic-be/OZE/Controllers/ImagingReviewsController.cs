using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    // The doctor reads the pictures of the imaging requests they ordered ("Duyệt kết quả chụp")
    [ApiController]
    [Authorize(Roles = RoleConstants.DoctorRole)]
    [Route("api")]
    public class ImagingReviewsController : BaseApiController
    {
        private readonly IImagingReviewService _reviewService;

        public ImagingReviewsController(IImagingReviewService reviewService)
        {
            _reviewService = reviewService;
        }

        /// <summary>
        /// Done or cancelled imaging requests of the signed-in doctor, newest first. status: Pending, Approved, Retake or Cancelled.
        /// </summary>
        [HttpGet("imaging-reviews")]
        public async Task<ActionResult<ApiResponse<List<ImagingReviewResponse>>>> GetReviewsAsync(
            [FromQuery] string? status,
            CancellationToken cancellationToken)
        {
            var reviews = await _reviewService.GetReviewsAsync(CurrentUserId ?? string.Empty, status, cancellationToken);
            return Ok(ApiResponse<List<ImagingReviewResponse>>.SuccessResult(reviews));
        }

        /// <summary>
        /// The doctor keeps the pictures of a completed request.
        /// </summary>
        [HttpPost("imaging-requests/{id:long}/approve")]
        public async Task<ActionResult<ApiResponse<ImagingReviewResponse>>> ApproveAsync(long id, CancellationToken cancellationToken)
        {
            var review = await _reviewService.ApproveAsync(CurrentUserId ?? string.Empty, id, cancellationToken);
            return Ok(ApiResponse<ImagingReviewResponse>.SuccessResult(review, ErrorConstants.ImagingCaptureMessage.ReviewApproved));
        }

        /// <summary>
        /// The pictures are rejected and the same request goes back to the technician (the examination must still be open).
        /// </summary>
        [HttpPost("imaging-requests/{id:long}/retake")]
        public async Task<ActionResult<ApiResponse<ImagingReviewResponse>>> RetakeAsync(
            long id,
            [FromBody] RetakeImagingRequest request,
            CancellationToken cancellationToken)
        {
            var review = await _reviewService.RetakeAsync(CurrentUserId ?? string.Empty, id, request, cancellationToken);
            return Ok(ApiResponse<ImagingReviewResponse>.SuccessResult(review, ErrorConstants.ImagingCaptureMessage.RetakeRequested));
        }
    }
}

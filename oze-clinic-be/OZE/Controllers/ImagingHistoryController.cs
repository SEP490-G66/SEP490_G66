using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    // The technician's "Lịch sử chụp chiếu": imaging requests that were done or cancelled, and their detail
    [ApiController]
    [Authorize(Roles = RoleConstants.DentalImagingTechnicianRole)]
    [Route("api/imaging-history")]
    public class ImagingHistoryController : BaseApiController
    {
        private readonly IImagingHistoryService _historyService;

        public ImagingHistoryController(IImagingHistoryService historyService)
        {
            _historyService = historyService;
        }

        /// <summary>
        /// Done or cancelled imaging requests, newest first. Filters: keyword (patient name, patient code or IR-number),
        /// imagingType, status (Completed / Cancelled), from / to (yyyy-MM-dd, clinic days), page, pageSize.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<ApiResponse<PagedResult<ImagingHistoryItemResponse>>>> GetHistoryAsync(
            [FromQuery] ImagingHistoryQuery query,
            CancellationToken cancellationToken)
        {
            var history = await _historyService.GetHistoryAsync(query, cancellationToken);
            return Ok(ApiResponse<PagedResult<ImagingHistoryItemResponse>>.SuccessResult(history));
        }

        /// <summary>
        /// One imaging request: the patient, the doctor's order, the device and the pictures (or why it was cancelled).
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<ActionResult<ApiResponse<ImagingHistoryDetailResponse>>> GetDetailAsync(long id, CancellationToken cancellationToken)
        {
            var detail = await _historyService.GetDetailAsync(id, cancellationToken);
            return Ok(ApiResponse<ImagingHistoryDetailResponse>.SuccessResult(detail));
        }
    }
}

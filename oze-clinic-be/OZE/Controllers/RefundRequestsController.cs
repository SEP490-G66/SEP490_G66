using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    [ApiController]
    [Route("api/refund-requests")]
    public class RefundRequestsController : BaseApiController
    {
        private readonly IRefundService _refundService;

        public RefundRequestsController(IRefundService refundService)
        {
            _refundService = refundService;
        }

        [HttpGet]
        [Authorize(Roles = RoleConstants.ClinicManagerRole + "," + RoleConstants.ReceptionistRole)]
        public async Task<ActionResult<ApiResponse<IReadOnlyList<RefundRequestResponse>>>> GetListAsync(
            [FromQuery] RefundRequestQueryParameters parameters,
            CancellationToken cancellationToken)
        {
            var items = await _refundService.GetListAsync(parameters, cancellationToken);
            return Ok(ApiResponse<IReadOnlyList<RefundRequestResponse>>.SuccessResult(items));
        }

        /// <summary>
        /// Manager enters WorkDoneAmount. No auto WorkDone — must be set before approve.
        /// </summary>
        [HttpPut("{id:long}/work-done")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<RefundRequestResponse>>> SetWorkDoneAsync(
            [FromRoute] long id,
            [FromBody] SetWorkDoneAmountRequest request,
            CancellationToken cancellationToken)
        {
            var refund = await _refundService.SetWorkDoneAsync(id, CurrentUserId ?? string.Empty, request, cancellationToken);
            return Ok(ApiResponse<RefundRequestResponse>.SuccessResult(refund, ErrorConstants.RefundMessage.WorkDoneUpdated));
        }

        /// <summary>
        /// Approves refund: Amount = Paid − WorkDone; Open-P3 updates invoice PaidAmount/status.
        /// </summary>
        [HttpPost("{id:long}/approve")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<RefundRequestResponse>>> ApproveAsync(
            [FromRoute] long id,
            CancellationToken cancellationToken)
        {
            var refund = await _refundService.ApproveAsync(id, CurrentUserId ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<RefundRequestResponse>.SuccessResult(refund, ErrorConstants.RefundMessage.RequestApproved));
        }

        /// <summary>
        /// Receptionist pays an approved refund back to the patient: Approved → Processed.
        /// </summary>
        [HttpPost("{id:long}/payout")]
        [Authorize(Roles = RoleConstants.ReceptionistRole)]
        public async Task<ActionResult<ApiResponse<RefundRequestResponse>>> PayoutAsync(
            [FromRoute] long id,
            CancellationToken cancellationToken)
        {
            var refund = await _refundService.PayoutAsync(id, CurrentUserId ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<RefundRequestResponse>.SuccessResult(refund, ErrorConstants.RefundMessage.RequestPaidOut));
        }

        [HttpGet("my")]
        [Authorize(Roles = RoleConstants.PatientRole)]
        public async Task<ActionResult<ApiResponse<IReadOnlyList<MyRefundRequestResponse>>>> GetMyAsync(CancellationToken cancellationToken)
        {
            var items = await _refundService.GetMyAsync(CurrentUserId ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<IReadOnlyList<MyRefundRequestResponse>>.SuccessResult(items));
        }

        [HttpGet("my/refundable-invoices")]
        [Authorize(Roles = RoleConstants.PatientRole)]
        public async Task<ActionResult<ApiResponse<IReadOnlyList<MyRefundableInvoiceResponse>>>> GetMyRefundableInvoicesAsync(CancellationToken cancellationToken)
        {
            var items = await _refundService.GetMyRefundableInvoicesAsync(CurrentUserId ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<IReadOnlyList<MyRefundableInvoiceResponse>>.SuccessResult(items));
        }

        [HttpPost("my")]
        [Authorize(Roles = RoleConstants.PatientRole)]
        public async Task<ActionResult<ApiResponse<MyRefundRequestResponse>>> CreateMyAsync(
            [FromBody] CreateMyRefundRequest request,
            CancellationToken cancellationToken)
        {
            var refund = await _refundService.RequestMyAsync(CurrentUserId ?? string.Empty, request, cancellationToken);
            return Ok(ApiResponse<MyRefundRequestResponse>.SuccessResult(refund, ErrorConstants.RefundMessage.RequestCreated));
        }

        [HttpPost("{id:long}/reject")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<RefundRequestResponse>>> RejectAsync(
            [FromRoute] long id,
            [FromBody] RejectRefundRequest request,
            CancellationToken cancellationToken)
        {
            var refund = await _refundService.RejectAsync(id, CurrentUserId ?? string.Empty, request, cancellationToken);
            return Ok(ApiResponse<RefundRequestResponse>.SuccessResult(refund, ErrorConstants.RefundMessage.RequestRejected));
        }
    }
}

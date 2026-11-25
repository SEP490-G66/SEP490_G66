using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    // Cashier pages of the receptionist: Thanh toán, Đặt cọc dịch vụ, Thanh toán theo đợt, Ghi nhận thu tiền.
    // Writes need an open cash session (api/cash-sessions).
    [Authorize(Roles = RoleConstants.ReceptionistRole)]
    [Route("api/cashier")]
    public class CashierController : BaseApiController
    {
        private readonly ICashierService _cashierService;

        public CashierController(ICashierService cashierService)
        {
            _cashierService = cashierService;
        }

        /// <summary>
        /// Danh sách Thanh toán: one row per patient with debt and status. SearchKeyword looks at every day;
        /// otherwise Date keeps patients with a session or visit that day (no Date = every day).
        /// </summary>
        [HttpGet("patients")]
        public async Task<ActionResult<ApiResponse<PagedResult<CashierPatientSummaryResponse>>>> GetPatientsAsync(
            [FromQuery] CashierPatientQuery query,
            CancellationToken cancellationToken)
        {
            var result = await _cashierService.GetPatientsAsync(query, cancellationToken);
            return Ok(ApiResponse<PagedResult<CashierPatientSummaryResponse>>.SuccessResult(result));
        }

        /// <summary>
        /// Công nợ: one row per patient still owing confirmed money, oldest debt first.
        /// Age = lt7 | 7to30 | gt30 (days since OwedSince); TotalOwed sums every matching row.
        /// </summary>
        [HttpGet("debts")]
        public async Task<ActionResult<ApiResponse<CashierDebtListResponse>>> GetDebtsAsync(
            [FromQuery] CashierDebtQuery query,
            CancellationToken cancellationToken)
        {
            var result = await _cashierService.GetDebtsAsync(query, cancellationToken);
            return Ok(ApiResponse<CashierDebtListResponse>.SuccessResult(result));
        }

        /// <summary>
        /// Patients for the pickers of Đặt cọc / Theo đợt / Ghi nhận thu tiền.
        /// </summary>
        [HttpGet("patients/options")]
        public async Task<ActionResult<ApiResponse<List<CashierPatientOption>>>> GetPatientOptionsAsync(
            [FromQuery] string? search,
            CancellationToken cancellationToken)
        {
            var result = await _cashierService.GetPatientOptionsAsync(search, cancellationToken);
            return Ok(ApiResponse<List<CashierPatientOption>>.SuccessResult(result));
        }

        /// <summary>
        /// Plans, walk-in visits and receipts of one patient, in the shape of the FE mock data.
        /// </summary>
        [HttpGet("patients/{patientId:int}/account")]
        public async Task<ActionResult<ApiResponse<CashierAccountResponse>>> GetAccountAsync(
            [FromRoute] int patientId,
            CancellationToken cancellationToken)
        {
            var result = await _cashierService.GetAccountAsync(patientId, cancellationToken);
            return Ok(ApiResponse<CashierAccountResponse>.SuccessResult(result));
        }

        [HttpGet("config")]
        public async Task<ActionResult<ApiResponse<CashierConfigResponse>>> GetConfigAsync(CancellationToken cancellationToken)
        {
            var result = await _cashierService.GetConfigAsync(cancellationToken);
            return Ok(ApiResponse<CashierConfigResponse>.SuccessResult(result));
        }

        /// <summary>
        /// Phương án thanh toán of a plan (FULL | PERIODS | DEPOSIT), chosen once. Creates the plan invoice.
        /// </summary>
        [HttpPost("plans/{planId:long}/payment-option")]
        public async Task<ActionResult<ApiResponse<CashierPlanData>>> ChoosePaymentOptionAsync(
            [FromRoute] long planId,
            [FromBody] ChoosePaymentOptionRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _cashierService.ChoosePaymentOptionAsync(planId, request, CurrentUserId ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<CashierPlanData>.SuccessResult(result, ErrorConstants.CashierMessage.OptionSaved));
        }

        /// <summary>
        /// A receipt with one or more lines (DEPOSIT, FULL, PERIOD, VISIT_SERVICE). Cash is confirmed at once;
        /// bank transfer and QR wait for confirmation.
        /// </summary>
        [HttpPost("receipts")]
        public async Task<ActionResult<ApiResponse<CashierReceiptData>>> CreateReceiptAsync(
            [FromBody] CreateReceiptRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _cashierService.CreateReceiptAsync(request, CurrentUserId ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<CashierReceiptData>.SuccessResult(result, ErrorConstants.CashierMessage.ReceiptSaved));
        }

        [HttpPost("patients/{patientId:int}/receipts/{receiptId}/confirm")]
        public async Task<ActionResult<ApiResponse<CashierReceiptData>>> ConfirmReceiptAsync(
            [FromRoute] int patientId,
            [FromRoute] string receiptId,
            CancellationToken cancellationToken)
        {
            var result = await _cashierService.ConfirmReceiptAsync(patientId, receiptId, CurrentUserId ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<CashierReceiptData>.SuccessResult(result, ErrorConstants.CashierMessage.ReceiptConfirmed));
        }

        [HttpPost("patients/{patientId:int}/receipts/{receiptId}/reject")]
        public async Task<ActionResult<ApiResponse<CashierReceiptData>>> RejectReceiptAsync(
            [FromRoute] int patientId,
            [FromRoute] string receiptId,
            CancellationToken cancellationToken)
        {
            var result = await _cashierService.RejectReceiptAsync(patientId, receiptId, CurrentUserId ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<CashierReceiptData>.SuccessResult(result, ErrorConstants.CashierMessage.ReceiptRejected));
        }
    }
}

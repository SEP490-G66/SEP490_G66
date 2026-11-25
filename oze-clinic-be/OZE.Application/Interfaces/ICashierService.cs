using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Application.Interfaces
{
    // Cashier pages of the receptionist: Thanh toán, Đặt cọc dịch vụ, Thanh toán theo đợt, Ghi nhận thu tiền
    public interface ICashierService
    {
        Task<PagedResult<CashierPatientSummaryResponse>> GetPatientsAsync(CashierPatientQuery query, CancellationToken cancellationToken = default);

        Task<CashierDebtListResponse> GetDebtsAsync(CashierDebtQuery query, CancellationToken cancellationToken = default);

        Task<CashierAccountResponse> GetAccountAsync(int patientId, CancellationToken cancellationToken = default);

        Task<List<CashierPatientOption>> GetPatientOptionsAsync(string? search, CancellationToken cancellationToken = default);

        Task<CashierConfigResponse> GetConfigAsync(CancellationToken cancellationToken = default);

        Task<CashierPlanData> ChoosePaymentOptionAsync(long planId, ChoosePaymentOptionRequest request, string userId, CancellationToken cancellationToken = default);

        Task<CashierReceiptData> CreateReceiptAsync(CreateReceiptRequest request, string userId, CancellationToken cancellationToken = default);

        Task<CashierReceiptData> ConfirmReceiptAsync(int patientId, string receiptId, string userId, CancellationToken cancellationToken = default);

        Task<CashierReceiptData> RejectReceiptAsync(int patientId, string receiptId, string userId, CancellationToken cancellationToken = default);

        // Called by the treatment plan flow after a session was finished or its cost changed:
        // links the session to the visit it was done in and brings the plan invoice up to date. Never throws.
        Task OnSessionChangedAsync(long planId, long stageId, int? doctorId, CancellationToken cancellationToken = default);
    }
}

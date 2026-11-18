using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    // Read-only money views of the signed-in patient (pages "Công nợ" and "Lịch sử thanh toán")
    public interface IPatientBillingService
    {
        Task<List<PatientPaymentAccountResponse>> GetMyAccountsAsync(string userId, CancellationToken cancellationToken = default);

        Task<List<PatientInvoiceDetailResponse>> GetMyInvoiceDetailsAsync(string userId, CancellationToken cancellationToken = default);
    }
}

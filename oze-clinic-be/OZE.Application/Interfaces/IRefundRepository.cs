using OZE.Domain.Entities;

namespace OZE.Application.Interfaces
{
    public interface IRefundRepository
    {
        Task AddAsync(RefundAdjustmentRequest request, CancellationToken cancellationToken = default);

        Task<RefundAdjustmentRequest?> GetByIdWithInvoiceAsync(long id, CancellationToken cancellationToken = default);

        Task<IReadOnlyList<RefundAdjustmentRequest>> GetListAsync(
            string? status,
            long? invoiceId,
            CancellationToken cancellationToken = default);

        Task<int?> GetPatientIdByUserIdAsync(string userId, CancellationToken cancellationToken = default);

        // Every non-cancelled invoice of the patient with its payments, refunds, items, plan and doctor
        Task<IReadOnlyList<Invoice>> GetPatientInvoicesForRefundAsync(int patientId, CancellationToken cancellationToken = default);

        Task<bool> HasPendingForInvoiceAsync(long invoiceId, CancellationToken cancellationToken = default);

        Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>> action, CancellationToken cancellationToken = default);

        Task SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}

using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;

namespace OZE.Application.Interfaces
{
    public interface ICashSessionRepository
    {
        Task<CashSession?> GetOpenByUserAsync(string userId, CancellationToken cancellationToken = default);
        Task<CashSession?> GetByIdAsync(long id, CancellationToken cancellationToken = default);
        Task<PagedResult<CashSession>> GetPagedAsync(CashSessionQuery query, string? openedByUserId, CancellationToken cancellationToken = default);
        Task AddAsync(CashSession session, CancellationToken cancellationToken = default);
        void RemoveExpense(CashExpense expense);

        // Confirmed payments whose confirmation was done by that user in [from, to)
        Task<List<CashSessionPaymentItem>> GetPaymentsConfirmedByAsync(string userId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken = default);

        // Refunds that user paid out in [from, to)
        Task<List<CashSessionRefundItem>> GetRefundsPaidOutByAsync(string userId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken = default);

        // An open drawer of another receptionist, the oldest first
        Task<CashSession?> GetOpenOfOthersAsync(string userId, CancellationToken cancellationToken = default);

        // The latest session of the clinic closed in [from, to), whoever closed it
        Task<CashSession?> GetLatestClosedAsync(DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken = default);

        // The user's work shifts on that day, earliest first
        Task<List<StaffSchedule>> GetShiftsOfUserAsync(string userId, DateOnly date, CancellationToken cancellationToken = default);

        Task<Dictionary<string, string>> GetStaffNamesAsync(IEnumerable<string> userIds, CancellationToken cancellationToken = default);
        Task<List<StaffOption>> GetActiveReceptionistsAsync(CancellationToken cancellationToken = default);

        Task SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}

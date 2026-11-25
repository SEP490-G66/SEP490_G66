namespace OZE.Domain.Entities
{
    // One receptionist's cash drawer from opening to hand-over
    public class CashSession
    {
        public long Id { get; set; }
        public string OpenedByUserId { get; set; } = string.Empty;
        public DateTimeOffset OpenedAt { get; set; }
        public decimal OpeningCash { get; set; }
        public string Status { get; set; } = "Open";

        // Filled in when the session is closed, so the numbers stay as they were at hand-over
        public DateTimeOffset? ClosedAt { get; set; }
        public decimal? CashCollected { get; set; }
        public decimal? TransferConfirmed { get; set; }
        public decimal? ExpenseTotal { get; set; }
        public decimal? ExpectedCash { get; set; }
        public decimal? CountedCash { get; set; }
        public decimal? Difference { get; set; }
        // Approved refunds this receptionist paid out in cash from the drawer
        public decimal? RefundPaidOut { get; set; }
        // Transfers the receptionist checked on the bank statement, against TransferConfirmed
        public decimal? CountedTransfer { get; set; }
        public decimal? TransferDifference { get; set; }
        // The drawer counted note by note, as JSON {"500000":2,...}; null when only the total was entered
        public string? Denominations { get; set; }
        public string? HandoverToUserId { get; set; }
        public string? Notes { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }

        public virtual ICollection<CashExpense> Expenses { get; set; } = new List<CashExpense>();
    }
}

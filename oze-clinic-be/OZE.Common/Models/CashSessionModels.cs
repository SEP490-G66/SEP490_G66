using System.ComponentModel.DataAnnotations;
using OZE.Common.Models.Base;

namespace OZE.Common.Models
{
    /// <summary>Yêu cầu mở ca làm việc tiền mặt mới với số tiền đầu ca.</summary>
    public class OpenCashSessionRequest
    {
        [Required]
        [Range(typeof(decimal), "0", "1000000000")]
        public decimal? OpeningCash { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }
    }

    /// <summary>Yêu cầu ghi nhận khoản chi tiền mặt phát sinh trong ca.</summary>
    public class AddCashExpenseRequest
    {
        [Required]
        [Range(typeof(decimal), "0.01", "1000000000")]
        public decimal? Amount { get; set; }

        // Supplies or Other (default)
        public string? Category { get; set; }

        [Required]
        [MaxLength(300)]
        public string Description { get; set; } = string.Empty;
    }

    /// <summary>Yêu cầu đóng ca làm việc, kiểm đếm tiền và bàn giao ca.</summary>
    public class CloseCashSessionRequest
    {
        [Required]
        [Range(typeof(decimal), "0", "1000000000")]
        public decimal? CountedCash { get; set; }

        // The receptionist of the next shift; empty when the session ends the day
        public string? HandoverToUserId { get; set; }

        // Required when the counted cash or the counted transfer differs from the system figure
        [MaxLength(500)]
        public string? Notes { get; set; }

        // The session the receptionist was counting; refused when it is not their open session any more
        public long? SessionId { get; set; }

        // The system figures shown while counting; refused when a payment or expense changed them meanwhile
        public decimal? ExpectedCash { get; set; }
        public decimal? ExpectedTransfer { get; set; }

        // Transfers checked on the bank statement; null when not checked
        [Range(typeof(decimal), "0", "1000000000")]
        public decimal? CountedTransfer { get; set; }

        // Count per note (face value -> number of notes); must add up to CountedCash
        public Dictionary<int, int>? Denominations { get; set; }
    }

    public class CashSessionQuery : PagedRequestBase
    {
        public DateOnly? FromDate { get; set; }
        public DateOnly? ToDate { get; set; }
        // Manager only; a receptionist always sees their own sessions
        public string? OpenedByUserId { get; set; }
        // Open or Closed; empty for both. With Open a receptionist sees every open drawer of the clinic,
        // so a new shift is not opened while someone else's is still open
        public string? Status { get; set; }
    }

    // The shift the receptionist is about to open and the cash it should start with
    public class NextCashShiftResponse
    {
        public string StaffName { get; set; } = string.Empty;
        // The caller's work shift today that is not over yet; null when not on today's schedule
        public TimeOnly? ShiftStart { get; set; }
        public TimeOnly? ShiftEnd { get; set; }
        // Cash counted when the previous session of today was closed
        public decimal ExpectedOpeningCash { get; set; }
        public long FromSessionId { get; set; }
        public string FromUserName { get; set; } = string.Empty;
        public DateTimeOffset? PreviousClosedAt { get; set; }
        public string PreviousClosedByName { get; set; } = string.Empty;
    }

    public class CashSessionRefundItem
    {
        public long RefundRequestId { get; set; }
        public long InvoiceId { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public string PatientName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTimeOffset? PaidOutAt { get; set; }
    }

    public class CashExpenseResponse
    {
        public long Id { get; set; }
        public decimal Amount { get; set; }
        public string Category { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
    }

    public class CashSessionPaymentItem
    {
        public long PaymentId { get; set; }
        public long InvoiceId { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public string PatientName { get; set; } = string.Empty;
        public string PaymentMethod { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTimeOffset? PaidAt { get; set; }
    }

    public class CashSessionResponse
    {
        public long Id { get; set; }
        public string OpenedByUserId { get; set; } = string.Empty;
        public string OpenedByName { get; set; } = string.Empty;
        public DateTimeOffset OpenedAt { get; set; }
        public string Status { get; set; } = string.Empty;
        public decimal OpeningCash { get; set; }
        // Cash payments this receptionist took during the session
        public decimal CashCollected { get; set; }
        // Bank and QR payments this receptionist confirmed during the session (not in the drawer)
        public decimal TransferConfirmed { get; set; }
        public decimal ExpenseTotal { get; set; }
        // Approved refunds paid out in cash from the drawer during the session
        public decimal RefundPaidOut { get; set; }
        // OpeningCash + CashCollected - ExpenseTotal - RefundPaidOut
        public decimal ExpectedCash { get; set; }
        public decimal? CountedCash { get; set; }
        public decimal? Difference { get; set; }
        public decimal? CountedTransfer { get; set; }
        // CountedTransfer - TransferConfirmed
        public decimal? TransferDifference { get; set; }
        public Dictionary<int, int>? Denominations { get; set; }
        public DateTimeOffset? ClosedAt { get; set; }
        public string? HandoverToUserId { get; set; }
        public string? HandoverToName { get; set; }
        public string? Notes { get; set; }
        public List<CashExpenseResponse> Expenses { get; set; } = new();
        public List<CashSessionPaymentItem> Payments { get; set; } = new();
        public List<CashSessionRefundItem> Refunds { get; set; } = new();
    }

    public class CashSessionSummaryResponse
    {
        public long Id { get; set; }
        public string OpenedByName { get; set; } = string.Empty;
        public DateTimeOffset OpenedAt { get; set; }
        public DateTimeOffset? ClosedAt { get; set; }
        public string Status { get; set; } = string.Empty;
        public decimal OpeningCash { get; set; }
        public decimal? CashCollected { get; set; }
        public decimal? ExpenseTotal { get; set; }
        public decimal? ExpectedCash { get; set; }
        public decimal? CountedCash { get; set; }
        public decimal? Difference { get; set; }
        public decimal? RefundPaidOut { get; set; }
        public decimal? TransferConfirmed { get; set; }
        public decimal? CountedTransfer { get; set; }
        public decimal? TransferDifference { get; set; }
        public string? HandoverToName { get; set; }
    }

    public class StaffOption
    {
        public string UserId { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
    }
}

using System.ComponentModel.DataAnnotations;
using OZE.Common.Models.Base;

namespace OZE.Common.Models
{
    // ---------- Requests ----------

    // Danh sách Thanh toán. Date = one day (the FE sends today by default); null with no search = every day.
    public class CashierPatientQuery : PagedRequestBase
    {
        public DateOnly? Date { get; set; }
        // OWED | PENDING | REFUND | UPCOMING | SETTLED; empty = all
        public string? Status { get; set; }
    }

    // Công nợ: patients still owing confirmed money. Age = lt7 | 7to30 | gt30 | empty (days since OwedSince)
    public class CashierDebtQuery : PagedRequestBase
    {
        public string? Age { get; set; }
        public DateOnly? FromDate { get; set; }
        public DateOnly? ToDate { get; set; }
    }

    public class ChoosePaymentOptionRequest
    {
        [Required]
        public int PatientId { get; set; }

        [Required]
        [MaxLength(20)]
        public string Option { get; set; } = string.Empty;
    }

    // One cashier receipt: Đặt cọc dịch vụ (one DEPOSIT line) or Ghi nhận thu tiền (FULL / PERIOD / VISIT_SERVICE lines)
    public class CreateReceiptRequest
    {
        [Required]
        public int PatientId { get; set; }

        [Required]
        [MaxLength(20)]
        public string PaymentMethod { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? TransactionReference { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        [Required]
        [MinLength(1)]
        public List<CreateReceiptLineRequest> Lines { get; set; } = new();
    }

    public class CreateReceiptLineRequest
    {
        [Required]
        [MaxLength(20)]
        public string Kind { get; set; } = string.Empty;

        // DEPOSIT, FULL, PERIOD
        public long? PlanId { get; set; }

        // PERIOD: id of the treatment session (TreatmentPlanStage)
        public long? PeriodId { get; set; }

        // VISIT_SERVICE: id of the appointment of the visit
        public long? VisitId { get; set; }

        [Range(1, double.MaxValue)]
        public decimal Amount { get; set; }
    }

    // ---------- Raw data, same shape as the FE mock (utils/data/mockCashier.jsx) ----------

    public class CashierPatientInfo
    {
        public int Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
    }

    public class CashierPlanData
    {
        public long Id { get; set; }
        public int PatientId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal PlanPrice { get; set; }
        // null until the cashier chooses: FULL | PERIODS | DEPOSIT
        public string? Option { get; set; }
        // Fraction (0.3 = 30 %), only for DEPOSIT plans
        public decimal? DepositRate { get; set; }
        // Clinic date the option was chosen; null until chosen
        public DateOnly? OptionChosenAt { get; set; }
        public long? InvoiceId { get; set; }
        public List<CashierPeriodData> Periods { get; set; } = new();
    }

    // One treatment session (đợt) of a plan
    public class CashierPeriodData
    {
        public long Id { get; set; }
        public int Seq { get; set; }
        public string? Name { get; set; }
        public long? AppointmentId { get; set; }
        public DateOnly? Date { get; set; }
        public decimal PlanAmount { get; set; }
        public decimal ExtraAmount { get; set; }
        public bool Finished { get; set; }
    }

    // A finished visit with services outside the plans (lượt lẻ); money is counted for the whole visit
    public class CashierVisitData
    {
        // Id of the appointment
        public long Id { get; set; }
        public int PatientId { get; set; }
        public long AppointmentId { get; set; }
        // Clinic local time, yyyy-MM-ddTHH:mm
        public string StartAt { get; set; } = string.Empty;
        public long? InvoiceId { get; set; }
        // What the visit costs: final amount of its invoice, or the sum of its services when it has none yet
        public decimal Amount { get; set; }
        public List<CashierVisitServiceData> Services { get; set; } = new();
    }

    public class CashierVisitServiceData
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    public class CashierReceiptData
    {
        // ReceiptCode, or P{paymentId} for a payment recorded on its own
        public string Id { get; set; } = string.Empty;
        public int PatientId { get; set; }
        public string Method { get; set; } = string.Empty;
        // CONFIRMED | PENDING | REJECTED
        public string Status { get; set; } = string.Empty;
        public string? Ref { get; set; }
        public string? Note { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public string? ReceivedBy { get; set; }
        public string? ConfirmedBy { get; set; }
        public DateTimeOffset? ConfirmedAt { get; set; }
        public List<CashierReceiptLineData> Lines { get; set; } = new();
    }

    public class CashierReceiptLineData
    {
        public long PaymentId { get; set; }
        public string Kind { get; set; } = string.Empty;
        public long? PlanId { get; set; }
        public long? PeriodId { get; set; }
        public long? VisitId { get; set; }
        public decimal Amount { get; set; }
    }

    // GET /api/cashier/patients/{id}/account: everything of one patient, the FE works the numbers out with utils/cashier.js
    public class CashierAccountResponse
    {
        public CashierPatientInfo Patient { get; set; } = new();
        public List<CashierPlanData> Plans { get; set; } = new();
        public List<CashierVisitData> Visits { get; set; } = new();
        public List<CashierReceiptData> Receipts { get; set; } = new();
    }

    // ---------- Worked out (CashierCalculator) ----------

    // One row of Danh sách Thanh toán
    public class CashierPatientSummaryResponse
    {
        public int Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        // Còn nợ (confirmed money only)
        public decimal Owed { get; set; }
        // Most that may still be collected (confirmed + pending money counted)
        public decimal OwedHeld { get; set; }
        public decimal Pending { get; set; }
        public decimal Refundable { get; set; }
        public decimal DepositLeft { get; set; }
        public DateOnly? LastVisit { get; set; }
        public List<string> Statuses { get; set; } = new();
        public string Status { get; set; } = string.Empty;
        // What is still running or owed: plan names, then dates of visits with money left
        public List<CashierOpenItem> Open { get; set; } = new();
    }

    // One row of Công nợ: the Thanh toán row plus since when the patient owes
    public class CashierDebtItemResponse : CashierPatientSummaryResponse
    {
        public DateOnly? OwedSince { get; set; }
        public int? DebtDays { get; set; }
    }

    public class CashierDebtListResponse : PagedResult<CashierDebtItemResponse>
    {
        // Sum of Owed over every row that matches the search and age filter, not only this page
        public decimal TotalOwed { get; set; }
    }

    public class CashierOpenItem
    {
        // plan | visit
        public string Kind { get; set; } = string.Empty;
        public string? Label { get; set; }
        public DateOnly? Date { get; set; }
    }

    public class CashierPatientOption
    {
        public int Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
    }

    public class CashierConfigResponse
    {
        // Fraction (0.3 = 30 %)
        public decimal DepositRate { get; set; }
    }
}

namespace OZE.Domain.Entities
{
    public class Payment
    {
        public long Id { get; set; }
        public long InvoiceId { get; set; }
        public decimal Amount { get; set; }
        public string PaymentMethod { get; set; } = string.Empty;
        public string? TransactionReference { get; set; }
        public string PaymentStatus { get; set; } = "PENDING";
        public string Purpose { get; set; } = "Regular";
        public long? InstallmentPeriodId { get; set; }
        // Lines of one cashier receipt share this code (PT-yyMMdd-000001); null for payments recorded one by one
        public string? ReceiptCode { get; set; }
        // Set when the line pays one treatment session (đợt) of the plan
        public long? TreatmentPlanStageId { get; set; }
        // Who took the money at the desk (ConfirmedByUserId is who confirmed it)
        public string? CreatedByUserId { get; set; }
        public DateTimeOffset? PaidAt { get; set; }
        public string? ConfirmedByUserId { get; set; }
        public string? Notes { get; set; }
        public DateTimeOffset CreatedAt { get; set; }

        public virtual Invoice Invoice { get; set; } = null!;
        public virtual InstallmentPeriod? InstallmentPeriod { get; set; }
        public virtual TreatmentPlanStage? TreatmentPlanStage { get; set; }
    }
}

using System;
using System.Collections.Generic;

namespace OZE.Common.Models
{
    // One debt line of the patient's "Công nợ" page: a treatment plan invoice or a single visit invoice
    public class PatientPaymentAccountResponse
    {
        public string Key { get; set; } = string.Empty;
        public long InvoiceId { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        // ONCE | STEP | INSTALLMENT
        public string PaymentMode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? DoctorName { get; set; }
        public DateOnly StartedOn { get; set; }
        public decimal FinalAmount { get; set; }
        public decimal PaidAmount { get; set; }
        // Work done or periods already due, not paid yet
        public decimal DueAmount { get; set; }
        // Steps not done yet or periods not due yet
        public decimal PlannedAmount { get; set; }
        public bool HasOverdue { get; set; }
        public List<PatientPaymentStepResponse> Steps { get; set; } = new();
        public List<PatientPaymentRecordResponse> Payments { get; set; } = new();
        public List<PatientRefundRequestResponse> Refunds { get; set; } = new();
    }

    // A plan stage (STEP), an installment period (INSTALLMENT) or a service line (ONCE)
    public class PatientPaymentStepResponse
    {
        public int Number { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        // Stage: DONE | IN_PROGRESS | NOT_STARTED; period: Paid | Pending | Overdue; service line: null
        public string? Status { get; set; }
        public DateOnly? Date { get; set; }
    }

    public class PatientPaymentRecordResponse
    {
        public long Id { get; set; }
        public decimal Amount { get; set; }
        public string PaymentMethod { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public DateTimeOffset? PaidAt { get; set; }
    }

    public class PatientRefundRequestResponse
    {
        public long Id { get; set; }
        public decimal Amount { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? RejectionReason { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? ProcessedAt { get; set; }
    }

    // One invoice of the patient's "Lịch sử thanh toán" page, printed like the clinic's paper slip
    public class PatientInvoiceDetailResponse
    {
        public long Id { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
        public string PaymentStatus { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal FinalAmount { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal RemainingAmount { get; set; }
        public long? AppointmentId { get; set; }
        public DateOnly? VisitDate { get; set; }
        public string? DoctorName { get; set; }
        public string? ChiefComplaint { get; set; }
        public List<string> Diagnoses { get; set; } = new();
        public DateOnly? FollowUpDate { get; set; }
        public string? FollowUpNotes { get; set; }
        public long? TreatmentPlanId { get; set; }
        public string? TreatmentPlanName { get; set; }
        public List<PatientInvoiceLineResponse> Items { get; set; } = new();
        public List<PatientPaymentRecordResponse> Payments { get; set; } = new();
        public List<PatientRefundRequestResponse> Refunds { get; set; } = new();
    }

    public class PatientInvoiceLineResponse
    {
        public string ServiceName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        public decimal Amount { get; set; }
        public string? StageName { get; set; }
    }
}

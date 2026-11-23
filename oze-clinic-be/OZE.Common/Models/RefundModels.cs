using System.ComponentModel.DataAnnotations;

namespace OZE.Common.Models
{
    /// <summary>Yêu cầu hoàn tiền từ phía nhân viên lễ tân.</summary>
    public class CreateRefundRequest
    {
        [Required]
        [MaxLength(1000)]
        public string Reason { get; set; } = string.Empty;

        public long? PaymentId { get; set; }
    }

    /// <summary>Thiết lập chi phí công việc đã hoàn thành để tính tiền hoàn.</summary>
    public class SetWorkDoneAmountRequest
    {
        [Range(0, double.MaxValue)]
        public decimal WorkDoneAmount { get; set; }
    }

    /// <summary>Yêu cầu từ chối hoàn tiền với lý do chi tiết.</summary>
    public class RejectRefundRequest
    {
        [Required]
        [MaxLength(500)]
        public string RejectionReason { get; set; } = string.Empty;
    }

    /// <summary>Bộ lọc tìm kiếm các yêu cầu hoàn tiền.</summary>
    public class RefundRequestQueryParameters
    {
        public string? Status { get; set; }
        public long? InvoiceId { get; set; }
    }

    /// <summary>Dữ liệu phản hồi của một yêu cầu hoàn tiền.</summary>
    public class RefundRequestResponse
    {
        public long Id { get; set; }
        public long InvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public long? PaymentId { get; set; }
        public string RequestType { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public decimal? WorkDoneAmount { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string RequestedByUserId { get; set; } = string.Empty;
        public string? ApprovedByUserId { get; set; }
        public DateTimeOffset? ApprovedAt { get; set; }
        public string? RejectionReason { get; set; }
        public DateTimeOffset? ProcessedAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public decimal? InvoicePaidAmount { get; set; }
        public string? InvoicePaymentStatus { get; set; }
        // Filled on the list for the manager's page
        public string? PatientName { get; set; }
        public string? PatientCode { get; set; }
        public string? ServiceNames { get; set; }
        // "Bệnh nhân" when the patient sent it online, otherwise "Lễ tân"
        public string? RequestedByName { get; set; }
    }

    public class CreateMyRefundRequest
    {
        [Range(1, long.MaxValue)]
        public long InvoiceId { get; set; }

        [Required]
        [MaxLength(1000)]
        public string Reason { get; set; } = string.Empty;
    }

    // A patient's own refund request (GET api/refund-requests/my)
    public class MyRefundRequestResponse
    {
        public long Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public long InvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public long? TreatmentPlanId { get; set; }
        public string? AccountName { get; set; }
        public DateTimeOffset InvoiceDate { get; set; }
        public string? DoctorName { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal? RefundAmount { get; set; }
        public decimal? WorkDoneAmount { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? RejectionReason { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? ApprovedAt { get; set; }
        public DateTimeOffset? ProcessedAt { get; set; }
        public string? RefundMethod { get; set; }
    }

    // An invoice the patient can ask a refund for (GET api/refund-requests/my/refundable-invoices)
    public class MyRefundableInvoiceResponse
    {
        public long InvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public long? TreatmentPlanId { get; set; }
        public string? AccountName { get; set; }
        public DateTimeOffset InvoiceDate { get; set; }
        public string? DoctorName { get; set; }
        public decimal PaidAmount { get; set; }
    }
}

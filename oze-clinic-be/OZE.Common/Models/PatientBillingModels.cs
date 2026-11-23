using System;
using System.Collections.Generic;

namespace OZE.Common.Models
{
    /// <summary>
    /// Đại diện cho một dòng công nợ của bệnh nhân trên màn hình "Công nợ":
    /// có thể là hóa đơn kế hoạch điều trị hoặc hóa đơn của một buổi khám đơn lẻ.
    /// </summary>
    public class PatientPaymentAccountResponse
    {
        /// <summary>Mã khóa duy nhất phân biệt dòng công nợ (plan-{id} hoặc inv-{id}).</summary>
        public string Key { get; set; } = string.Empty;

        /// <summary>Mã định danh hóa đơn.</summary>
        public long InvoiceId { get; set; }

        /// <summary>Mã số hóa đơn hiển thị (ví dụ: INV-2026-0001).</summary>
        public string InvoiceNumber { get; set; } = string.Empty;

        /// <summary>Hình thức thanh toán: ONCE (Một lần) | STEP (Theo giai đoạn) | INSTALLMENT (Trả góp).</summary>
        public string PaymentMode { get; set; } = string.Empty;

        /// <summary>Tên kế hoạch điều trị hoặc nội dung đợt khám.</summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>Tên bác sĩ phụ trách điều trị.</summary>
        public string? DoctorName { get; set; }

        /// <summary>Ngày bắt đầu đợt khám hoặc kế hoạch điều trị.</summary>
        public DateOnly StartedOn { get; set; }

        /// <summary>Tổng số tiền sau giảm giá cần thanh toán.</summary>
        public decimal FinalAmount { get; set; }

        /// <summary>Số tiền bệnh nhân đã thanh toán thành công.</summary>
        public decimal PaidAmount { get; set; }

        /// <summary>Số tiền đã phát sinh đến hạn nhưng chưa thanh toán.</summary>
        public decimal DueAmount { get; set; }

        /// <summary>Số tiền dự kiến cho các giai đoạn hoặc kỳ hạn tiếp theo chưa tới hạn.</summary>
        public decimal PlannedAmount { get; set; }

        /// <summary>Cờ đánh dấu có khoản tiền nào bị quá hạn thanh toán hay không.</summary>
        public bool HasOverdue { get; set; }

        /// <summary>Danh sách các giai đoạn hoặc kỳ trả góp của kế hoạch.</summary>
        public List<PatientPaymentStepResponse> Steps { get; set; } = new();

        /// <summary>Lịch sử các giao dịch thanh toán đã thực hiện.</summary>
        public List<PatientPaymentRecordResponse> Payments { get; set; } = new();

        /// <summary>Danh sách các yêu cầu hoàn tiền liên quan đến hóa đơn này.</summary>
        public List<PatientRefundRequestResponse> Refunds { get; set; } = new();
    }

    /// <summary>
    /// Đại diện cho một bước trong kế hoạch: giai đoạn điều trị (STEP), kỳ trả góp (INSTALLMENT) hoặc dòng dịch vụ (ONCE).
    /// </summary>
    public class PatientPaymentStepResponse
    {
        /// <summary>Thứ tự bước hoặc số kỳ trả góp.</summary>
        public int Number { get; set; }

        /// <summary>Tên giai đoạn hoặc tên dịch vụ.</summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>Số tiền tương ứng với giai đoạn hoặc kỳ này.</summary>
        public decimal Amount { get; set; }

        /// <summary>Trạng thái: Giai đoạn (DONE | IN_PROGRESS | NOT_STARTED); Kỳ trả góp (Paid | Pending | Overdue); Dịch vụ lẻ (null).</summary>
        public string? Status { get; set; }

        /// <summary>Ngày thực hiện hoặc hạn thanh toán của kỳ.</summary>
        public DateOnly? Date { get; set; }
    }

    /// <summary>
    /// Ghi nhận lịch sử một lần thu tiền hoặc giao dịch thanh toán.
    /// </summary>
    public class PatientPaymentRecordResponse
    {
        /// <summary>Mã định danh bản ghi thanh toán.</summary>
        public long Id { get; set; }

        /// <summary>Số tiền thanh toán trong giao dịch.</summary>
        public decimal Amount { get; set; }

        /// <summary>Phương thức thanh toán (Tiền mặt, Chuyển khoản, Thẻ, VNPay,...).</summary>
        public string PaymentMethod { get; set; } = string.Empty;

        /// <summary>Trạng thái thanh toán (Completed, Pending, Failed,...).</summary>
        public string PaymentStatus { get; set; } = string.Empty;

        /// <summary>Thời điểm giao dịch được thực hiện thành công.</summary>
        public DateTimeOffset? PaidAt { get; set; }
    }

    /// <summary>
    /// Thông tin yêu cầu hoàn tiền của bệnh nhân.
    /// </summary>
    public class PatientRefundRequestResponse
    {
        /// <summary>Mã định danh yêu cầu hoàn tiền.</summary>
        public long Id { get; set; }

        /// <summary>Số tiền đề xuất hoàn lại.</summary>
        public decimal Amount { get; set; }

        /// <summary>Lý do xin hoàn tiền.</summary>
        public string Reason { get; set; } = string.Empty;

        /// <summary>Trạng thái yêu cầu hoàn tiền (Pending, Approved, Rejected, Completed).</summary>
        public string Status { get; set; } = string.Empty;

        /// <summary>Lý do từ chối hoàn tiền (nếu bị từ chối).</summary>
        public string? RejectionReason { get; set; }

        /// <summary>Thời điểm tạo yêu cầu hoàn tiền.</summary>
        public DateTimeOffset CreatedAt { get; set; }

        /// <summary>Thời điểm xử lý yêu cầu hoàn tiền.</summary>
        public DateTimeOffset? ProcessedAt { get; set; }
    }

    /// <summary>
    /// Chi tiết hóa đơn trên màn hình "Lịch sử thanh toán", dùng để hiển thị và in phiếu thu.
    /// </summary>
    public class PatientInvoiceDetailResponse
    {
        /// <summary>Mã định danh hóa đơn.</summary>
        public long Id { get; set; }

        /// <summary>Mã số hóa đơn (ví dụ: INV-2026-0001).</summary>
        public string InvoiceNumber { get; set; } = string.Empty;

        /// <summary>Thời điểm tạo hóa đơn.</summary>
        public DateTimeOffset CreatedAt { get; set; }

        /// <summary>Trạng thái thanh toán của hóa đơn.</summary>
        public string PaymentStatus { get; set; } = string.Empty;

        /// <summary>Tổng tiền ban đầu của hóa đơn.</summary>
        public decimal TotalAmount { get; set; }

        /// <summary>Tổng tiền giảm giá, ưu đãi.</summary>
        public decimal DiscountAmount { get; set; }

        /// <summary>Tổng tiền sau khi đã trừ giảm giá.</summary>
        public decimal FinalAmount { get; set; }

        /// <summary>Số tiền bệnh nhân đã thanh toán.</summary>
        public decimal PaidAmount { get; set; }

        /// <summary>Số tiền còn thiếu cần thanh toán tiếp.</summary>
        public decimal RemainingAmount { get; set; }

        /// <summary>Mã lịch hẹn liên kết (nếu có).</summary>
        public long? AppointmentId { get; set; }

        /// <summary>Ngày thăm khám.</summary>
        public DateOnly? VisitDate { get; set; }

        /// <summary>Tên bác sĩ thực hiện khám/điều trị.</summary>
        public string? DoctorName { get; set; }

        /// <summary>Lý do đến khám (chief complaint).</summary>
        public string? ChiefComplaint { get; set; }

        /// <summary>Danh sách kết luận chẩn đoán bệnh.</summary>
        public List<string> Diagnoses { get; set; } = new();

        /// <summary>Ngày hẹn tái khám.</summary>
        public DateOnly? FollowUpDate { get; set; }

        /// <summary>Ghi chú hoặc lời dặn tái khám.</summary>
        public string? FollowUpNotes { get; set; }

        /// <summary>Mã định danh kế hoạch điều trị liên kết (nếu có).</summary>
        public long? TreatmentPlanId { get; set; }

        /// <summary>Tên kế hoạch điều trị liên kết (nếu có).</summary>
        public string? TreatmentPlanName { get; set; }

        /// <summary>Danh sách chi tiết các mục dịch vụ trên hóa đơn.</summary>
        public List<PatientInvoiceLineResponse> Items { get; set; } = new();

        /// <summary>Lịch sử các lần nộp tiền cho hóa đơn này.</summary>
        public List<PatientPaymentRecordResponse> Payments { get; set; } = new();

        /// <summary>Danh sách các yêu cầu hoàn tiền của hóa đơn này.</summary>
        public List<PatientRefundRequestResponse> Refunds { get; set; } = new();
    }

    /// <summary>
    /// Một dòng dịch vụ hoặc chi phí cụ thể trên hóa đơn.
    /// </summary>
    public class PatientInvoiceLineResponse
    {
        /// <summary>Tên dịch vụ y tế được thực hiện.</summary>
        public string ServiceName { get; set; } = string.Empty;

        /// <summary>Mô tả chi tiết hoặc vị trí răng can thiệp.</summary>
        public string? Description { get; set; }

        /// <summary>Đơn giá dịch vụ.</summary>
        public decimal UnitPrice { get; set; }

        /// <summary>Số lượng thực hiện.</summary>
        public int Quantity { get; set; }

        /// <summary>Thành tiền của dòng dịch vụ.</summary>
        public decimal Amount { get; set; }

        /// <summary>Tên giai đoạn kế hoạch tương ứng (nếu thuộc kế hoạch điều trị).</summary>
        public string? StageName { get; set; }
    }
}


using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;

namespace OZE.Application.Interfaces
{
    /// <summary>
    /// Repository quản lý truy xuất và lưu trữ dữ liệu hóa đơn (Invoice).
    /// </summary>
    public interface IInvoiceRepository
    {
        /// <summary>Thêm mới một hóa đơn vào cơ sở dữ liệu.</summary>
        Task AddAsync(Invoice invoice, CancellationToken cancellationToken = default);

        /// <summary>Đánh dấu cập nhật thực thể hóa đơn.</summary>
        void Update(Invoice invoice);

        /// <summary>Lấy thông tin hóa đơn theo Id kèm đầy đủ chi tiết (Items, Payments, Refunds, TreatmentPlan).</summary>
        Task<Invoice?> GetByIdWithDetailsAsync(long id, CancellationToken cancellationToken = default);

        /// <summary>
        /// Lấy danh sách hóa đơn hợp lệ (chưa bị hủy) của bệnh nhân phục vụ trang công nợ và lịch sử thanh toán.
        /// </summary>
        Task<IReadOnlyList<Invoice>> GetPatientBillingAsync(int patientId, CancellationToken cancellationToken = default);

        /// <summary>Lấy danh sách hóa đơn phân trang theo bộ lọc tìm kiếm.</summary>
        Task<PagedResult<Invoice>> GetPagedAsync(InvoiceQueryParameters parameters, CancellationToken cancellationToken = default);

        /// <summary>Lấy toàn bộ danh sách hóa đơn theo mã bệnh nhân.</summary>
        Task<IReadOnlyList<Invoice>> GetByPatientAsync(int patientId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Lấy danh sách hóa đơn còn nợ (remaining balance &gt; 0) của bệnh nhân để cảnh báo thu ngân.
        /// </summary>
        Task<IReadOnlyList<Invoice>> GetOutstandingForPatientAsync(
            int patientId,
            CancellationToken cancellationToken = default);

        /// <summary>Kiểm tra mã số hóa đơn đã tồn tại trong hệ thống hay chưa.</summary>
        Task<bool> ExistsByNumberAsync(string invoiceNumber, CancellationToken cancellationToken = default);

        /// <summary>Kiểm tra xem lịch hẹn đã có hóa đơn đang mở hay chưa.</summary>
        Task<bool> HasOpenInvoiceForAppointmentAsync(long appointmentId, CancellationToken cancellationToken = default);

        /// <summary>Kiểm tra xem kế hoạch điều trị đã có hóa đơn đang mở hay chưa.</summary>
        Task<bool> HasOpenInvoiceForTreatmentPlanAsync(long treatmentPlanId, CancellationToken cancellationToken = default);

        /// <summary>Lưu các thay đổi vào cơ sở dữ liệu.</summary>
        Task SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}


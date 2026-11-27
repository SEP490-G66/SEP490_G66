using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.Interfaces
{
    /// <summary>
    /// Repository quản lý truy xuất và lưu trữ dữ liệu chuyên biệt cho nghiệp vụ thu ngân (Cashier).
    /// </summary>
    public interface ICashierRepository
    {
        /// <summary>Lấy danh sách ứng viên bệnh nhân có kế hoạch điều trị hoặc buổi khám đã hoàn tất.</summary>
        Task<List<CashierPatientInfo>> GetCandidatePatientsAsync(CancellationToken cancellationToken = default);

        /// <summary>Lấy thông tin thu ngân cơ bản của một bệnh nhân theo Id.</summary>
        Task<CashierPatientInfo?> GetPatientAsync(int patientId, CancellationToken cancellationToken = default);

        /// <summary>Lấy danh sách tài khoản thu ngân tổng hợp cho tập hợp bệnh nhân.</summary>
        Task<List<CashierAccountResponse>> GetAccountsAsync(IReadOnlyCollection<CashierPatientInfo> patients, CancellationToken cancellationToken = default);

        /// <summary>Lấy thông tin thực thể kế hoạch điều trị kèm theo dõi (tracked).</summary>
        Task<TreatmentPlan?> GetTrackedPlanAsync(long planId, CancellationToken cancellationToken = default);

        /// <summary>Lấy hóa đơn đang mở của kế hoạch điều trị kèm danh sách chi tiết (items, payments, refunds).</summary>
        Task<Invoice?> GetTrackedPlanInvoiceAsync(long planId, CancellationToken cancellationToken = default);

        /// <summary>Lấy hóa đơn đang mở của buổi khám đơn lẻ (khách vãng lai).</summary>
        Task<Invoice?> GetTrackedVisitInvoiceAsync(long appointmentId, CancellationToken cancellationToken = default);

        /// <summary>Lấy thông tin buổi khám đã hoàn tất của bệnh nhân.</summary>
        Task<Appointment?> GetVisitAsync(int patientId, long appointmentId, CancellationToken cancellationToken = default);

        /// <summary>Truy vấn danh sách dịch vụ thuộc các phiên điều trị thực hiện trong các buổi khám.</summary>
        Task<Dictionary<long, HashSet<int>>> GetSessionServicesByAppointmentAsync(IReadOnlyCollection<long> appointmentIds, CancellationToken cancellationToken = default);

        /// <summary>Lấy danh sách các khoản thanh toán thuộc về một biên lai thu tiền.</summary>
        Task<List<Payment>> GetTrackedReceiptPaymentsAsync(int patientId, string receiptId, CancellationToken cancellationToken = default);

        /// <summary>Tìm Id lịch hẹn hôm nay để liên kết phiên điều trị với buổi khám thực tế.</summary>
        Task<long?> FindSessionAppointmentIdAsync(int patientId, int doctorId, DateOnly date, CancellationToken cancellationToken = default);
        // The visit booked for this session (Appointment.TreatmentPlanStageId) that the patient came to, if any
        Task<long?> FindBookedSessionAppointmentIdAsync(long stageId, CancellationToken cancellationToken = default);

        /// <summary>Lấy giá trị cấu hình hệ thống theo khóa.</summary>
        Task<string?> GetConfigValueAsync(string key, CancellationToken cancellationToken = default);

        /// <summary>Kiểm tra mã biên lai thu tiền đã tồn tại hay chưa.</summary>
        Task<bool> ReceiptCodeExistsAsync(string code, CancellationToken cancellationToken = default);

        /// <summary>Kiểm tra số hóa đơn đã tồn tại hay chưa.</summary>
        Task<bool> InvoiceNumberExistsAsync(string number, CancellationToken cancellationToken = default);

        /// <summary>Thêm mới hóa đơn vào cơ sở dữ liệu.</summary>
        Task AddInvoiceAsync(Invoice invoice, CancellationToken cancellationToken = default);

        /// <summary>Thêm mới bản ghi thanh toán vào cơ sở dữ liệu.</summary>
        Task AddPaymentAsync(Payment payment, CancellationToken cancellationToken = default);

        /// <summary>Thực thi một chuỗi tác vụ trong phạm vi Transaction của cơ sở dữ liệu.</summary>
        Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>> action, CancellationToken cancellationToken = default);

        /// <summary>Lưu các thay đổi dữ liệu bất đồng bộ.</summary>
        Task SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}


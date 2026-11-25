using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    /// <summary>
    /// Service cung cấp các view dữ liệu tài chính chỉ đọc cho bệnh nhân đang đăng nhập,
    /// phục vụ các màn hình "Công nợ bệnh nhân" và "Lịch sử thanh toán".
    /// </summary>
    public interface IPatientBillingService
    {
        /// <summary>
        /// Lấy danh sách tài khoản thanh toán và tổng hợp công nợ của bệnh nhân theo mã định danh người dùng.
        /// </summary>
        /// <param name="userId">Mã định danh duy nhất của người dùng bệnh nhân (Identity UserId).</param>
        /// <param name="cancellationToken">Token thông báo hủy tác vụ bất đồng bộ.</param>
        /// <returns>Danh sách thông tin tài khoản công nợ của bệnh nhân.</returns>
        Task<List<PatientPaymentAccountResponse>> GetMyAccountsAsync(string userId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Lấy chi tiết các hóa đơn và lịch sử giao dịch thanh toán của bệnh nhân theo mã định danh người dùng.
        /// </summary>
        /// <param name="userId">Mã định danh duy nhất của người dùng bệnh nhân (Identity UserId).</param>
        /// <param name="cancellationToken">Token thông báo hủy tác vụ bất đồng bộ.</param>
        /// <returns>Danh sách chi tiết hóa đơn, các đợt thanh toán và số tiền còn nợ.</returns>
        Task<List<PatientInvoiceDetailResponse>> GetMyInvoiceDetailsAsync(string userId, CancellationToken cancellationToken = default);
    }
}


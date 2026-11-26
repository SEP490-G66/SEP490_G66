using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Application.Interfaces
{
    /// <summary>
    /// Service quản lý các nghiệp vụ thu ngân của Lễ tân: Thanh toán, Đặt cọc dịch vụ,
    /// Thanh toán theo đợt trả góp, Ghi nhận thu tiền và đồng bộ chi phí kế hoạch điều trị.
    /// </summary>
    public interface ICashierService
    {
        /// <summary>Lấy danh sách bệnh nhân phân trang phục vụ màn hình danh sách thu ngân.</summary>
        Task<PagedResult<CashierPatientSummaryResponse>> GetPatientsAsync(CashierPatientQuery query, CancellationToken cancellationToken = default);

        /// <summary>Truy vấn danh sách công nợ và các khoản cần thanh toán của bệnh nhân theo bộ lọc.</summary>
        Task<CashierDebtListResponse> GetDebtsAsync(CashierDebtQuery query, CancellationToken cancellationToken = default);

        /// <summary>Lấy chi tiết tài khoản thu ngân, số dư tạm ứng và lịch sử thanh toán của một bệnh nhân.</summary>
        Task<CashierAccountResponse> GetAccountAsync(int patientId, CancellationToken cancellationToken = default);

        /// <summary>Tìm kiếm danh sách gợi ý bệnh nhân phục vụ chức năng chọn nhanh tại quầy thu ngân.</summary>
        Task<List<CashierPatientOption>> GetPatientOptionsAsync(string? search, CancellationToken cancellationToken = default);

        /// <summary>Lấy thông tin cấu hình thu ngân và các chính sách thanh toán hiện hành.</summary>
        Task<CashierConfigResponse> GetConfigAsync(CancellationToken cancellationToken = default);

        /// <summary>Thiết lập hình thức thanh toán (trả thẳng / trả góp theo đợt) cho kế hoạch điều trị.</summary>
        Task<CashierPlanData> ChoosePaymentOptionAsync(long planId, ChoosePaymentOptionRequest request, string userId, CancellationToken cancellationToken = default);

        /// <summary>Tạo biên lai / phiếu thu tiền mới cho bệnh nhân.</summary>
        Task<CashierReceiptData> CreateReceiptAsync(CreateReceiptRequest request, string userId, CancellationToken cancellationToken = default);

        /// <summary>Xác nhận phiếu thu tiền đã hoàn tất giao dịch.</summary>
        Task<CashierReceiptData> ConfirmReceiptAsync(int patientId, string receiptId, string userId, CancellationToken cancellationToken = default);

        /// <summary>Hủy hoặc từ chối phiếu thu tiền với lý do cụ thể.</summary>
        Task<CashierReceiptData> RejectReceiptAsync(int patientId, string receiptId, string userId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Đồng bộ chi phí và hóa đơn kế hoạch điều trị sau khi hoàn tất một phiên thực hiện dịch vụ.
        /// </summary>
        Task OnSessionChangedAsync(long planId, long stageId, int? doctorId, CancellationToken cancellationToken = default);
    }
}


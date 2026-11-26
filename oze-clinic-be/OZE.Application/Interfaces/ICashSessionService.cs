using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Application.Interfaces
{
    /// <summary>
    /// Service quản lý ca giao dịch tiền mặt của Lễ tân (mở ca, chi tiền lẻ, đóng ca, bàn giao ca và đối soát).
    /// </summary>
    public interface ICashSessionService
    {
        /// <summary>Lấy thông tin ca tiền mặt hiện tại đang mở của nhân viên (null nếu chưa mở ca).</summary>
        Task<CashSessionResponse?> GetCurrentAsync(string userId, CancellationToken cancellationToken = default);

        /// <summary>Mở ca tiền mặt mới đầu ngày hoặc nhận bàn giao từ ca trước.</summary>
        Task<CashSessionResponse> OpenAsync(string userId, OpenCashSessionRequest request, CancellationToken cancellationToken = default);

        /// <summary>Ghi nhận một khoản chi tiền mặt phát sinh trong ca làm việc.</summary>
        Task<CashSessionResponse> AddExpenseAsync(string userId, AddCashExpenseRequest request, CancellationToken cancellationToken = default);

        /// <summary>Xóa khoản chi tiền mặt đã ghi nhận nhầm lẫn trong ca.</summary>
        Task<CashSessionResponse> RemoveExpenseAsync(string userId, long expenseId, CancellationToken cancellationToken = default);

        /// <summary>Đóng ca làm việc hiện tại, kiểm đếm tiền thực tế và kết xuất chênh lệch.</summary>
        Task<CashSessionResponse> CloseAsync(string userId, CloseCashSessionRequest request, CancellationToken cancellationToken = default);

        /// <summary>Lấy danh sách nhân viên khả dụng để bàn giao ca tiếp theo.</summary>
        Task<List<StaffOption>> GetHandoverCandidatesAsync(string userId, CancellationToken cancellationToken = default);

        /// <summary>Lấy thông tin ca kế tiếp chuẩn bị mở dựa trên kết quả ca đóng trước đó.</summary>
        Task<NextCashShiftResponse> GetNextShiftAsync(string userId, CancellationToken cancellationToken = default);

        /// <summary>Lấy chi tiết một phiên ca tiền mặt theo Id (có kiểm tra quyền nhân viên hoặc quản lý).</summary>
        Task<CashSessionResponse> GetByIdAsync(string userId, bool isManager, long id, CancellationToken cancellationToken = default);

        /// <summary>Truy vấn lịch sử các ca tiền mặt phân trang theo bộ lọc tìm kiếm.</summary>
        Task<PagedResult<CashSessionSummaryResponse>> GetPagedAsync(string userId, bool isManager, CashSessionQuery query, CancellationToken cancellationToken = default);
    }
}


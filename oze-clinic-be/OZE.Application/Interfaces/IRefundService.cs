using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    /// <summary>
    /// Service xử lý luồng yêu cầu, phê duyệt và chi trả hoàn tiền (Refund).
    /// </summary>
    public interface IRefundService
    {
        /// <summary>Tạo yêu cầu hoàn tiền cho một hóa đơn từ nhân viên lễ tân.</summary>
        Task<RefundRequestResponse> RequestAsync(
            long invoiceId,
            string requestedByUserId,
            CreateRefundRequest request,
            CancellationToken cancellationToken = default);

        /// <summary>Lấy danh sách các yêu cầu hoàn tiền theo bộ lọc trạng thái và hóa đơn.</summary>
        Task<IReadOnlyList<RefundRequestResponse>> GetListAsync(
            RefundRequestQueryParameters parameters,
            CancellationToken cancellationToken = default);

        /// <summary>Quản lý phòng khám thiết lập giá trị công việc đã thực tế làm để tính trừ số tiền hoàn.</summary>
        Task<RefundRequestResponse> SetWorkDoneAsync(
            long requestId,
            string managerUserId,
            SetWorkDoneAmountRequest request,
            CancellationToken cancellationToken = default);

        /// <summary>Phê duyệt yêu cầu hoàn tiền (dành cho quản lý hoặc ban giám đốc).</summary>
        Task<RefundRequestResponse> ApproveAsync(
            long requestId,
            string approvedByUserId,
            CancellationToken cancellationToken = default);

        /// <summary>Thực hiện chi trả tiền hoàn cho bệnh nhân (dành cho thu ngân/lễ tân).</summary>
        Task<RefundRequestResponse> PayoutAsync(
            long requestId,
            string paidOutByUserId,
            CancellationToken cancellationToken = default);

        /// <summary>Lấy danh sách các yêu cầu hoàn tiền của chính bệnh nhân đang đăng nhập.</summary>
        Task<IReadOnlyList<MyRefundRequestResponse>> GetMyAsync(
            string userId,
            CancellationToken cancellationToken = default);

        /// <summary>Lấy danh sách hóa đơn đủ điều kiện để bệnh nhân gửi yêu cầu hoàn tiền.</summary>
        Task<IReadOnlyList<MyRefundableInvoiceResponse>> GetMyRefundableInvoicesAsync(
            string userId,
            CancellationToken cancellationToken = default);

        /// <summary>Bệnh nhân tự tạo yêu cầu hoàn tiền từ phía cổng thông tin bệnh nhân.</summary>
        Task<MyRefundRequestResponse> RequestMyAsync(
            string userId,
            CreateMyRefundRequest request,
            CancellationToken cancellationToken = default);

        /// <summary>Từ chối yêu cầu hoàn tiền kèm theo lý do từ chối cụ thể.</summary>
        Task<RefundRequestResponse> RejectAsync(
            long requestId,
            string rejectedByUserId,
            RejectRefundRequest request,
            CancellationToken cancellationToken = default);
    }
}


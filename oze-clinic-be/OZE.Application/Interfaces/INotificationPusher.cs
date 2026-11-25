using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    /// <summary>
    /// Đẩy thông báo thời gian thực đến client qua kết nối SignalR mà không cần reload trang.
    /// </summary>
    public interface INotificationPusher
    {
        /// <summary>
        /// Gửi thông báo trực tiếp đến người dùng theo UserId.
        /// </summary>
        /// <param name="userId">Mã định danh người dùng nhận thông báo.</param>
        /// <param name="notification">Dữ liệu thông báo cần đẩy.</param>
        /// <param name="cancellationToken">Token hủy thao tác bất đồng bộ.</param>
        Task PushAsync(string userId, NotificationResponse notification, CancellationToken cancellationToken = default);
    }
}


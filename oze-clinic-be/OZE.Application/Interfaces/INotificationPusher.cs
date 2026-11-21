using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    // Sends a saved notification to the user's open pages at once (SignalR), so the bell does not wait for a reload
    public interface INotificationPusher
    {
        Task PushAsync(string userId, NotificationResponse notification, CancellationToken cancellationToken = default);
    }
}

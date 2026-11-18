using Microsoft.AspNetCore.SignalR;
using OZE.Application.Interfaces;
using OZE.Common.Models;

namespace OZE.Hubs
{
    public class SignalRNotificationPusher : INotificationPusher
    {
        private readonly IHubContext<NotificationHub> _hub;

        public SignalRNotificationPusher(IHubContext<NotificationHub> hub)
        {
            _hub = hub;
        }

        public Task PushAsync(string userId, NotificationResponse notification, CancellationToken cancellationToken = default) =>
            _hub.Clients.User(userId).SendAsync(NotificationHub.NotificationEvent, notification, cancellationToken);
    }
}

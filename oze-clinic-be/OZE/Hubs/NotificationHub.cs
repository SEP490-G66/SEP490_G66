using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace OZE.Hubs
{
    // Signed-in users connect here to receive their new notifications at once ("notification" event).
    // Nothing is sent from the browser; each user is addressed by the account id of the token.
    [Authorize]
    public class NotificationHub : Hub
    {
        public const string Path = "/hubs/notifications";
        public const string NotificationEvent = "notification";
    }
}

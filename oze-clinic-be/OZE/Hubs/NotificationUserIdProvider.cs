using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace OZE.Hubs
{
    // The account id of the token, the same claim the controllers read as the current user
    public class NotificationUserIdProvider : IUserIdProvider
    {
        public string? GetUserId(HubConnectionContext connection) =>
            connection.User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? connection.User?.FindFirstValue("sub");
    }
}

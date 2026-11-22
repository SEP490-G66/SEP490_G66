namespace OZE.Application.Interfaces
{
    public interface ISmsSender
    {
        Task SendSmsAsync(string toPhoneNumber, string message);

        /// <summary>
        /// Sends one SMS and returns what eSMS answered instead of throwing. Used by the manager's SMS test.
        /// </summary>
        Task<OZE.Common.Models.SmsSendResult> TrySendSmsAsync(string toPhoneNumber, string message);
    }
}

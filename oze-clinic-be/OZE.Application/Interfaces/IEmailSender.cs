namespace OZE.Application.Interfaces
{
    public interface IEmailSender
    {
        Task SendEmailAsync(string toEmail, string subject, string message);

        /// <summary>
        /// Sends one email and returns what happened instead of throwing. Used by the manager's email test.
        /// </summary>
        Task<OZE.Common.Models.EmailSendResult> TrySendEmailAsync(string toEmail, string subject, string message);
    }
}

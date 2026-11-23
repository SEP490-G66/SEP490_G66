using System.Net;
using System.Text.RegularExpressions;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Common.Models;

namespace OZE.Application.Services
{
    public class EmailSender : IEmailSender
    {
        private readonly AuthMessageSenderOptions _options;
        private readonly ILogger<EmailSender> _logger;

        public EmailSender(
            IOptions<AuthMessageSenderOptions> optionsAccessor,
            ILogger<EmailSender> logger)
        {
            _options = optionsAccessor.Value;
            _logger = logger;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string message)
        {
            var result = await TrySendEmailAsync(toEmail, subject, message);
            if (!result.Configured || result.Sent)
            {
                return;
            }

            throw new Exception(result.ErrorMessage ?? "Email sending failed.");
        }

        public async Task<EmailSendResult> TrySendEmailAsync(string toEmail, string subject, string message)
        {
            var result = new EmailSendResult
            {
                ToEmail = toEmail,
                Subject = subject
            };

            if (string.IsNullOrWhiteSpace(_options.Host)
                || string.IsNullOrWhiteSpace(_options.UserName)
                || string.IsNullOrWhiteSpace(_options.Password)
                || string.IsNullOrWhiteSpace(_options.SenderEmail))
            {
                _logger.LogWarning(
                    "Email SMTP is not configured (Host/UserName/Password/SenderEmail). Email to {ToEmail} with subject '{Subject}' was not sent. Body: {Message}",
                    toEmail, subject, message);
                return result;
            }

            result.Configured = true;

            var mime = new MimeMessage();
            mime.From.Add(new MailboxAddress(_options.SenderName, _options.SenderEmail.Trim()));
            mime.To.Add(MailboxAddress.Parse(toEmail.Trim()));
            mime.Subject = subject;
            var isHtml = message.Contains('<') && message.Contains('>');
            var builder = new BodyBuilder
            {
                HtmlBody = isHtml ? message : null,
                TextBody = isHtml ? HtmlToPlainText(message) : message
            };
            TryAttachBrandLogo(builder, message, isHtml);
            mime.Body = builder.ToMessageBody();

            try
            {
                using var client = new SmtpClient();
                var secure = _options.UseStartTls ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto;
                await client.ConnectAsync(_options.Host.Trim(), _options.Port > 0 ? _options.Port : 587, secure);
                await client.AuthenticateAsync(_options.UserName.Trim(), _options.Password);
                await client.SendAsync(mime);
                await client.DisconnectAsync(true);

                result.Sent = true;
                result.HttpStatus = 250;
                _logger.LogInformation("Email sent via SMTP to {ToEmail} subject '{Subject}'", toEmail, subject);
            }
            catch (Exception ex)
            {
                result.ErrorMessage = ex.Message;
                _logger.LogError(ex, "Failed to send email via SMTP to {ToEmail}", toEmail);
            }

            return result;
        }

        private void TryAttachBrandLogo(BodyBuilder builder, string message, bool isHtml)
        {
            if (!isHtml || !message.Contains($"cid:{PatientEmailTemplates.LogoContentId}", StringComparison.Ordinal))
            {
                return;
            }

            var logoPath = Path.Combine(AppContext.BaseDirectory, "Assets", "Email", "logo.png");
            if (!File.Exists(logoPath))
            {
                _logger.LogWarning("Email brand logo missing at {LogoPath}; sending HTML without inline image", logoPath);
                return;
            }

            var image = builder.LinkedResources.Add(logoPath);
            image.ContentId = PatientEmailTemplates.LogoContentId;
            image.ContentDisposition = new ContentDisposition(ContentDisposition.Inline);
        }

        private static string HtmlToPlainText(string html)
        {
            var text = Regex.Replace(html, "<style[\\s\\S]*?</style>", string.Empty, RegexOptions.IgnoreCase);
            text = Regex.Replace(text, "<br\\s*/?>", "\n", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, "</(p|div|tr|h[1-6]|li)>", "\n", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, "<[^>]+>", string.Empty);
            text = WebUtility.HtmlDecode(text);
            text = Regex.Replace(text, "[ \\t]+", " ");
            text = Regex.Replace(text, "(\\r?\\n){3,}", "\n\n");
            return text.Trim();
        }
    }
}

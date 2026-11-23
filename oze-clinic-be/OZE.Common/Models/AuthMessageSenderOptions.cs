namespace OZE.Common.Models
{
    /// <summary>
    /// SMTP settings for outbound email (Brevo smtp-relay.brevo.com, etc.).
    /// </summary>
    public class AuthMessageSenderOptions
    {
        public string Host { get; set; } = "smtp-relay.brevo.com";

        public int Port { get; set; } = 587;

        /// <summary>SMTP login (Brevo: often *.@smtp-brevo.com).</summary>
        public string? UserName { get; set; }

        /// <summary>SMTP key / password from Brevo.</summary>
        public string? Password { get; set; }

        /// <summary>Must be a sender address verified in Brevo (not the SMTP login).</summary>
        public string SenderEmail { get; set; } = string.Empty;

        public string SenderName { get; set; } = "OZE Support";

        public bool UseStartTls { get; set; } = true;
    }
}

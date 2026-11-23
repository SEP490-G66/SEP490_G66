namespace OZE.Common.Models
{
    /// <summary>
    /// Outcome of one outbound email attempt. Never carries the SMTP password.
    /// </summary>
    public class EmailSendResult
    {
        /// <summary>False when Host/UserName/Password/SenderEmail are missing.</summary>
        public bool Configured { get; set; }

        public bool Sent { get; set; }

        public int? HttpStatus { get; set; }

        public string? ErrorMessage { get; set; }

        public string ToEmail { get; set; } = string.Empty;

        public string Subject { get; set; } = string.Empty;
    }

    public class EmailTestRequest
    {
        public string ToEmail { get; set; } = string.Empty;

        public string? Subject { get; set; }

        public string? Message { get; set; }
    }
}

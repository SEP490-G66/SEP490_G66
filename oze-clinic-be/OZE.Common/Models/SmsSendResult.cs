namespace OZE.Common.Models
{
    /// <summary>
    /// What happened when one SMS was handed to eSMS. Never carries the API key or secret key.
    /// </summary>
    public class SmsSendResult
    {
        /// <summary>False when ApiKey/SecretKey are empty: nothing was sent, the message was only logged.</summary>
        public bool Configured { get; set; }

        /// <summary>True only when eSMS answered CodeResult 100.</summary>
        public bool Sent { get; set; }

        /// <summary>HTTP status of the eSMS call, null when the call did not complete.</summary>
        public int? HttpStatus { get; set; }

        /// <summary>eSMS CodeResult, e.g. 100 = accepted, 101 = wrong ApiKey/SecretKey.</summary>
        public string? CodeResult { get; set; }

        public string? ErrorMessage { get; set; }

        public string? SmsId { get; set; }

        /// <summary>Number in the format sent to eSMS (0xxxxxxxxx).</summary>
        public string Phone { get; set; } = string.Empty;

        public string Content { get; set; } = string.Empty;

        public string Brandname { get; set; } = string.Empty;

        public string SmsType { get; set; } = string.Empty;

        public string Sandbox { get; set; } = string.Empty;
    }

    public class SmsTestRequest
    {
        /// <summary>Phone number that receives the test SMS.</summary>
        public string PhoneNumber { get; set; } = string.Empty;

        /// <summary>"otp" (sign-up / phone change template) or "reset" (password reset template).</summary>
        public string Purpose { get; set; } = "otp";
    }
}

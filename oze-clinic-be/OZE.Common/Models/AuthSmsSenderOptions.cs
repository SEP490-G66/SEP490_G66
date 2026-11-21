namespace OZE.Common.Models
{
    public class AuthSmsSenderOptions
    {
        public string? ApiKey { get; set; }

        public string? SecretKey { get; set; }

        /// <summary>
        /// Registered eSMS Brandname (carrier-approved sender name).
        /// </summary>
        public string Brandname { get; set; } = string.Empty;

        /// <summary>
        /// eSMS type: 2 = CSKH / OTP Brandname.
        /// </summary>
        public string SmsType { get; set; } = "2";

        /// <summary>
        /// 0 = no diacritics, 1 = Unicode (Vietnamese with tones).
        /// </summary>
        public string IsUnicode { get; set; } = "0";

        /// <summary>
        /// 1 = sandbox (no real SMS, no charge), 0 = live send.
        /// </summary>
        public string Sandbox { get; set; } = "1";
    }
}

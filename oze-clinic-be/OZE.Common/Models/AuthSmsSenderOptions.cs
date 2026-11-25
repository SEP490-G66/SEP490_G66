using System.Globalization;

namespace OZE.Common.Models
{
    public class AuthSmsSenderOptions
    {
        public const string DefaultOtpTemplate = "Ma OTP OZE cua ban la {otp}. Hieu luc {minutes} phut.";
        public const string DefaultResetPasswordOtpTemplate = "Ma dat lai mat khau OZE cua ban la {otp}. Hieu luc {minutes} phut.";

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

        /// <summary>
        /// SMS text for the sign-up and phone-change OTP. {otp} and {minutes} are filled in.
        /// With a Brandname the text must match the template approved for it, word for word.
        /// </summary>
        public string OtpTemplate { get; set; } = DefaultOtpTemplate;

        /// <summary>
        /// SMS text for the password reset OTP. {otp} and {minutes} are filled in.
        /// </summary>
        public string ResetPasswordOtpTemplate { get; set; } = DefaultResetPasswordOtpTemplate;

        /// <summary>
        /// Fills {otp} and {minutes} into the template; an empty template falls back to the default text.
        /// </summary>
        public static string RenderOtp(string? template, string fallback, string otp, int minutes)
        {
            var text = string.IsNullOrWhiteSpace(template) ? fallback : template;
            return text
                .Replace("{otp}", otp, StringComparison.Ordinal)
                .Replace("{minutes}", minutes.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal);
        }
    }
}

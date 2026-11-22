using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    /// <summary>
    /// Lets the clinic manager send one test SMS with the configured OTP template and see eSMS's answer
    /// (CodeResult, error message), so SMS settings on the server can be checked without reading server logs.
    /// </summary>
    [Route("api/sms")]
    [Authorize(Roles = RoleConstants.ClinicManagerRole)]
    public partial class SmsTestController : BaseApiController
    {
        private readonly ISmsSender _smsSender;
        private readonly AuthSmsSenderOptions _smsOptions;
        private readonly RegisterOtpSettings _otpSettings;

        public SmsTestController(
            ISmsSender smsSender,
            IOptions<AuthSmsSenderOptions> smsOptions,
            IOptions<RegisterOtpSettings> otpSettings)
        {
            _smsSender = smsSender;
            _smsOptions = smsOptions.Value;
            _otpSettings = otpSettings.Value;
        }

        /// <summary>
        /// Sends a test OTP SMS to the given number. Purpose "otp" uses OtpTemplate, "reset" uses ResetPasswordOtpTemplate.
        /// A real SMS is sent (and charged) when Sandbox is 0. The response never contains the API keys.
        /// </summary>
        [HttpPost("test")]
        public async Task<ActionResult<ApiResponse<SmsSendResult>>> SendTestAsync([FromBody] SmsTestRequest request)
        {
            var phone = request.PhoneNumber?.Trim() ?? string.Empty;
            if (!PhonePattern().IsMatch(phone))
            {
                return BadRequest(ApiResponse<SmsSendResult>.FailureResult("Phone number is invalid."));
            }

            var reset = string.Equals(request.Purpose?.Trim(), "reset", StringComparison.OrdinalIgnoreCase);
            var minutes = _otpSettings.ExpiresInMinutes > 0 ? _otpSettings.ExpiresInMinutes : 5;
            var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            var message = reset
                ? AuthSmsSenderOptions.RenderOtp(_smsOptions.ResetPasswordOtpTemplate, AuthSmsSenderOptions.DefaultResetPasswordOtpTemplate, code, minutes)
                : AuthSmsSenderOptions.RenderOtp(_smsOptions.OtpTemplate, AuthSmsSenderOptions.DefaultOtpTemplate, code, minutes);

            var result = await _smsSender.TrySendSmsAsync(phone, message);
            var summary = !result.Configured
                ? "SMS is not configured (ApiKey/SecretKey empty); nothing was sent."
                : result.Sent
                    ? "eSMS accepted the SMS (CodeResult 100)."
                    : $"eSMS did not accept the SMS (CodeResult {result.CodeResult ?? "none"}).";
            return Ok(ApiResponse<SmsSendResult>.SuccessResult(result, summary));
        }

        [GeneratedRegex(@"^\+?\d{9,12}$")]
        private static partial Regex PhonePattern();
    }
}

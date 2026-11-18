using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OZE.Application.Interfaces;
using OZE.Common.Models;

namespace OZE.Application.Services
{
    public class SmsSender : ISmsSender
    {
        private const string SendPath = "index.php/sms/send";

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        private readonly HttpClient _httpClient;
        private readonly AuthSmsSenderOptions _options;
        private readonly ILogger<SmsSender> _logger;

        public SmsSender(
            HttpClient httpClient,
            IOptions<AuthSmsSenderOptions> optionsAccessor,
            ILogger<SmsSender> logger)
        {
            _httpClient = httpClient;
            _options = optionsAccessor.Value;
            _logger = logger;
        }

        public async Task SendSmsAsync(string toPhoneNumber, string message)
        {
            if (string.IsNullOrWhiteSpace(_options.AccessToken))
            {
                _logger.LogWarning(
                    "SMS is not configured. Message to {Phone} was not sent via network. Body: {Message}",
                    toPhoneNumber,
                    message);
                return;
            }

            var phone = NormalizeForSpeedSms(toPhoneNumber);
            var smsType = _options.SmsType > 0 ? _options.SmsType : 4;
            var sender = string.IsNullOrWhiteSpace(_options.Sender) ? "Verify" : _options.Sender.Trim();

            var url = QueryHelpers.AddQueryString(SendPath, new Dictionary<string, string?>
            {
                ["access-token"] = _options.AccessToken.Trim(),
                ["to"] = phone,
                ["content"] = message,
                ["type"] = smsType.ToString(),
                ["sender"] = sender
            });

            using var response = await _httpClient.GetAsync(url);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "SpeedSMS HTTP {StatusCode} when sending to {Phone}: {Body}",
                    (int)response.StatusCode,
                    phone,
                    body);
                throw new Exception($"SMS sending failed: HTTP {(int)response.StatusCode}");
            }

            SpeedSmsSendResponse? result;
            try
            {
                result = JsonSerializer.Deserialize<SpeedSmsSendResponse>(body, JsonOptions);
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "SpeedSMS returned invalid JSON when sending to {Phone}: {Body}", phone, body);
                throw new Exception("SMS sending failed: invalid response from SpeedSMS");
            }

            if (result == null
                || !string.Equals(result.Status, "success", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(result.Code, "00", StringComparison.OrdinalIgnoreCase))
            {
                var code = result?.Code ?? "unknown";
                var errorMessage = result?.Message ?? body;
                _logger.LogError(
                    "Failed to send SMS via SpeedSMS: {Code} {Message}",
                    code,
                    errorMessage);
                throw new Exception($"SMS sending failed: {code} {errorMessage}");
            }
        }

        /// <summary>
        /// SpeedSMS expects 84xxxxxxxxx (no leading +). App stores E.164 as +84...
        /// </summary>
        internal static string NormalizeForSpeedSms(string phoneNumber)
        {
            var trimmed = phoneNumber.Trim();
            if (trimmed.StartsWith('+'))
            {
                return trimmed[1..];
            }

            if (trimmed.StartsWith('0') && trimmed.Length >= 10)
            {
                return "84" + trimmed[1..];
            }

            return trimmed;
        }

        private sealed class SpeedSmsSendResponse
        {
            [JsonPropertyName("status")]
            public string? Status { get; set; }

            [JsonPropertyName("code")]
            public string? Code { get; set; }

            [JsonPropertyName("message")]
            public string? Message { get; set; }
        }
    }
}

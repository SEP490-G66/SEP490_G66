using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OZE.Application.Interfaces;
using OZE.Common.Models;

namespace OZE.Application.Services
{
    public class SmsSender : ISmsSender
    {
        private const string SendPath = "MainService.svc/json/SendMultipleMessage_V4_post_json/";

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
            if (string.IsNullOrWhiteSpace(_options.ApiKey)
                || string.IsNullOrWhiteSpace(_options.SecretKey))
            {
                _logger.LogWarning(
                    "SMS is not configured. Message to {Phone} was not sent via network. Body: {Message}",
                    toPhoneNumber,
                    message);
                return;
            }

            var phone = NormalizeForEsms(toPhoneNumber);
            var smsType = string.IsNullOrWhiteSpace(_options.SmsType) ? "2" : _options.SmsType.Trim();
            var isUnicode = string.IsNullOrWhiteSpace(_options.IsUnicode) ? "0" : _options.IsUnicode.Trim();
            var sandbox = string.IsNullOrWhiteSpace(_options.Sandbox) ? "1" : _options.Sandbox.Trim();
            var brandname = _options.Brandname?.Trim() ?? string.Empty;

            var payload = new
            {
                ApiKey = _options.ApiKey.Trim(),
                SecretKey = _options.SecretKey.Trim(),
                Phone = phone,
                Content = message,
                Brandname = brandname,
                SmsType = smsType,
                IsUnicode = isUnicode,
                Sandbox = sandbox
            };

            using var response = await _httpClient.PostAsJsonAsync(SendPath, payload);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "eSMS HTTP {StatusCode} when sending to {Phone}: {Body}",
                    (int)response.StatusCode,
                    phone,
                    body);
                throw new Exception($"SMS sending failed: HTTP {(int)response.StatusCode}");
            }

            EsmsSendResponse? result;
            try
            {
                result = JsonSerializer.Deserialize<EsmsSendResponse>(body, JsonOptions);
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "eSMS returned invalid JSON when sending to {Phone}: {Body}", phone, body);
                throw new Exception("SMS sending failed: invalid response from eSMS");
            }

            if (result == null || !string.Equals(result.CodeResult, "100", StringComparison.OrdinalIgnoreCase))
            {
                var code = result?.CodeResult ?? "unknown";
                var errorMessage = result?.ErrorMessage ?? body;
                _logger.LogError(
                    "Failed to send SMS via eSMS: {Code} {Message}",
                    code,
                    errorMessage);
                throw new Exception($"SMS sending failed: {code} {errorMessage}");
            }
        }

        /// <summary>
        /// eSMS docs use national VN numbers (0xxxxxxxxx). App stores E.164 as +84...
        /// </summary>
        internal static string NormalizeForEsms(string phoneNumber)
        {
            var trimmed = phoneNumber.Trim();
            if (trimmed.StartsWith('+'))
            {
                trimmed = trimmed[1..];
            }

            if (trimmed.StartsWith("84") && trimmed.Length >= 11)
            {
                return "0" + trimmed[2..];
            }

            return trimmed;
        }

        private sealed class EsmsSendResponse
        {
            [JsonPropertyName("CodeResult")]
            public string? CodeResult { get; set; }

            [JsonPropertyName("SMSID")]
            public string? SmsId { get; set; }

            [JsonPropertyName("ErrorMessage")]
            public string? ErrorMessage { get; set; }
        }
    }
}

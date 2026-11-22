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

        // eSMS matches field names case-sensitively (ApiKey, SecretKey, ...). PostAsJsonAsync would
        // camelCase them by default (apiKey), which eSMS answers with 101 "Authorize Failed".
        private static readonly JsonSerializerOptions RequestJsonOptions = new()
        {
            PropertyNamingPolicy = null
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
            var result = await TrySendSmsAsync(toPhoneNumber, message);
            if (!result.Configured || result.Sent)
            {
                return;
            }

            if (result.HttpStatus is int status && (status < 200 || status > 299))
            {
                throw new Exception($"SMS sending failed: HTTP {status}");
            }

            throw new Exception($"SMS sending failed: {result.CodeResult ?? "unknown"} {result.ErrorMessage}");
        }

        public async Task<SmsSendResult> TrySendSmsAsync(string toPhoneNumber, string message)
        {
            var result = new SmsSendResult
            {
                Phone = NormalizeForEsms(toPhoneNumber),
                Content = message,
                Brandname = _options.Brandname?.Trim() ?? string.Empty,
                SmsType = string.IsNullOrWhiteSpace(_options.SmsType) ? "2" : _options.SmsType.Trim(),
                Sandbox = string.IsNullOrWhiteSpace(_options.Sandbox) ? "1" : _options.Sandbox.Trim()
            };

            if (string.IsNullOrWhiteSpace(_options.ApiKey)
                || string.IsNullOrWhiteSpace(_options.SecretKey))
            {
                _logger.LogWarning(
                    "SMS is not configured. Message to {Phone} was not sent via network. Body: {Message}",
                    toPhoneNumber,
                    message);
                return result;
            }

            result.Configured = true;
            var payload = new
            {
                ApiKey = _options.ApiKey.Trim(),
                SecretKey = _options.SecretKey.Trim(),
                Phone = result.Phone,
                Content = message,
                Brandname = result.Brandname,
                SmsType = result.SmsType,
                IsUnicode = string.IsNullOrWhiteSpace(_options.IsUnicode) ? "0" : _options.IsUnicode.Trim(),
                Sandbox = result.Sandbox
            };

            string body;
            try
            {
                using var response = await _httpClient.PostAsJsonAsync(SendPath, payload, RequestJsonOptions);
                result.HttpStatus = (int)response.StatusCode;
                body = await response.Content.ReadAsStringAsync();
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "Could not reach eSMS when sending to {Phone}", result.Phone);
                result.ErrorMessage = "Could not reach eSMS: " + ex.Message;
                return result;
            }

            if (result.HttpStatus is < 200 or > 299)
            {
                _logger.LogError("eSMS HTTP {StatusCode} when sending to {Phone}: {Body}", result.HttpStatus, result.Phone, body);
                result.ErrorMessage = body;
                return result;
            }

            EsmsSendResponse? answer;
            try
            {
                answer = JsonSerializer.Deserialize<EsmsSendResponse>(body, JsonOptions);
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "eSMS returned invalid JSON when sending to {Phone}: {Body}", result.Phone, body);
                result.ErrorMessage = "Invalid response from eSMS: " + body;
                return result;
            }

            result.CodeResult = answer?.CodeResult;
            result.SmsId = answer?.SmsId;
            result.ErrorMessage = answer?.ErrorMessage;
            result.Sent = string.Equals(answer?.CodeResult, "100", StringComparison.OrdinalIgnoreCase);
            if (!result.Sent)
            {
                result.ErrorMessage ??= body;
                _logger.LogError("Failed to send SMS via eSMS: {Code} {Message}", result.CodeResult ?? "unknown", result.ErrorMessage);
            }

            return result;
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

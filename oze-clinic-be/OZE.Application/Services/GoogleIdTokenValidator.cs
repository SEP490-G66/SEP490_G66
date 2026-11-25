using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Google.Apis.Auth;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OZE.Application.Interfaces;
using OZE.Common.Models;

namespace OZE.Application.Services
{
    public class GoogleIdTokenValidator : IGoogleIdTokenValidator
    {
        private readonly GoogleAuthSettings _settings;
        private readonly ILogger<GoogleIdTokenValidator> _logger;
        private readonly HttpClient _httpClient;

        public GoogleIdTokenValidator(
            IOptions<GoogleAuthSettings> options,
            ILogger<GoogleIdTokenValidator> logger,
            HttpClient httpClient)
        {
            _settings = options.Value;
            _logger = logger;
            _httpClient = httpClient;
        }

        public async Task<GoogleIdTokenPayload?> ValidateAsync(string idToken, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(_settings.ClientId))
            {
                _logger.LogError("GoogleAuth:ClientId is not configured");
                return null;
            }

            if (string.IsNullOrWhiteSpace(idToken))
            {
                return null;
            }

            try
            {
                var settings = new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { _settings.ClientId }
                };
                var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
                return new GoogleIdTokenPayload
                {
                    Subject = payload.Subject,
                    Email = payload.Email ?? string.Empty,
                    EmailVerified = payload.EmailVerified,
                    Name = payload.Name
                };
            }
            catch (InvalidJwtException ex)
            {
                _logger.LogWarning(ex, "Google ID token validation failed");
                return null;
            }
        }

        public async Task<GoogleIdTokenPayload?> ResolveAccessTokenAsync(
            string accessToken, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(_settings.ClientId))
            {
                _logger.LogError("GoogleAuth:ClientId is not configured");
                return null;
            }

            if (string.IsNullOrWhiteSpace(accessToken))
            {
                return null;
            }

            try
            {
                using var request = new HttpRequestMessage(
                    HttpMethod.Get, "https://www.googleapis.com/oauth2/v3/userinfo");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

                using var response = await _httpClient.SendAsync(request, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "Google userinfo request failed with status {StatusCode}", (int)response.StatusCode);
                    return null;
                }

                var info = await response.Content.ReadFromJsonAsync<GoogleUserInfoResponse>(cancellationToken);
                if (info == null || string.IsNullOrWhiteSpace(info.Sub) || string.IsNullOrWhiteSpace(info.Email))
                {
                    return null;
                }

                return new GoogleIdTokenPayload
                {
                    Subject = info.Sub,
                    Email = info.Email,
                    EmailVerified = info.EmailVerified,
                    Name = info.Name
                };
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                _logger.LogWarning(ex, "Google userinfo request failed");
                return null;
            }
        }

        private sealed class GoogleUserInfoResponse
        {
            [JsonPropertyName("sub")]
            public string? Sub { get; set; }

            [JsonPropertyName("email")]
            public string? Email { get; set; }

            [JsonPropertyName("email_verified")]
            public bool EmailVerified { get; set; }

            [JsonPropertyName("name")]
            public string? Name { get; set; }
        }
    }
}

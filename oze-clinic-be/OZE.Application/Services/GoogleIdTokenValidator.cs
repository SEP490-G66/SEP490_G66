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

        public GoogleIdTokenValidator(IOptions<GoogleAuthSettings> options, ILogger<GoogleIdTokenValidator> logger)
        {
            _settings = options.Value;
            _logger = logger;
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
    }
}

namespace OZE.Application.Interfaces
{
    public sealed class GoogleIdTokenPayload
    {
        public string Subject { get; init; } = string.Empty;
        public string Email { get; init; } = string.Empty;
        public bool EmailVerified { get; init; }
        public string? Name { get; init; }
    }

    public interface IGoogleIdTokenValidator
    {
        /// <summary>Validates a Google ID token and returns claims, or null when invalid/misconfigured.</summary>
        Task<GoogleIdTokenPayload?> ValidateAsync(string idToken, CancellationToken cancellationToken = default);
    }
}

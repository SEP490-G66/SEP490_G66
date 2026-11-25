namespace OZE.Common.Models
{
    public class GoogleLoginRequest
    {
        /// <summary>Google ID token from GIS credential button (optional if AccessToken is set).</summary>
        public string? IdToken { get; set; }

        /// <summary>Google OAuth access token from popup token client (optional if IdToken is set).</summary>
        public string? AccessToken { get; set; }
    }
}

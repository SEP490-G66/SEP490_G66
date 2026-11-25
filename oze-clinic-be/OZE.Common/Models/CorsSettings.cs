namespace OZE.Common.Models
{
    // Browser origins allowed to call the API and the notification hub (no wildcards).
    public class CorsSettings
    {
        public const string SectionName = "Cors";

        public string[] AllowedOrigins { get; set; } = Array.Empty<string>();
    }
}

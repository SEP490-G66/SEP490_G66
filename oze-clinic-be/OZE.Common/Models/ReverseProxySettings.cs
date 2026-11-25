namespace OZE.Common.Models
{
    // Settings for running behind Nginx (or another reverse proxy) that terminates HTTPS.
    public class ReverseProxySettings
    {
        public const string SectionName = "ReverseProxy";

        // Proxy addresses that may send X-Forwarded-For / X-Forwarded-Proto (e.g. Docker bridge gateway).
        public string[] KnownProxies { get; set; } = Array.Empty<string>();

        // When false, Nginx (or the edge) owns HTTP→HTTPS redirects; ASP.NET Core does not redirect.
        // Default true keeps Local Development and Azure behavior when the key is omitted.
        public bool UseHttpsRedirection { get; set; } = true;
    }
}

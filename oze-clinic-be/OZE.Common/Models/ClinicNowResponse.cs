namespace OZE.Common.Models
{
    // The clinic's current time as the server sees it (a fake time when Clinic:FakeNow is set)
    public class ClinicNowResponse
    {
        // The current moment in UTC; the frontend keeps its offset from the browser clock
        public DateTimeOffset UtcNow { get; set; }

        // Clinic wall-clock time (Vietnam), for example 2026-11-29T16:55:00
        public string ClinicTime { get; set; } = string.Empty;

        // Clinic calendar date, for example 2026-11-29
        public string Today { get; set; } = string.Empty;

        public string TimeZone { get; set; } = string.Empty;

        // True when the clock is fake (dev/staging testing)
        public bool IsFake { get; set; }

        // True when the fake time stands still; the frontend then holds its clock still too
        public bool IsFrozen { get; set; }
    }
}

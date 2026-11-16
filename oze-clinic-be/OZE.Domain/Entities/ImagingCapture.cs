namespace OZE.Domain.Entities
{
    // One capture of an imaging request on the X-ray simulator: who started it, on which device, and how it went
    public class ImagingCapture
    {
        public long Id { get; set; }
        public long ImagingRequestId { get; set; }
        public int TechnicianId { get; set; }
        public string SimulationId { get; set; } = string.Empty;
        public string DeviceId { get; set; } = string.Empty;
        public string Modality { get; set; } = string.Empty;
        public string? BodyRegion { get; set; }
        public int ImageCount { get; set; } = 1;
        public double? Kv { get; set; }
        public double? Ma { get; set; }
        public double? ExposureSeconds { get; set; }
        public string Status { get; set; } = "ACCEPTED";
        public int Progress { get; set; }
        public string? FailureCode { get; set; }
        public string? FailureMessage { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }
        public DateTimeOffset? CompletedAt { get; set; }

        public virtual ImagingRequest ImagingRequest { get; set; } = null!;
        public virtual StaffProfile Technician { get; set; } = null!;
    }
}

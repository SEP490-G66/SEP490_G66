namespace OZE.Common.Models
{
    // Filters of the technician's "Lịch sử chụp chiếu": imaging requests that are done (Completed) or were cancelled.
    public class ImagingHistoryQuery
    {
        // Patient name, patient code or the order code "IR-123"
        public string? Keyword { get; set; }
        public string? ImagingType { get; set; }
        // Completed or Cancelled; empty for both
        public string? Status { get; set; }
        // Clinic days (Vietnam time) the doctor sent the order
        public DateOnly? From { get; set; }
        public DateOnly? To { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
    }

    // One row of the history table
    public class ImagingHistoryItemResponse
    {
        public long Id { get; set; }
        public string Status { get; set; } = string.Empty;
        public int PatientId { get; set; }
        public string PatientName { get; set; } = string.Empty;
        public string PatientCode { get; set; } = string.Empty;
        public string ImagingType { get; set; } = string.Empty;
        public string TargetArea { get; set; } = string.Empty;
        public string DoctorName { get; set; } = string.Empty;
        // Device of the capture that brought the pictures; null when the pictures were uploaded by hand
        public string? DeviceId { get; set; }
        public int ImageCount { get; set; }
        public string? CancelReason { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? CompletedAt { get; set; }
        public DateTimeOffset? CancelledAt { get; set; }
    }

    // "Chi tiết chụp chiếu": the patient, the doctor's order and the result
    public class ImagingHistoryDetailResponse : ImagingHistoryItemResponse
    {
        public string? Gender { get; set; }
        public DateOnly? BirthDate { get; set; }
        public string ClinicalIndication { get; set; } = string.Empty;
        public string? TechnicianName { get; set; }
        public string? TechnicianNote { get; set; }
        public List<ImagingHistoryImageResponse> Images { get; set; } = new();
    }

    public class ImagingHistoryImageResponse
    {
        public long Id { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string? MimeType { get; set; }
        // GET this with the sign-in token; null for sample pictures that have no file on the server
        public string? FileUrl { get; set; }
        public string ReviewStatus { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
    }
}

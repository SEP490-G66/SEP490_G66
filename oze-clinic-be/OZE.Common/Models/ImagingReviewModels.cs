namespace OZE.Common.Models
{
    // "Duyệt kết quả chụp": one imaging request the doctor ordered, with its pictures
    public class ImagingReviewResponse
    {
        public long Id { get; set; }
        public long ExaminationId { get; set; }
        // Pending (waiting for the doctor), Approved, Retake (sent back for a new capture), Cancelled
        public string Status { get; set; } = string.Empty;
        public string ImagingType { get; set; } = string.Empty;
        public string TargetArea { get; set; } = string.Empty;
        public string ClinicalIndication { get; set; } = string.Empty;
        public string? TechnicianName { get; set; }
        public string? RetakeReason { get; set; }
        public DateTimeOffset OrderedAt { get; set; }
        public DateTimeOffset? CapturedAt { get; set; }
        public DateTimeOffset? ReviewedAt { get; set; }
        public ImagingReviewPatientResponse Patient { get; set; } = new();
        public List<ImagingHistoryImageResponse> Images { get; set; } = new();
    }

    public class ImagingReviewPatientResponse
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string? Gender { get; set; }
        public DateOnly? BirthDate { get; set; }
    }

    // The doctor sends the pictures back: they are rejected and a new request goes to the technician
    public class RetakeImagingRequest
    {
        public string? Reason { get; set; }
    }

    // A picture the technician uploads by hand (the controller reads it from the form)
    public record UploadedImagingFile(string FileName, string? ContentType, byte[] Data);
}

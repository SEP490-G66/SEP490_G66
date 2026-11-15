namespace OZE.Common.Models
{
    // Body of POST api/examinations/{id}/addenda
    public class CreateAddendumRequest
    {
        // Correction, Addition or Clarification
        public string? AddendumType { get; set; }
        public string? Content { get; set; }
        // The text being corrected; required for a Correction
        public string? OriginalContent { get; set; }
    }

    public class AddendumResponse
    {
        public long Id { get; set; }
        public string AddendumType { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? OriginalContent { get; set; }
        public int CreatedByDoctorId { get; set; }
        public string CreatedByDoctorName { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
    }
}

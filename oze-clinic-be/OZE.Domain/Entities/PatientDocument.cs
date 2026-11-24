namespace OZE.Domain.Entities
{
    public class PatientDocument
    {
        public long Id { get; set; }
        public int PatientId { get; set; }
        // Set when the patient uploaded the file for a doctor's document request
        public long? DocumentRequestId { get; set; }
        public string? DocumentType { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty;
        public long? FileSize { get; set; }
        public string? MimeType { get; set; }
        public string? Description { get; set; }
        public string? UploadedByUserId { get; set; }
        // A document the patient brought from elsewhere ("Cung cấp tài liệu"): every file of one upload shares
        // UploadGroupId; Description holds the document name, DocumentType is ProvidedDocumentConstants.DocumentType
        public Guid? UploadGroupId { get; set; }
        public string? ProviderAddress { get; set; }
        public DateOnly? PerformedOn { get; set; }
        public DateTimeOffset CreatedAt { get; set; }

        public virtual Patient Patient { get; set; } = null!;
        public virtual DocumentRequest? DocumentRequest { get; set; }
    }
}

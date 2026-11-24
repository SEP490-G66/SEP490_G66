namespace OZE.Common.Models
{
    /// <summary>Thông tin tài liệu bệnh nhân tự cung cấp (gửi kèm các tệp trong form multipart).</summary>
    public class CreateProvidedDocumentRequest
    {
        public string? DocumentName { get; set; }
        public DateOnly? PerformedOn { get; set; }
        public string? ProviderAddress { get; set; }
    }

    /// <summary>Một tài liệu bệnh nhân tự cung cấp: các tệp của cùng một lần tải lên.</summary>
    public class ProvidedDocumentResponse
    {
        // The UploadGroupId shared by the files
        public Guid Id { get; set; }
        public string DocumentName { get; set; } = string.Empty;
        public DateOnly? PerformedOn { get; set; }
        public string ProviderAddress { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
        public List<DocumentRequestFileResponse> Files { get; set; } = new();
    }
}

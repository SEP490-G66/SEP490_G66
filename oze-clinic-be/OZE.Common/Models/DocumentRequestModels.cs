namespace OZE.Common.Models
{
    /// <summary>Yêu cầu tạo mới đề nghị bổ sung tài liệu khám bệnh.</summary>
    public class CreateDocumentRequest
    {
        public string? DocumentName { get; set; }
        public string? Note { get; set; }
    }

    /// <summary>Dữ liệu phản hồi thông tin yêu cầu bổ sung tài liệu y tế.</summary>
    public class DocumentRequestResponse
    {
        public long Id { get; set; }
        public long ExaminationId { get; set; }
        // When the visit of the request took place
        public DateTimeOffset? ExaminationDate { get; set; }
        public int PatientId { get; set; }
        public string DocumentName { get; set; } = string.Empty;
        public string? Note { get; set; }
        public string Status { get; set; } = string.Empty;
        public string DoctorName { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }
        // Doctor list only: the signed-in doctor created it and it is still Pending
        public bool CanCancel { get; set; }
        public List<DocumentRequestFileResponse> Files { get; set; } = new();
    }

    /// <summary>Thông tin tệp tin tài liệu do bệnh nhân tải lên.</summary>
    public class DocumentRequestFileResponse
    {
        public long Id { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string FileUrl { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
    }
}


namespace OZE.Common.Models
{
    /// <summary>Thông tin tài liệu bệnh nhân tự cung cấp (gửi kèm các tệp trong form multipart).</summary>
    public class CreateProvidedDocumentRequest
    {
        /// <summary>Tên loại tài liệu hoặc kết quả khám (ví dụ: Phim X-quang, Xét nghiệm máu).</summary>
        public string? DocumentName { get; set; }

        /// <summary>Ngày thực hiện khám hoặc xét nghiệm tại cơ sở y tế bên ngoài.</summary>
        public DateOnly? PerformedOn { get; set; }

        /// <summary>Tên hoặc địa chỉ cơ sở y tế thực hiện dịch vụ.</summary>
        public string? ProviderAddress { get; set; }
    }

    /// <summary>Một tài liệu bệnh nhân tự cung cấp: các tệp của cùng một lần tải lên.</summary>
    public class ProvidedDocumentResponse
    {
        /// <summary>Mã định danh nhóm tệp tin tải lên (UploadGroupId).</summary>
        public Guid Id { get; set; }

        /// <summary>Tên tài liệu y tế do bệnh nhân đặt.</summary>
        public string DocumentName { get; set; } = string.Empty;

        /// <summary>Ngày chụp hoặc thực hiện xét nghiệm.</summary>
        public DateOnly? PerformedOn { get; set; }

        /// <summary>Cơ sở y tế cấp tài liệu.</summary>
        public string ProviderAddress { get; set; } = string.Empty;

        /// <summary>Thời điểm bệnh nhân tải tài liệu lên hệ thống.</summary>
        public DateTimeOffset CreatedAt { get; set; }

        /// <summary>Danh sách các tệp tin đính kèm thuộc tài liệu này.</summary>
        public List<DocumentRequestFileResponse> Files { get; set; } = new();
    }
}


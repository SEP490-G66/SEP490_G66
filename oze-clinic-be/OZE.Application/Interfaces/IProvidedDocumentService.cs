using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    /// <summary>
    /// Service quản lý tài liệu y tế do bệnh nhân chủ động cung cấp ("Cung cấp tài liệu")
    /// không cần yêu cầu từ bác sĩ (ví dụ: kết quả xét nghiệm, phim X-quang từ viện khác).
    /// </summary>
    public interface IProvidedDocumentService
    {
        /// <summary>Bệnh nhân tải lên và tạo mới tài liệu y tế tự cung cấp.</summary>
        Task<ProvidedDocumentResponse> CreateAsync(string patientUserId, CreateProvidedDocumentRequest request, List<UploadedImagingFile> files, CancellationToken cancellationToken = default);

        /// <summary>Lấy danh sách các tài liệu y tế do chính bệnh nhân đã tải lên.</summary>
        Task<List<ProvidedDocumentResponse>> GetMineAsync(string patientUserId, CancellationToken cancellationToken = default);

        /// <summary>Bệnh nhân xóa tài liệu y tế tự cung cấp theo mã định danh duy nhất (Guid).</summary>
        Task DeleteAsync(string patientUserId, Guid id, CancellationToken cancellationToken = default);

        /// <summary>Bác sĩ xem toàn bộ tài liệu bệnh nhân đã cung cấp liên quan đến buổi khám hiện tại.</summary>
        Task<List<ProvidedDocumentResponse>> GetByExaminationAsync(string doctorUserId, long examinationId, CancellationToken cancellationToken = default);
    }
}


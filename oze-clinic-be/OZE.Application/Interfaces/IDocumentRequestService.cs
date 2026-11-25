using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    /// <summary>
    /// Service quản lý các yêu cầu bổ sung tài liệu khám bệnh giữa Bác sĩ và Bệnh nhân.
    /// </summary>
    public interface IDocumentRequestService
    {
        /// <summary>Bác sĩ tạo yêu cầu bệnh nhân cung cấp thêm tài liệu y tế cho buổi khám.</summary>
        Task<DocumentRequestResponse> CreateAsync(string doctorUserId, long examinationId, CreateDocumentRequest request, CancellationToken cancellationToken = default);

        /// <summary>Lấy danh sách các yêu cầu bổ sung tài liệu thuộc về một buổi khám bệnh.</summary>
        Task<List<DocumentRequestResponse>> GetByExaminationAsync(string doctorUserId, long examinationId, CancellationToken cancellationToken = default);

        /// <summary>Lấy danh sách yêu cầu bổ sung tài liệu của bệnh nhân đang đăng nhập.</summary>
        Task<List<DocumentRequestResponse>> GetMineAsync(string patientUserId, long? examinationId, CancellationToken cancellationToken = default);

        /// <summary>Bác sĩ hủy yêu cầu bổ sung tài liệu chưa nộp.</summary>
        Task<DocumentRequestResponse> CancelAsync(string doctorUserId, long id, CancellationToken cancellationToken = default);

        /// <summary>Bệnh nhân tải lên và gửi tài liệu đáp ứng yêu cầu của bác sĩ.</summary>
        Task<DocumentRequestResponse> SubmitAsync(string patientUserId, long id, List<UploadedImagingFile> files, CancellationToken cancellationToken = default);

        /// <summary>Tải tệp tài liệu y tế (có kiểm tra quyền sở hữu hồ sơ bệnh nhân).</summary>
        Task<ImagingFileResult> GetFileAsync(string userId, bool isPatient, long documentId, CancellationToken cancellationToken = default);
    }
}


using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    // Documents the patient uploads from elsewhere without a doctor's request ("Cung cấp tài liệu")
    public interface IProvidedDocumentService
    {
        Task<ProvidedDocumentResponse> CreateAsync(string patientUserId, CreateProvidedDocumentRequest request, List<UploadedImagingFile> files, CancellationToken cancellationToken = default);
        Task<List<ProvidedDocumentResponse>> GetMineAsync(string patientUserId, CancellationToken cancellationToken = default);
        Task DeleteAsync(string patientUserId, Guid id, CancellationToken cancellationToken = default);
        // For the doctor of the examination: every document the patient provided
        Task<List<ProvidedDocumentResponse>> GetByExaminationAsync(string doctorUserId, long examinationId, CancellationToken cancellationToken = default);
    }
}

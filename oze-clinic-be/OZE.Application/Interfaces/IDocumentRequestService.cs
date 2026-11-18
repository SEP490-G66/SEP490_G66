using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    // "Yêu cầu bổ sung tài liệu": documents the doctor asks the patient to submit for an examination
    public interface IDocumentRequestService
    {
        Task<DocumentRequestResponse> CreateAsync(string doctorUserId, long examinationId, CreateDocumentRequest request, CancellationToken cancellationToken = default);
        Task<List<DocumentRequestResponse>> GetByExaminationAsync(string doctorUserId, long examinationId, CancellationToken cancellationToken = default);
        // Requests of the signed-in patient, newest first; only one examination when examinationId is set
        Task<List<DocumentRequestResponse>> GetMineAsync(string patientUserId, long? examinationId, CancellationToken cancellationToken = default);
        Task<DocumentRequestResponse> CancelAsync(string doctorUserId, long id, CancellationToken cancellationToken = default);
        Task<DocumentRequestResponse> SubmitAsync(string patientUserId, long id, List<UploadedImagingFile> files, CancellationToken cancellationToken = default);
        // isPatient: the caller may only open the documents of their own record
        Task<ImagingFileResult> GetFileAsync(string userId, bool isPatient, long documentId, CancellationToken cancellationToken = default);
    }
}

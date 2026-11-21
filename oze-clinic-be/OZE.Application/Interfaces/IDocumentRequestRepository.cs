using OZE.Domain.Entities;

namespace OZE.Application.Interfaces
{
    public interface IDocumentRequestRepository
    {
        // The examination with its patient and doctor
        Task<Examination?> GetExaminationAsync(long examinationId, CancellationToken cancellationToken = default);
        // Requests of a patient with their examination, doctor and files, newest first; only one examination when examinationId is set
        Task<List<DocumentRequest>> GetByPatientIdAsync(int patientId, long? examinationId, CancellationToken cancellationToken = default);
        // A request with its patient, doctor and files, tracked for changes
        Task<DocumentRequest?> GetTrackedByIdAsync(long id, CancellationToken cancellationToken = default);
        // A stored document with its patient
        Task<PatientDocument?> GetDocumentWithPatientAsync(long documentId, CancellationToken cancellationToken = default);
        Task AddAsync(DocumentRequest request, CancellationToken cancellationToken = default);
        void AddDocuments(IEnumerable<PatientDocument> documents);
        Task SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}

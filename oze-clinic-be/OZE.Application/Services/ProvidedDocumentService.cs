using System.Globalization;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.Services
{
    // "Cung cấp tài liệu": the patient uploads a document from elsewhere (test result, old prescription, film...) for the
    // doctors to read, without a request. Kept in PatientDocuments: one row per file, the files of one upload share an
    // UploadGroupId; Description is the document name. The doctor of an examination reads them at step 1.
    public class ProvidedDocumentService : IProvidedDocumentService
    {
        private readonly IDocumentRequestRepository _repository;
        private readonly IStaffRepository _staffRepository;
        private readonly IPatientRepository _patientRepository;
        private readonly IImagingFileStore _fileStore;

        public ProvidedDocumentService(
            IDocumentRequestRepository repository,
            IStaffRepository staffRepository,
            IPatientRepository patientRepository,
            IImagingFileStore fileStore)
        {
            _repository = repository;
            _staffRepository = staffRepository;
            _patientRepository = patientRepository;
            _fileStore = fileStore;
        }

        public async Task<ProvidedDocumentResponse> CreateAsync(
            string patientUserId,
            CreateProvidedDocumentRequest request,
            List<UploadedImagingFile> files,
            CancellationToken cancellationToken = default)
        {
            var patient = await _patientRepository.GetByUserIdAsync(patientUserId ?? string.Empty);
            ConditionGuard.Ensure<NotFoundException>(patient != null, ErrorConstants.DocumentRequestMessage.PatientNotFound);

            var name = request?.DocumentName?.Trim() ?? string.Empty;
            var address = request?.ProviderAddress?.Trim() ?? string.Empty;
            var category = request?.Category?.Trim() ?? string.Empty;
            var note = request?.Note?.Trim() ?? string.Empty;
            ConditionGuard.Ensure(name.Length > 0, ErrorConstants.ProvidedDocumentMessage.DocumentNameRequired);
            ConditionGuard.Ensure(name.Length <= ProvidedDocumentConstants.DocumentNameMaxLength, ErrorConstants.ProvidedDocumentMessage.DocumentNameInvalid);
            ConditionGuard.Ensure(ProvidedDocumentConstants.Categories.Contains(category), ErrorConstants.ProvidedDocumentMessage.CategoryInvalid);
            // When and where are required; the note for the doctor is optional
            ConditionGuard.Ensure(request!.PerformedOn != null, ErrorConstants.ProvidedDocumentMessage.PerformedOnRequired);
            ConditionGuard.Ensure(address.Length > 0, ErrorConstants.ProvidedDocumentMessage.ProviderAddressRequired);
            ConditionGuard.Ensure(address.Length <= ProvidedDocumentConstants.ProviderAddressMaxLength, ErrorConstants.ProvidedDocumentMessage.ProviderAddressInvalid);
            ConditionGuard.Ensure(note.Length <= ProvidedDocumentConstants.NoteMaxLength, ErrorConstants.ProvidedDocumentMessage.NoteInvalid);
            ConditionGuard.Ensure(
                request!.PerformedOn == null || request.PerformedOn.Value <= DateOnly.FromDateTime(ClinicClock.Today),
                ErrorConstants.ProvidedDocumentMessage.PerformedOnInFuture);

            // Every file is checked before any is stored
            ConditionGuard.Ensure(files != null && files.Count > 0, ErrorConstants.ProvidedDocumentMessage.UploadFilesRequired);
            ConditionGuard.Ensure(files!.Count <= ProvidedDocumentConstants.UploadMaxFiles, ErrorConstants.ProvidedDocumentMessage.UploadTooManyFiles);
            foreach (var file in files)
            {
                var extension = Path.GetExtension(file.FileName ?? string.Empty).ToLowerInvariant();
                ConditionGuard.Ensure(
                    ProvidedDocumentConstants.UploadExtensions.Contains(extension),
                    string.Format(ErrorConstants.ProvidedDocumentMessage.UploadFileTypeInvalid, file.FileName));
                ConditionGuard.Ensure(
                    file.Data != null && file.Data.Length > 0,
                    string.Format(ErrorConstants.ProvidedDocumentMessage.UploadFileEmpty, file.FileName));
                ConditionGuard.Ensure(
                    file.Data!.LongLength <= ProvidedDocumentConstants.UploadMaxFileBytes,
                    string.Format(ErrorConstants.ProvidedDocumentMessage.UploadFileTooLarge, file.FileName));
            }

            var groupId = Guid.NewGuid();
            var now = ClinicClock.UtcNow;
            var documents = new List<PatientDocument>();
            foreach (var file in files)
            {
                var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
                // The stored name never comes from the user: only the checked extension is kept
                var relativePath = string.Join('/',
                    DocumentRequestConstants.StorageFolder,
                    now.ToString("yyyy", CultureInfo.InvariantCulture),
                    now.ToString("MM", CultureInfo.InvariantCulture),
                    ProvidedDocumentConstants.FolderPrefix + groupId.ToString("N"),
                    $"{Guid.NewGuid():N}{extension}");
                await _fileStore.SaveAsync(relativePath, file.Data, cancellationToken);

                var originalName = Path.GetFileName(file.FileName);
                documents.Add(new PatientDocument
                {
                    PatientId = patient!.Id,
                    DocumentType = ProvidedDocumentConstants.DocumentType,
                    UploadGroupId = groupId,
                    Description = name,
                    ProviderAddress = address.Length > 0 ? address : null,
                    PerformedOn = request.PerformedOn,
                    Category = category,
                    Note = note.Length > 0 ? note : null,
                    FileName = originalName.Length > DocumentRequestConstants.FileNameMaxLength
                        ? originalName[..DocumentRequestConstants.FileNameMaxLength]
                        : originalName,
                    FilePath = relativePath,
                    FileSize = file.Data.LongLength,
                    MimeType = FileMimeTypeHelper.Of(extension),
                    UploadedByUserId = patientUserId,
                    CreatedAt = now
                });
            }
            _repository.AddDocuments(documents);
            await _repository.SaveChangesAsync(cancellationToken);

            return ToResponses(documents).Single();
        }

        public async Task<List<ProvidedDocumentResponse>> GetMineAsync(string patientUserId, CancellationToken cancellationToken = default)
        {
            var patient = await _patientRepository.GetByUserIdAsync(patientUserId ?? string.Empty);
            ConditionGuard.Ensure<NotFoundException>(patient != null, ErrorConstants.DocumentRequestMessage.PatientNotFound);
            return ToResponses(await _repository.GetProvidedByPatientIdAsync(patient!.Id, cancellationToken));
        }

        public async Task DeleteAsync(string patientUserId, Guid id, CancellationToken cancellationToken = default)
        {
            var documents = await _repository.GetProvidedGroupAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(documents.Count > 0, ErrorConstants.ProvidedDocumentMessage.DocumentNotFound);
            // A patient only deletes their own uploads
            ConditionGuard.Ensure<ForbiddenException>(
                !string.IsNullOrEmpty(patientUserId) && documents.All(d => d.Patient?.UserId == patientUserId),
                ErrorConstants.ProvidedDocumentMessage.CannotDelete);
            // Once a doctor has read it, it is part of what the doctor relied on
            ConditionGuard.Ensure<ForbiddenException>(
                documents.All(d => d.SeenAt == null),
                ErrorConstants.ProvidedDocumentMessage.CannotDeleteSeen);

            _repository.RemoveDocuments(documents);
            await _repository.SaveChangesAsync(cancellationToken);

            // The rows are gone; a file left on disk is harmless, so a failed delete does not undo the request
            foreach (var document in documents)
            {
                try
                {
                    await _fileStore.DeleteAsync(document.FilePath, cancellationToken);
                }
                catch (IOException)
                {
                }
                catch (UnauthorizedAccessException)
                {
                }
            }
        }

        public async Task<List<ProvidedDocumentResponse>> GetByExaminationAsync(
            string doctorUserId,
            long examinationId,
            CancellationToken cancellationToken = default)
        {
            var doctor = await _staffRepository.GetByUserIdAsync(doctorUserId);
            ConditionGuard.Ensure<NotFoundException>(doctor != null, ErrorConstants.MedicalRecordMessage.DoctorNotFound);

            var examination = await _repository.GetExaminationAsync(examinationId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(examination != null, ErrorConstants.MedicalRecordMessage.ExaminationNotFound);
            ConditionGuard.Ensure<ForbiddenException>(
                examination!.DoctorId == doctor!.Id,
                ErrorConstants.DocumentRequestMessage.CannotViewRequests);

            var documents = await _repository.GetProvidedByPatientIdAsync(examination.PatientId, cancellationToken);

            // The doctor of the visit now has them in front of them: the patient sees "Bác sĩ đã xem"
            var unseen = documents.Where(d => d.SeenAt == null).ToList();
            if (unseen.Count > 0)
            {
                var now = ClinicClock.UtcNow;
                foreach (var document in unseen)
                {
                    document.SeenAt = now;
                    document.SeenByDoctorId = doctor.Id;
                    document.SeenByDoctor = doctor;
                }
                await _repository.SaveChangesAsync(cancellationToken);
            }

            return ToResponses(documents);
        }

        // One response per upload, newest upload first
        private static List<ProvidedDocumentResponse> ToResponses(IEnumerable<PatientDocument> documents) =>
            documents
                .GroupBy(d => d.UploadGroupId!.Value)
                .Select(group =>
                {
                    var first = group.OrderBy(d => d.Id).First();
                    var seen = group.Where(d => d.SeenAt != null).OrderBy(d => d.SeenAt).FirstOrDefault();
                    return new ProvidedDocumentResponse
                    {
                        Id = group.Key,
                        DocumentName = first.Description ?? string.Empty,
                        PerformedOn = first.PerformedOn,
                        ProviderAddress = first.ProviderAddress ?? string.Empty,
                        Category = first.Category,
                        Note = first.Note,
                        SeenAt = seen?.SeenAt,
                        SeenByDoctorName = seen?.SeenByDoctor?.FullName,
                        CanDelete = seen == null,
                        CreatedAt = group.Max(d => d.CreatedAt),
                        Files = group
                            .OrderBy(d => d.Id)
                            .Select(d => new DocumentRequestFileResponse
                            {
                                Id = d.Id,
                                FileName = d.FileName,
                                FileUrl = string.Format(DocumentRequestConstants.FileUrlFormat, d.Id),
                                CreatedAt = d.CreatedAt
                            })
                            .ToList()
                    };
                })
                .OrderByDescending(d => d.CreatedAt)
                .ToList();
    }
}

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
    // "Yêu cầu bổ sung tài liệu": the doctor asks for a document during an examination, the patient uploads it
    // from the medical book (also after the examination ended), the files are kept as PatientDocuments.
    public class DocumentRequestService : IDocumentRequestService
    {
        private readonly IDocumentRequestRepository _repository;
        private readonly IStaffRepository _staffRepository;
        private readonly IPatientRepository _patientRepository;
        private readonly IImagingFileStore _fileStore;
        private readonly INotificationService? _notifications;

        public DocumentRequestService(
            IDocumentRequestRepository repository,
            IStaffRepository staffRepository,
            IPatientRepository patientRepository,
            IImagingFileStore fileStore,
            INotificationService? notifications = null)
        {
            _repository = repository;
            _staffRepository = staffRepository;
            _patientRepository = patientRepository;
            _fileStore = fileStore;
            _notifications = notifications;
        }

        public async Task<DocumentRequestResponse> CreateAsync(
            string doctorUserId,
            long examinationId,
            CreateDocumentRequest request,
            CancellationToken cancellationToken = default)
        {
            var doctor = await _staffRepository.GetByUserIdAsync(doctorUserId);
            ConditionGuard.Ensure<NotFoundException>(doctor != null, ErrorConstants.MedicalRecordMessage.DoctorNotFound);

            var examination = await _repository.GetExaminationAsync(examinationId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(examination != null, ErrorConstants.MedicalRecordMessage.ExaminationNotFound);
            ConditionGuard.Ensure<ForbiddenException>(
                examination!.DoctorId == doctor!.Id,
                ErrorConstants.DocumentRequestMessage.NotExaminingDoctor);
            ConditionGuard.Ensure(
                examination.ExaminationStatus == DocumentRequestConstants.InProgressExaminationStatus,
                string.Format(ErrorConstants.DocumentRequestMessage.ExaminationNotInProgress, examination.ExaminationStatus));

            var documentName = request.DocumentName?.Trim() ?? string.Empty;
            ConditionGuard.Ensure(documentName.Length > 0, ErrorConstants.DocumentRequestMessage.DocumentNameRequired);
            ConditionGuard.Ensure(
                documentName.Length <= DocumentRequestConstants.DocumentNameMaxLength,
                ErrorConstants.DocumentRequestMessage.DocumentNameInvalid);
            var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
            ConditionGuard.Ensure(
                note == null || note.Length <= DocumentRequestConstants.NoteMaxLength,
                ErrorConstants.DocumentRequestMessage.NoteInvalid);
            var category = string.IsNullOrWhiteSpace(request.Category) ? ProvidedDocumentConstants.Category.Other : request.Category.Trim();
            ConditionGuard.Ensure(ProvidedDocumentConstants.Categories.Contains(category), ErrorConstants.ProvidedDocumentMessage.CategoryInvalid);

            var documentRequest = new DocumentRequest
            {
                ExaminationId = examination.Id,
                PatientId = examination.PatientId,
                RequestedByDoctorId = doctor.Id,
                DocumentName = documentName,
                Note = note,
                Category = category,
                Status = DocumentRequestConstants.Pending,
                CreatedAt = ClinicClock.UtcNow
            };
            await _repository.AddAsync(documentRequest, cancellationToken);

            // The patient opens the examination in the medical book to upload the file
            await NotifyAsync(n => n.NotifyPatientAsync(examination.PatientId,
                new NotificationContent(NotificationConstants.Text.DocumentRequestedTitle,
                    string.Format(NotificationConstants.Text.DocumentRequestedMessage, DoctorTitle(doctor.FullName), documentName),
                    NotificationConstants.Reference.Examination, examination.Id.ToString()), cancellationToken));

            documentRequest.RequestedByDoctor = doctor;
            var response = ToResponse(documentRequest);
            // Just created by this doctor and still Pending
            response.CanCancel = true;
            return response;
        }

        public async Task<List<DocumentRequestResponse>> GetByExaminationAsync(
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

            // Every request of the patient (all visits, all doctors): files sent after a visit ended show up at the next one
            var requests = await _repository.GetByPatientIdAsync(examination.PatientId, null, cancellationToken);
            return requests.Select(request =>
            {
                var response = ToResponse(request);
                response.CanCancel = request.Status == DocumentRequestConstants.Pending && request.RequestedByDoctorId == doctor.Id;
                return response;
            }).ToList();
        }

        public async Task<List<DocumentRequestResponse>> GetMineAsync(
            string patientUserId,
            long? examinationId,
            CancellationToken cancellationToken = default)
        {
            var patient = await _patientRepository.GetByUserIdAsync(patientUserId);
            ConditionGuard.Ensure<NotFoundException>(patient != null, ErrorConstants.DocumentRequestMessage.PatientNotFound);

            var requests = await _repository.GetByPatientIdAsync(patient!.Id, examinationId, cancellationToken);
            return requests.Select(ToResponse).ToList();
        }

        public async Task<DocumentRequestResponse> CancelAsync(
            string doctorUserId,
            long id,
            CancellationToken cancellationToken = default)
        {
            var doctor = await _staffRepository.GetByUserIdAsync(doctorUserId);
            ConditionGuard.Ensure<NotFoundException>(doctor != null, ErrorConstants.MedicalRecordMessage.DoctorNotFound);

            var request = await _repository.GetTrackedByIdAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(request != null, ErrorConstants.DocumentRequestMessage.RequestNotFound);
            ConditionGuard.Ensure<ForbiddenException>(
                request!.RequestedByDoctorId == doctor!.Id,
                ErrorConstants.DocumentRequestMessage.CannotCancelRequest);
            ConditionGuard.Ensure(
                request.Status == DocumentRequestConstants.Pending,
                string.Format(ErrorConstants.DocumentRequestMessage.RequestNotPending, request.Status));

            request.Status = DocumentRequestConstants.Cancelled;
            request.UpdatedAt = ClinicClock.UtcNow;
            await _repository.SaveChangesAsync(cancellationToken);

            await NotifyAsync(n => n.NotifyPatientAsync(request.PatientId,
                new NotificationContent(NotificationConstants.Text.DocumentRequestCancelledTitle,
                    string.Format(NotificationConstants.Text.DocumentRequestCancelledMessage, DoctorTitle(doctor.FullName), request.DocumentName),
                    NotificationConstants.Reference.Examination, request.ExaminationId.ToString()), cancellationToken));

            return ToResponse(request);
        }

        public async Task<DocumentRequestResponse> SubmitAsync(
            string patientUserId,
            long id,
            List<UploadedImagingFile> files,
            SubmitDocumentRequestDetails? details = null,
            CancellationToken cancellationToken = default)
        {
            var request = await _repository.GetTrackedByIdAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(request != null, ErrorConstants.DocumentRequestMessage.RequestNotFound);
            // A patient only submits for their own requests
            ConditionGuard.Ensure<ForbiddenException>(
                !string.IsNullOrEmpty(patientUserId) && request!.Patient?.UserId == patientUserId,
                ErrorConstants.DocumentRequestMessage.CannotSubmit);
            ConditionGuard.Ensure(
                request!.Status != DocumentRequestConstants.Cancelled,
                ErrorConstants.DocumentRequestMessage.RequestCancelledCannotSubmit);

            // Every file is checked before any is stored
            ConditionGuard.Ensure(files != null && files.Count > 0, ErrorConstants.DocumentRequestMessage.UploadFilesRequired);
            ConditionGuard.Ensure(files!.Count <= DocumentRequestConstants.UploadMaxFiles, ErrorConstants.DocumentRequestMessage.UploadTooManyFiles);
            foreach (var file in files)
            {
                var extension = Path.GetExtension(file.FileName ?? string.Empty).ToLowerInvariant();
                ConditionGuard.Ensure(
                    DocumentRequestConstants.UploadExtensions.Contains(extension),
                    string.Format(ErrorConstants.DocumentRequestMessage.UploadFileTypeInvalid, file.FileName));
                ConditionGuard.Ensure(
                    file.Data != null && file.Data.Length > 0,
                    string.Format(ErrorConstants.DocumentRequestMessage.UploadFileEmpty, file.FileName));
                ConditionGuard.Ensure(
                    file.Data!.LongLength <= DocumentRequestConstants.UploadMaxFileBytes,
                    string.Format(ErrorConstants.DocumentRequestMessage.UploadFileTooLarge, file.FileName));
            }

            // Same details as a document the patient provides on their own: when and where required, note optional
            var patientNote = details?.Note?.Trim() ?? string.Empty;
            var address = details?.ProviderAddress?.Trim() ?? string.Empty;
            ConditionGuard.Ensure(details?.PerformedOn != null, ErrorConstants.ProvidedDocumentMessage.PerformedOnRequired);
            ConditionGuard.Ensure(
                details!.PerformedOn!.Value <= DateOnly.FromDateTime(ClinicClock.Today),
                ErrorConstants.ProvidedDocumentMessage.PerformedOnInFuture);
            ConditionGuard.Ensure(address.Length > 0, ErrorConstants.ProvidedDocumentMessage.ProviderAddressRequired);
            ConditionGuard.Ensure(address.Length <= ProvidedDocumentConstants.ProviderAddressMaxLength, ErrorConstants.ProvidedDocumentMessage.ProviderAddressInvalid);
            ConditionGuard.Ensure(patientNote.Length <= ProvidedDocumentConstants.NoteMaxLength, ErrorConstants.ProvidedDocumentMessage.NoteInvalid);

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
                    DocumentRequestConstants.FolderPrefix + request.Id,
                    $"{Guid.NewGuid():N}{extension}");
                await _fileStore.SaveAsync(relativePath, file.Data, cancellationToken);

                var originalName = Path.GetFileName(file.FileName);
                documents.Add(new PatientDocument
                {
                    PatientId = request.PatientId,
                    DocumentRequestId = request.Id,
                    DocumentType = DocumentRequestConstants.DocumentType,
                    FileName = originalName.Length > DocumentRequestConstants.FileNameMaxLength
                        ? originalName[..DocumentRequestConstants.FileNameMaxLength]
                        : originalName,
                    FilePath = relativePath,
                    FileSize = file.Data.LongLength,
                    MimeType = FileMimeTypeHelper.Of(extension),
                    Description = request.DocumentName,
                    Category = request.Category,
                    Note = patientNote.Length > 0 ? patientNote : null,
                    PerformedOn = details?.PerformedOn,
                    ProviderAddress = address.Length > 0 ? address : null,
                    UploadedByUserId = patientUserId,
                    CreatedAt = now
                });
            }
            _repository.AddDocuments(documents);
            // EF already links them to the tracked request; a test double does not
            foreach (var document in documents.Where(d => !request.Documents.Contains(d)))
            {
                request.Documents.Add(document);
            }

            request.Status = DocumentRequestConstants.Submitted;
            request.UpdatedAt = now;
            await _repository.SaveChangesAsync(cancellationToken);

            // The doctor who asked can open the files
            await NotifyAsync(n => n.NotifyStaffAsync(request.RequestedByDoctorId,
                new NotificationContent(NotificationConstants.Text.DocumentSubmittedTitle,
                    string.Format(NotificationConstants.Text.DocumentSubmittedMessage, request.Patient?.FullName?.Trim() ?? string.Empty, documents.Count, request.DocumentName),
                    NotificationConstants.Reference.DocumentRequest, request.Id.ToString()), cancellationToken));

            return ToResponse(request);
        }

        public async Task<ImagingFileResult> GetFileAsync(
            string userId,
            bool isPatient,
            long documentId,
            CancellationToken cancellationToken = default)
        {
            var document = await _repository.GetDocumentWithPatientAsync(documentId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(document != null, ErrorConstants.DocumentRequestMessage.DocumentNotFound);

            // A patient only opens their own documents
            if (isPatient)
            {
                ConditionGuard.Ensure<ForbiddenException>(
                    !string.IsNullOrEmpty(userId) && document!.Patient?.UserId == userId,
                    ErrorConstants.DocumentRequestMessage.CannotViewDocument);
            }

            var data = await _fileStore.ReadAsync(document!.FilePath, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(data != null, ErrorConstants.DocumentRequestMessage.DocumentNotFound);

            return new ImagingFileResult
            {
                Data = data!,
                ContentType = string.IsNullOrWhiteSpace(document.MimeType)
                    ? FileMimeTypeHelper.Of(Path.GetExtension(document.FilePath).ToLowerInvariant())
                    : document.MimeType!,
                FileName = document.FileName
            };
        }

        // In-app notifications are optional so unit tests can build the service without them
        private Task NotifyAsync(Func<INotificationService, Task> send) => _notifications == null ? Task.CompletedTask : send(_notifications);

        private static string DoctorTitle(string? fullName) =>
            string.IsNullOrWhiteSpace(fullName) ? "Bác sĩ" : $"BS. {fullName.Trim()}";

        private static DocumentRequestResponse ToResponse(DocumentRequest request)
        {
            // The details the patient filled in are kept on every file of the last sending
            var sent = request.Documents.OrderByDescending(d => d.CreatedAt).ThenByDescending(d => d.Id).FirstOrDefault();
            return new DocumentRequestResponse
            {
            Id = request.Id,
            Category = request.Category ?? ProvidedDocumentConstants.Category.Other,
            PatientNote = sent?.Note,
            PerformedOn = sent?.PerformedOn,
            ProviderAddress = sent?.ProviderAddress,
            ExaminationId = request.ExaminationId,
            ExaminationDate = request.Examination?.CreatedAt,
            PatientId = request.PatientId,
            DocumentName = request.DocumentName,
            Note = request.Note,
            Status = request.Status,
            DoctorName = request.RequestedByDoctor?.FullName?.Trim() ?? string.Empty,
            CreatedAt = request.CreatedAt,
            UpdatedAt = request.UpdatedAt,
            Files = request.Documents
                .OrderBy(d => d.CreatedAt)
                .ThenBy(d => d.Id)
                .Select(d => new DocumentRequestFileResponse
                {
                    Id = d.Id,
                    FileName = d.FileName,
                    FileUrl = string.Format(DocumentRequestConstants.FileUrlFormat, d.Id),
                    CreatedAt = d.CreatedAt
                })
                .ToList()
        };
        }
    }
}

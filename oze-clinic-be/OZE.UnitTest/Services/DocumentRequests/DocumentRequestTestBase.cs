using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.UnitTest.Services.DocumentRequests
{
    // Shared mocks, setup and test data for the document request tests. Holds no tests itself.
    public abstract class DocumentRequestTestBase
    {
        protected const string DoctorUserId = "doctor-user";
        protected const string PatientUserId = "patient-user";
        protected const int DoctorId = 5;
        protected const int PatientId = 3;
        protected const long ExaminationId = 10;
        protected const long RequestId = 77;

        protected readonly Mock<IDocumentRequestRepository> _repository = new();
        protected readonly Mock<IStaffRepository> _staffRepository = new();
        protected readonly Mock<IPatientRepository> _patientRepository = new();
        protected readonly Mock<IImagingFileStore> _fileStore = new();
        protected readonly Mock<INotificationService> _notifications = new();
        protected readonly DocumentRequestService _service;

        protected DocumentRequestTestBase()
        {
            _service = new DocumentRequestService(
                _repository.Object, _staffRepository.Object, _patientRepository.Object, _fileStore.Object, _notifications.Object);
        }

        protected void SetupDoctor(int id = DoctorId)
        {
            _staffRepository
                .Setup(r => r.GetByUserIdAsync(DoctorUserId))
                .ReturnsAsync(new StaffProfile { Id = id, UserId = DoctorUserId, FullName = "Trần Minh Khoa" });
        }

        protected Examination SetupExamination(string status = "InProgress", int doctorId = DoctorId)
        {
            var examination = new Examination
            {
                Id = ExaminationId,
                PatientId = PatientId,
                DoctorId = doctorId,
                ExaminationStatus = status,
                Patient = new Patient { Id = PatientId, UserId = PatientUserId, FullName = "Nguyễn Văn A" }
            };
            _repository
                .Setup(r => r.GetExaminationAsync(ExaminationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(examination);
            return examination;
        }

        // What the patient fills in when sending files (all required)
        protected static SubmitDocumentRequestDetails Details() => new() { Note = "Bác sĩ xem giúp", PerformedOn = new DateOnly(2025, 5, 2), ProviderAddress = "BV Bạch Mai" };

        protected DocumentRequest SetupRequest(string status = DocumentRequestConstants.Pending, string ownerUserId = PatientUserId)
        {
            var request = new DocumentRequest
            {
                Id = RequestId,
                ExaminationId = ExaminationId,
                PatientId = PatientId,
                RequestedByDoctorId = DoctorId,
                DocumentName = "Xét nghiệm máu",
                Status = status,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-1),
                Patient = new Patient { Id = PatientId, UserId = ownerUserId, FullName = "Nguyễn Văn A" },
                RequestedByDoctor = new StaffProfile { Id = DoctorId, FullName = "Trần Minh Khoa" }
            };
            _repository
                .Setup(r => r.GetTrackedByIdAsync(RequestId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(request);
            return request;
        }

        protected static UploadedImagingFile File(string name, int size = 16) => new(name, null, new byte[size]);
    }
}

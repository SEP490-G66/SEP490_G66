using FluentAssertions;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.MedicalRecords
{
    // Doctor 5 ("doctor-user") who has treated patient 3
    public abstract class MedicalRecordTestBase
    {
        protected const string DoctorUserId = "doctor-user";
        protected const int PatientId = 3;
        protected readonly Mock<IMedicalRecordRepository> _repo = new();
        protected readonly Mock<IStaffRepository> _staffRepo = new();
        protected readonly MedicalRecordService _service;

        protected MedicalRecordTestBase()
        {
            _service = new MedicalRecordService(_repo.Object, _staffRepo.Object);
            _staffRepo.Setup(r => r.GetByUserIdAsync(DoctorUserId)).ReturnsAsync(new StaffProfile { Id = 5, UserId = DoctorUserId });
            _repo.Setup(r => r.HasDoctorAccessAsync(5, PatientId)).ReturnsAsync(true);
        }

        protected static Examination Exam(long id) => new()
        {
            Id = id,
            PatientId = PatientId,
            ChiefComplaint = "Dau rang",
            ExaminationStatus = ExaminationConstants.Locked,
            Appointment = new Appointment { AppointmentDate = new DateOnly(2026, 11, 10) },
            Doctor = new StaffProfile { Id = 5, FullName = "BS. Nguyen Van A" }
        };
    }

    // OZ-MR-01 GetPatientRecord
    [Trait("Tab", "OZ-MR-01")]
    public class GetPatientRecordTests : MedicalRecordTestBase
    {
        public GetPatientRecordTests()
        {
            _repo.Setup(r => r.GetPatientAsync(PatientId)).ReturnsAsync(new Patient { Id = PatientId, PatientCode = "BN-03", FullName = "Lan Nguyen" });
            _repo.Setup(r => r.GetActiveMedicalProfilesAsync(PatientId)).ReturnsAsync(new List<PatientMedicalProfile>());
            _repo.Setup(r => r.GetExaminationsAsync(PatientId)).ReturnsAsync(new List<Examination>());
        }

        // UTCID01 (N): the record shows allergies and past visits with the primary diagnosis and follow-up
        [Fact]
        public async Task GetPatientRecordAsync_ShouldReturnRecord()
        {
            var exam = Exam(200);
            exam.FollowUpDate = new DateOnly(2026, 11, 24);
            exam.Diagnoses.Add(new ClinicalDiagnosis { DiagnosisName = "Sau rang", IsPrimary = true });
            _repo.Setup(r => r.GetActiveMedicalProfilesAsync(PatientId)).ReturnsAsync(new List<PatientMedicalProfile>
            {
                new() { Id = 1, RecordType = "Allergy", Title = "Di ung penicillin" }
            });
            _repo.Setup(r => r.GetExaminationsAsync(PatientId)).ReturnsAsync(new List<Examination> { exam });

            var result = await _service.GetPatientRecordAsync(DoctorUserId, PatientId);

            result.PatientCode.Should().Be("BN-03");
            result.MedicalProfiles.Should().ContainSingle(x => x.Title == "Di ung penicillin");
            var visit = result.Examinations.Single();
            visit.PrimaryDiagnosis.Should().Be("Sau rang");
            visit.DoctorName.Should().Be("BS. Nguyen Van A");
            visit.NextAppointmentText.Should().Be("Tái khám ngày 24/11/2026 · chưa xác nhận");
        }

        // UTCID02 (B): a new patient with no visit
        [Fact]
        public async Task GetPatientRecordAsync_ShouldReturnEmptyHistory_WhenNoVisit()
        {
            var result = await _service.GetPatientRecordAsync(DoctorUserId, PatientId);

            result.Examinations.Should().BeEmpty();
            result.MedicalProfiles.Should().BeEmpty();
        }

        // UTCID03 (A): the patient does not exist
        [Fact]
        public async Task GetPatientRecordAsync_ShouldThrow_WhenPatientNotFound()
        {
            var act = () => _service.GetPatientRecordAsync(DoctorUserId, 99);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.MedicalRecordMessage.PatientNotFound);
        }

        // UTCID04 (A): the user has no doctor profile
        [Fact]
        public async Task GetPatientRecordAsync_ShouldThrow_WhenDoctorNotFound()
        {
            var act = () => _service.GetPatientRecordAsync("unknown-user", PatientId);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.MedicalRecordMessage.DoctorNotFound);
        }

        // UTCID05 (A): a doctor who never treated the patient
        [Fact]
        public async Task GetPatientRecordAsync_ShouldThrow_WhenNoAccess()
        {
            _repo.Setup(r => r.HasDoctorAccessAsync(5, PatientId)).ReturnsAsync(false);

            var act = () => _service.GetPatientRecordAsync(DoctorUserId, PatientId);

            (await act.Should().ThrowAsync<ForbiddenException>()).Which.Message.Should().Be(ErrorConstants.MedicalRecordMessage.AccessDenied);
        }
    }

    // OZ-MR-02 GetExamDetail
    [Trait("Tab", "OZ-MR-02")]
    public class GetExamDetailTests : MedicalRecordTestBase
    {
        // UTCID01 (N): the detail lists the primary diagnosis first, medications in order, and hides rejected images
        [Fact]
        public async Task GetExaminationDetailAsync_ShouldReturnDetail()
        {
            var exam = Exam(200);
            exam.Diagnoses.Add(new ClinicalDiagnosis { Id = 2, DiagnosisName = "Viem nuou" });
            exam.Diagnoses.Add(new ClinicalDiagnosis { Id = 1, DiagnosisName = "Sau rang", IsPrimary = true });
            var prescription = new Prescription { Id = 5, Status = PrescriptionConstants.Finalized };
            prescription.Items.Add(new PrescriptionItem { Id = 2, MedicationName = "Paracetamol", SortOrder = 2 });
            prescription.Items.Add(new PrescriptionItem { Id = 1, MedicationName = "Amoxicillin", SortOrder = 1 });
            exam.Prescriptions.Add(prescription);
            var imaging = new ImagingRequest { ImagingType = ImagingRequestConstants.Panoramic, TargetArea = "Full arch" };
            imaging.Results.Add(new ImagingResult { Id = 1, FileName = "ok.jpg", ReviewStatus = "Approved", CreatedAt = DateTimeOffset.UtcNow });
            imaging.Results.Add(new ImagingResult { Id = 2, FileName = "blur.jpg", ReviewStatus = MedicalRecordConstants.RejectedImageStatus, CreatedAt = DateTimeOffset.UtcNow });
            exam.ImagingRequests.Add(imaging);
            _repo.Setup(r => r.GetExaminationDetailAsync(200)).ReturnsAsync(exam);

            var result = await _service.GetExaminationDetailAsync(DoctorUserId, 200);

            result.Diagnoses.Select(x => x.DiagnosisName).Should().Equal("Sau rang", "Viem nuou");
            result.Prescriptions.Single().Items.Select(x => x.MedicationName).Should().Equal("Amoxicillin", "Paracetamol");
            result.Images.Should().ContainSingle(x => x.FileName == "ok.jpg");
        }

        // UTCID02 (B): an examination with nothing recorded yet
        [Fact]
        public async Task GetExaminationDetailAsync_ShouldReturnEmptyLists_WhenNothingRecorded()
        {
            _repo.Setup(r => r.GetExaminationDetailAsync(200)).ReturnsAsync(Exam(200));

            var result = await _service.GetExaminationDetailAsync(DoctorUserId, 200);

            result.Diagnoses.Should().BeEmpty();
            result.Prescriptions.Should().BeEmpty();
            result.Images.Should().BeEmpty();
        }

        // UTCID03 (A): the examination does not exist
        [Fact]
        public async Task GetExaminationDetailAsync_ShouldThrow_WhenNotFound()
        {
            var act = () => _service.GetExaminationDetailAsync(DoctorUserId, 999);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.MedicalRecordMessage.ExaminationNotFound);
        }

        // UTCID04 (A): a doctor who never treated the patient
        [Fact]
        public async Task GetExaminationDetailAsync_ShouldThrow_WhenNoAccess()
        {
            _repo.Setup(r => r.GetExaminationDetailAsync(200)).ReturnsAsync(Exam(200));
            _repo.Setup(r => r.HasDoctorAccessAsync(5, PatientId)).ReturnsAsync(false);

            var act = () => _service.GetExaminationDetailAsync(DoctorUserId, 200);

            (await act.Should().ThrowAsync<ForbiddenException>()).Which.Message.Should().Be(ErrorConstants.MedicalRecordMessage.AccessDenied);
        }
    }
}

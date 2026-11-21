using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.UnitTest.Services.DocumentRequests
{
    // Listing, cancelling and opening the stored files
    public class DocumentRequestAccessTests : DocumentRequestTestBase
    {
        private void SetupDocument(string ownerUserId = PatientUserId)
        {
            _repository
                .Setup(r => r.GetDocumentWithPatientAsync(500, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PatientDocument
                {
                    Id = 500,
                    PatientId = PatientId,
                    FileName = "ket-qua.pdf",
                    FilePath = "documents/2026/11/DR-77/abc.pdf",
                    MimeType = "application/pdf",
                    Patient = new Patient { Id = PatientId, UserId = ownerUserId }
                });
            _fileStore
                .Setup(s => s.ReadAsync("documents/2026/11/DR-77/abc.pdf", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new byte[] { 1, 2, 3 });
        }

        [Fact]
        public async Task GetFileAsync_ShouldReturnOwnDocumentToPatient()
        {
            SetupDocument();

            var file = await _service.GetFileAsync(PatientUserId, true, 500);

            file.ContentType.Should().Be("application/pdf");
            file.FileName.Should().Be("ket-qua.pdf");
            file.Data.Should().Equal(1, 2, 3);
        }

        [Fact]
        public async Task GetFileAsync_ShouldRejectAnotherPatient()
        {
            SetupDocument("someone-else");

            var act = () => _service.GetFileAsync(PatientUserId, true, 500);

            await act.Should().ThrowAsync<ForbiddenException>();
        }

        [Fact]
        public async Task GetFileAsync_ShouldLetStaffOpenAnyDocument()
        {
            SetupDocument("someone-else");

            var file = await _service.GetFileAsync(DoctorUserId, false, 500);

            file.Data.Should().NotBeEmpty();
        }

        [Fact]
        public async Task GetByExaminationAsync_ShouldReturnRequestsWithFileLinks()
        {
            SetupDoctor();
            SetupExamination("Completed");
            _repository
                .Setup(r => r.GetByPatientIdAsync(PatientId, null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<DocumentRequest>
                {
                    new()
                    {
                        Id = RequestId, ExaminationId = ExaminationId, PatientId = PatientId, DocumentName = "Phim", Status = DocumentRequestConstants.Submitted,
                        Documents = { new PatientDocument { Id = 500, FileName = "phim.png" } }
                    }
                });

            var result = await _service.GetByExaminationAsync(DoctorUserId, ExaminationId);

            result.Should().ContainSingle();
            result[0].Status.Should().Be(DocumentRequestConstants.Submitted);
            result[0].Files.Should().ContainSingle(f => f.Id == 500 && f.FileUrl == "/api/patient-documents/500/file" && f.FileName == "phim.png");
        }

        [Fact]
        public async Task GetByExaminationAsync_ShouldIncludeRequestsOfEarlierVisits_AndOnlyLetTheCreatorCancel()
        {
            SetupDoctor();
            SetupExamination();
            var earlierVisit = new Examination { Id = 4, PatientId = PatientId, CreatedAt = new DateTimeOffset(2026, 10, 1, 9, 0, 0, TimeSpan.Zero) };
            _repository
                .Setup(r => r.GetByPatientIdAsync(PatientId, null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<DocumentRequest>
                {
                    new() { Id = 2, ExaminationId = ExaminationId, PatientId = PatientId, RequestedByDoctorId = DoctorId, DocumentName = "Mới", Status = DocumentRequestConstants.Pending },
                    new()
                    {
                        // Submitted after the earlier visit ended, asked by another doctor
                        Id = 1, ExaminationId = 4, Examination = earlierVisit, PatientId = PatientId, RequestedByDoctorId = 99, DocumentName = "Phim cũ",
                        Status = DocumentRequestConstants.Submitted, Documents = { new PatientDocument { Id = 501, FileName = "phim.pdf" } }
                    },
                    new() { Id = 3, ExaminationId = 4, Examination = earlierVisit, PatientId = PatientId, RequestedByDoctorId = 99, DocumentName = "Khác", Status = DocumentRequestConstants.Pending }
                });

            var result = await _service.GetByExaminationAsync(DoctorUserId, ExaminationId);

            result.Select(r => r.Id).Should().Equal(2, 1, 3);
            var earlier = result.Single(r => r.Id == 1);
            earlier.ExaminationId.Should().Be(4);
            earlier.ExaminationDate.Should().Be(earlierVisit.CreatedAt);
            earlier.Files.Should().ContainSingle(f => f.FileUrl == "/api/patient-documents/501/file");
            result.Single(r => r.Id == 2).CanCancel.Should().BeTrue();
            result.Single(r => r.Id == 1).CanCancel.Should().BeFalse();
            result.Single(r => r.Id == 3).CanCancel.Should().BeFalse();
        }

        [Fact]
        public async Task GetByExaminationAsync_ShouldRejectAnotherDoctor()
        {
            SetupDoctor();
            SetupExamination(doctorId: 99);

            var act = () => _service.GetByExaminationAsync(DoctorUserId, ExaminationId);

            await act.Should().ThrowAsync<ForbiddenException>();
        }

        [Fact]
        public async Task GetMineAsync_ShouldReadThePatientOfTheSignedInUser()
        {
            _patientRepository.Setup(r => r.GetByUserIdAsync(PatientUserId)).ReturnsAsync(new Patient { Id = PatientId, UserId = PatientUserId });
            _repository
                .Setup(r => r.GetByPatientIdAsync(PatientId, ExaminationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<DocumentRequest> { new() { Id = RequestId, PatientId = PatientId, ExaminationId = ExaminationId, DocumentName = "X", Status = DocumentRequestConstants.Pending } });

            var result = await _service.GetMineAsync(PatientUserId, ExaminationId);

            result.Should().ContainSingle(r => r.Id == RequestId);
        }

        [Fact]
        public async Task GetMineAsync_ShouldRejectUserWithoutPatientProfile()
        {
            var act = () => _service.GetMineAsync(PatientUserId, null);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task CancelAsync_ShouldCancelPendingRequest()
        {
            SetupDoctor();
            var request = SetupRequest();

            var result = await _service.CancelAsync(DoctorUserId, RequestId);

            request.Status.Should().Be(DocumentRequestConstants.Cancelled);
            result.Status.Should().Be(DocumentRequestConstants.Cancelled);
            _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
            _notifications.Verify(n => n.NotifyPatientAsync(PatientId,
                It.Is<NotificationContent>(c => c.Title == NotificationConstants.Text.DocumentRequestCancelledTitle && c.Message.Contains("Xét nghiệm máu")),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(DocumentRequestConstants.Submitted)]
        [InlineData(DocumentRequestConstants.Cancelled)]
        public async Task CancelAsync_ShouldRejectRequestThatIsNotPending(string status)
        {
            SetupDoctor();
            SetupRequest(status);

            var act = () => _service.CancelAsync(DoctorUserId, RequestId);

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be($"Cannot cancel document request because the document request is {status}.");
        }

        [Fact]
        public async Task CancelAsync_ShouldRejectAnotherDoctor()
        {
            SetupDoctor(id: 42);
            SetupRequest();

            var act = () => _service.CancelAsync(DoctorUserId, RequestId);

            await act.Should().ThrowAsync<ForbiddenException>();
        }
    }
}

using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.UnitTest.Services.DocumentRequests
{
    public class CreateDocumentRequestTests : DocumentRequestTestBase
    {
        [Fact]
        public async Task CreateAsync_ShouldCreatePendingRequest_AndNotifyPatient()
        {
            SetupDoctor();
            SetupExamination();
            DocumentRequest? saved = null;
            _repository
                .Setup(r => r.AddAsync(It.IsAny<DocumentRequest>(), It.IsAny<CancellationToken>()))
                .Callback<DocumentRequest, CancellationToken>((request, _) => saved = request)
                .Returns(Task.CompletedTask);

            var result = await _service.CreateAsync(DoctorUserId, ExaminationId, new CreateDocumentRequest
            {
                DocumentName = "  Xét nghiệm máu  ",
                Note = "  Trong 3 tháng gần đây  "
            });

            saved.Should().NotBeNull();
            saved!.Status.Should().Be(DocumentRequestConstants.Pending);
            saved.ExaminationId.Should().Be(ExaminationId);
            saved.PatientId.Should().Be(PatientId);
            saved.RequestedByDoctorId.Should().Be(DoctorId);
            saved.DocumentName.Should().Be("Xét nghiệm máu");
            saved.Note.Should().Be("Trong 3 tháng gần đây");
            result.Status.Should().Be(DocumentRequestConstants.Pending);
            result.CanCancel.Should().BeTrue();
            result.DoctorName.Should().Be("Trần Minh Khoa");
            result.Files.Should().BeEmpty();
            _notifications.Verify(n => n.NotifyPatientAsync(PatientId,
                It.Is<NotificationContent>(c => c.Title == NotificationConstants.Text.DocumentRequestedTitle && c.Message.Contains("Xét nghiệm máu")
                    && c.ReferenceType == NotificationConstants.Reference.Examination && c.ReferenceId == ExaminationId.ToString()),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(ProvidedDocumentConstants.Category.Imaging, ProvidedDocumentConstants.Category.Imaging)]
        [InlineData(null, ProvidedDocumentConstants.Category.Other)]
        [InlineData("  ", ProvidedDocumentConstants.Category.Other)]
        public async Task CreateAsync_ShouldKeepTheDocumentType(string? category, string expected)
        {
            SetupDoctor();
            SetupExamination();
            DocumentRequest? saved = null;
            _repository
                .Setup(r => r.AddAsync(It.IsAny<DocumentRequest>(), It.IsAny<CancellationToken>()))
                .Callback<DocumentRequest, CancellationToken>((request, _) => saved = request)
                .Returns(Task.CompletedTask);

            var result = await _service.CreateAsync(DoctorUserId, ExaminationId, new CreateDocumentRequest { DocumentName = "Phim CT", Category = category });

            saved!.Category.Should().Be(expected);
            result.Category.Should().Be(expected);
        }

        [Fact]
        public async Task CreateAsync_ShouldRejectAnUnknownDocumentType()
        {
            SetupDoctor();
            SetupExamination();

            var act = () => _service.CreateAsync(DoctorUserId, ExaminationId, new CreateDocumentRequest { DocumentName = "Phim CT", Category = "Video" });

            (await act.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.ProvidedDocumentMessage.CategoryInvalid);
            _repository.Verify(r => r.AddAsync(It.IsAny<DocumentRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task CreateAsync_ShouldRejectMissingName(string? name)
        {
            SetupDoctor();
            SetupExamination();

            var act = () => _service.CreateAsync(DoctorUserId, ExaminationId, new CreateDocumentRequest { DocumentName = name });

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.DocumentRequestMessage.DocumentNameRequired);
            _repository.Verify(r => r.AddAsync(It.IsAny<DocumentRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CreateAsync_ShouldRejectNameLongerThan200()
        {
            SetupDoctor();
            SetupExamination();

            var act = () => _service.CreateAsync(DoctorUserId, ExaminationId, new CreateDocumentRequest { DocumentName = new string('a', 201) });

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.DocumentRequestMessage.DocumentNameInvalid);
            _repository.Verify(r => r.AddAsync(It.IsAny<DocumentRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CreateAsync_ShouldAcceptNameOf200()
        {
            SetupDoctor();
            SetupExamination();

            var result = await _service.CreateAsync(DoctorUserId, ExaminationId, new CreateDocumentRequest { DocumentName = new string('a', 200) });

            result.DocumentName.Should().HaveLength(200);
        }

        [Theory]
        [InlineData("Completed")]
        [InlineData("Locked")]
        public async Task CreateAsync_ShouldRejectExaminationNotInProgress(string status)
        {
            SetupDoctor();
            SetupExamination(status);

            var act = () => _service.CreateAsync(DoctorUserId, ExaminationId, new CreateDocumentRequest { DocumentName = "Xét nghiệm máu" });

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be($"Cannot request documents because the examination is {status}.");
            _repository.Verify(r => r.AddAsync(It.IsAny<DocumentRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _notifications.Verify(n => n.NotifyPatientAsync(It.IsAny<int>(), It.IsAny<NotificationContent>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CreateAsync_ShouldRejectDoctorWhoIsNotExamining()
        {
            SetupDoctor();
            SetupExamination(doctorId: 99);

            var act = () => _service.CreateAsync(DoctorUserId, ExaminationId, new CreateDocumentRequest { DocumentName = "Xét nghiệm máu" });

            await act.Should().ThrowAsync<ForbiddenException>();
        }

        [Fact]
        public async Task CreateAsync_ShouldRejectNoteLongerThan500()
        {
            SetupDoctor();
            SetupExamination();

            var act = () => _service.CreateAsync(DoctorUserId, ExaminationId, new CreateDocumentRequest
            {
                DocumentName = "Xét nghiệm máu",
                Note = new string('n', 501)
            });

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.DocumentRequestMessage.NoteInvalid);
        }
    }
}

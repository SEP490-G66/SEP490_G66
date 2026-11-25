using FluentAssertions;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.UnitTest.Services.ProvidedDocuments
{
    public class ProvidedDocumentServiceTests
    {
        private const string PatientUserId = "patient-user";
        private const string DoctorUserId = "doctor-user";
        private const int PatientId = 3;
        private const int DoctorId = 5;
        private const long ExaminationId = 10;

        private readonly Mock<IDocumentRequestRepository> _repository = new();
        private readonly Mock<IStaffRepository> _staffRepository = new();
        private readonly Mock<IPatientRepository> _patientRepository = new();
        private readonly Mock<IImagingFileStore> _fileStore = new();
        private readonly ProvidedDocumentService _service;

        public ProvidedDocumentServiceTests()
        {
            _service = new ProvidedDocumentService(_repository.Object, _staffRepository.Object, _patientRepository.Object, _fileStore.Object);
            _patientRepository
                .Setup(r => r.GetByUserIdAsync(PatientUserId))
                .ReturnsAsync(new Patient { Id = PatientId, UserId = PatientUserId, FullName = "Nguyễn Văn A" });
        }

        private static UploadedImagingFile File(string name, int size = 16) => new(name, null, new byte[size]);

        private static CreateProvidedDocumentRequest Request(string? name = "Xét nghiệm công thức máu", string? address = "Bệnh viện Bạch Mai", DateOnly? performedOn = null) =>
            new() { DocumentName = name, ProviderAddress = address, PerformedOn = performedOn };

        private static PatientDocument Stored(Guid group, long id, string ownerUserId = PatientUserId) => new()
        {
            Id = id,
            PatientId = PatientId,
            UploadGroupId = group,
            DocumentType = ProvidedDocumentConstants.DocumentType,
            Description = "Đơn thuốc cũ",
            FileName = $"file-{id}.pdf",
            FilePath = $"documents/2026/11/PD-x/{id}.pdf",
            CreatedAt = DateTimeOffset.UtcNow,
            Patient = new Patient { Id = PatientId, UserId = ownerUserId }
        };

        [Fact]
        public async Task CreateAsync_ShouldStoreEveryFileInOneGroup()
        {
            List<PatientDocument>? added = null;
            _repository
                .Setup(r => r.AddDocuments(It.IsAny<IEnumerable<PatientDocument>>()))
                .Callback<IEnumerable<PatientDocument>>(documents => added = documents.ToList());
            var savedPaths = new List<string>();
            _fileStore
                .Setup(s => s.SaveAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<CancellationToken>()))
                .Callback<string, byte[], CancellationToken>((path, _, _) => savedPaths.Add(path))
                .Returns(Task.CompletedTask);
            var performedOn = new DateOnly(2024, 5, 2);

            var result = await _service.CreateAsync(PatientUserId, Request(" Xét nghiệm máu ", " BV Bạch Mai ", performedOn), new List<UploadedImagingFile>
            {
                File("ket-qua.PDF"),
                File("../../phim.dcm")
            });

            added.Should().HaveCount(2);
            added!.Select(d => d.UploadGroupId).Distinct().Should().ContainSingle().Which.Should().Be(result.Id);
            added.Should().OnlyContain(d =>
                d.PatientId == PatientId && d.DocumentRequestId == null && d.DocumentType == ProvidedDocumentConstants.DocumentType &&
                d.Description == "Xét nghiệm máu" && d.ProviderAddress == "BV Bạch Mai" && d.PerformedOn == performedOn && d.UploadedByUserId == PatientUserId);
            added[1].FileName.Should().Be("phim.dcm");
            added[1].MimeType.Should().Be("application/dicom");
            savedPaths.Should().OnlyContain(p => p.StartsWith("documents/") && p.Contains("/PD-") && !p.Contains(".."));
            result.DocumentName.Should().Be("Xét nghiệm máu");
            result.Files.Should().HaveCount(2);
            _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(null, "BV", ErrorConstants.ProvidedDocumentMessage.DocumentNameRequired)]
        [InlineData("   ", "BV", ErrorConstants.ProvidedDocumentMessage.DocumentNameRequired)]
        [InlineData("Tên", null, ErrorConstants.ProvidedDocumentMessage.ProviderAddressRequired)]
        [InlineData("Tên", " ", ErrorConstants.ProvidedDocumentMessage.ProviderAddressRequired)]
        public async Task CreateAsync_ShouldRequireNameAndAddress(string? name, string? address, string message)
        {
            var act = () => _service.CreateAsync(PatientUserId, Request(name, address), new List<UploadedImagingFile> { File("a.pdf") });

            (await act.Should().ThrowAsync<BadRequestException>()).WithMessage(message);
            _fileStore.Verify(s => s.SaveAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CreateAsync_ShouldRejectTooLongFields()
        {
            var longName = () => _service.CreateAsync(PatientUserId, Request(new string('a', 201)), new List<UploadedImagingFile> { File("a.pdf") });
            var longAddress = () => _service.CreateAsync(PatientUserId, Request(address: new string('a', 301)), new List<UploadedImagingFile> { File("a.pdf") });

            (await longName.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.ProvidedDocumentMessage.DocumentNameInvalid);
            (await longAddress.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.ProvidedDocumentMessage.ProviderAddressInvalid);
        }

        [Fact]
        public async Task CreateAsync_ShouldRejectPerformedDateInTheFuture()
        {
            var act = () => _service.CreateAsync(PatientUserId, Request(performedOn: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3))), new List<UploadedImagingFile> { File("a.pdf") });

            (await act.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.ProvidedDocumentMessage.PerformedOnInFuture);
        }

        [Fact]
        public async Task CreateAsync_ShouldCheckFilesBeforeStoringAny()
        {
            var none = () => _service.CreateAsync(PatientUserId, Request(), new List<UploadedImagingFile>());
            var tooMany = () => _service.CreateAsync(PatientUserId, Request(), Enumerable.Range(0, 6).Select(i => File($"{i}.pdf")).ToList());
            var wrongType = () => _service.CreateAsync(PatientUserId, Request(), new List<UploadedImagingFile> { File("a.pdf"), File("b.exe") });
            var empty = () => _service.CreateAsync(PatientUserId, Request(), new List<UploadedImagingFile> { File("a.pdf", 0) });
            var tooLarge = () => _service.CreateAsync(PatientUserId, Request(), new List<UploadedImagingFile> { File("a.pdf", (int)ProvidedDocumentConstants.UploadMaxFileBytes + 1) });

            (await none.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.ProvidedDocumentMessage.UploadFilesRequired);
            (await tooMany.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.ProvidedDocumentMessage.UploadTooManyFiles);
            (await wrongType.Should().ThrowAsync<BadRequestException>()).WithMessage(string.Format(ErrorConstants.ProvidedDocumentMessage.UploadFileTypeInvalid, "b.exe"));
            (await empty.Should().ThrowAsync<BadRequestException>()).WithMessage(string.Format(ErrorConstants.ProvidedDocumentMessage.UploadFileEmpty, "a.pdf"));
            (await tooLarge.Should().ThrowAsync<BadRequestException>()).WithMessage(string.Format(ErrorConstants.ProvidedDocumentMessage.UploadFileTooLarge, "a.pdf"));
            _fileStore.Verify(s => s.SaveAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CreateAsync_ShouldFail_WhenTheAccountHasNoPatientProfile()
        {
            var act = () => _service.CreateAsync("other-user", Request(), new List<UploadedImagingFile> { File("a.pdf") });

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task GetMineAsync_ShouldGroupFilesByUpload()
        {
            var first = Guid.NewGuid();
            var second = Guid.NewGuid();
            _repository
                .Setup(r => r.GetProvidedByPatientIdAsync(PatientId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<PatientDocument> { Stored(first, 1), Stored(first, 2), Stored(second, 3) });

            var result = await _service.GetMineAsync(PatientUserId);

            result.Should().HaveCount(2);
            result.Single(d => d.Id == first).Files.Select(f => f.Id).Should().Equal(1, 2);
            result.Single(d => d.Id == second).Files.Should().ContainSingle().Which.FileUrl.Should().Be("/api/patient-documents/3/file");
        }

        [Fact]
        public async Task DeleteAsync_ShouldRemoveTheRowsAndTheirFiles()
        {
            var group = Guid.NewGuid();
            var stored = new List<PatientDocument> { Stored(group, 1), Stored(group, 2) };
            _repository.Setup(r => r.GetProvidedGroupAsync(group, It.IsAny<CancellationToken>())).ReturnsAsync(stored);

            await _service.DeleteAsync(PatientUserId, group);

            _repository.Verify(r => r.RemoveDocuments(stored), Times.Once);
            _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
            _fileStore.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task DeleteAsync_ShouldRefuseAnotherPatientsUpload()
        {
            var group = Guid.NewGuid();
            _repository.Setup(r => r.GetProvidedGroupAsync(group, It.IsAny<CancellationToken>())).ReturnsAsync(new List<PatientDocument> { Stored(group, 1, "someone-else") });

            var act = () => _service.DeleteAsync(PatientUserId, group);

            await act.Should().ThrowAsync<ForbiddenException>();
            _repository.Verify(r => r.RemoveDocuments(It.IsAny<IEnumerable<PatientDocument>>()), Times.Never);
            _fileStore.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task DeleteAsync_ShouldFail_WhenTheUploadDoesNotExist()
        {
            _repository.Setup(r => r.GetProvidedGroupAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<PatientDocument>());

            var act = () => _service.DeleteAsync(PatientUserId, Guid.NewGuid());

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task GetByExaminationAsync_ShouldOnlyServeTheExaminingDoctor()
        {
            _staffRepository.Setup(r => r.GetByUserIdAsync(DoctorUserId)).ReturnsAsync(new StaffProfile { Id = DoctorId, UserId = DoctorUserId });
            _repository
                .Setup(r => r.GetExaminationAsync(ExaminationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Examination { Id = ExaminationId, PatientId = PatientId, DoctorId = DoctorId + 1 });

            var act = () => _service.GetByExaminationAsync(DoctorUserId, ExaminationId);

            await act.Should().ThrowAsync<ForbiddenException>();
        }

        [Fact]
        public async Task GetByExaminationAsync_ShouldReturnThePatientsUploads()
        {
            var group = Guid.NewGuid();
            _staffRepository.Setup(r => r.GetByUserIdAsync(DoctorUserId)).ReturnsAsync(new StaffProfile { Id = DoctorId, UserId = DoctorUserId });
            _repository
                .Setup(r => r.GetExaminationAsync(ExaminationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Examination { Id = ExaminationId, PatientId = PatientId, DoctorId = DoctorId });
            _repository
                .Setup(r => r.GetProvidedByPatientIdAsync(PatientId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<PatientDocument> { Stored(group, 1) });

            var result = await _service.GetByExaminationAsync(DoctorUserId, ExaminationId);

            result.Should().ContainSingle().Which.Id.Should().Be(group);
        }
    }
}

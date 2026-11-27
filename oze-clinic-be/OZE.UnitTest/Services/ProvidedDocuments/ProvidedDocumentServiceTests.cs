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

        private static CreateProvidedDocumentRequest Request(string? name = "Xét nghiệm công thức máu", string? address = "Bệnh viện Bạch Mai", DateOnly? performedOn = null,
            string? category = ProvidedDocumentConstants.Category.LabResult, string? note = null) =>
            new() { DocumentName = name, ProviderAddress = address, PerformedOn = performedOn, Category = category, Note = note };

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

            var result = await _service.CreateAsync(PatientUserId, Request(" Xét nghiệm máu ", " BV Bạch Mai ", performedOn, note: " Chụp trước khi nhổ răng "), new List<UploadedImagingFile>
            {
                File("ket-qua.PDF"),
                File("../../phim.dcm")
            });

            added.Should().HaveCount(2);
            added!.Select(d => d.UploadGroupId).Distinct().Should().ContainSingle().Which.Should().Be(result.Id);
            added.Should().OnlyContain(d =>
                d.PatientId == PatientId && d.DocumentRequestId == null && d.DocumentType == ProvidedDocumentConstants.DocumentType &&
                d.Description == "Xét nghiệm máu" && d.ProviderAddress == "BV Bạch Mai" && d.PerformedOn == performedOn && d.UploadedByUserId == PatientUserId &&
                d.Category == ProvidedDocumentConstants.Category.LabResult && d.Note == "Chụp trước khi nhổ răng" && d.SeenAt == null);
            added[1].FileName.Should().Be("phim.dcm");
            added[1].MimeType.Should().Be("application/dicom");
            savedPaths.Should().OnlyContain(p => p.StartsWith("documents/") && p.Contains("/PD-") && !p.Contains(".."));
            result.DocumentName.Should().Be("Xét nghiệm máu");
            result.Files.Should().HaveCount(2);
            _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(null, ProvidedDocumentConstants.Category.Imaging, ErrorConstants.ProvidedDocumentMessage.DocumentNameRequired)]
        [InlineData("   ", ProvidedDocumentConstants.Category.Imaging, ErrorConstants.ProvidedDocumentMessage.DocumentNameRequired)]
        [InlineData("Tên", null, ErrorConstants.ProvidedDocumentMessage.CategoryInvalid)]
        [InlineData("Tên", "Video", ErrorConstants.ProvidedDocumentMessage.CategoryInvalid)]
        public async Task CreateAsync_ShouldRequireNameAndKnownCategory(string? name, string? category, string message)
        {
            var act = () => _service.CreateAsync(PatientUserId, Request(name, category: category), new List<UploadedImagingFile> { File("a.pdf") });

            (await act.Should().ThrowAsync<BadRequestException>()).WithMessage(message);
            _fileStore.Verify(s => s.SaveAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("  ")]
        public async Task CreateAsync_ShouldAcceptNoProvider(string? address)
        {
            List<PatientDocument>? added = null;
            _repository
                .Setup(r => r.AddDocuments(It.IsAny<IEnumerable<PatientDocument>>()))
                .Callback<IEnumerable<PatientDocument>>(documents => added = documents.ToList());

            var result = await _service.CreateAsync(PatientUserId, Request(address: address), new List<UploadedImagingFile> { File("a.pdf") });

            added.Should().ContainSingle().Which.ProviderAddress.Should().BeNull();
            result.ProviderAddress.Should().BeEmpty();
        }

        [Fact]
        public async Task CreateAsync_ShouldRejectTooLongFields()
        {
            var longName = () => _service.CreateAsync(PatientUserId, Request(new string('a', 201)), new List<UploadedImagingFile> { File("a.pdf") });
            var longAddress = () => _service.CreateAsync(PatientUserId, Request(address: new string('a', 301)), new List<UploadedImagingFile> { File("a.pdf") });

            (await longName.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.ProvidedDocumentMessage.DocumentNameInvalid);
            var longNote = () => _service.CreateAsync(PatientUserId, Request(note: new string('a', 501)), new List<UploadedImagingFile> { File("a.pdf") });

            (await longAddress.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.ProvidedDocumentMessage.ProviderAddressInvalid);
            (await longNote.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.ProvidedDocumentMessage.NoteInvalid);
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
        public async Task DeleteAsync_ShouldRefuse_WhenADoctorHasSeenIt()
        {
            var group = Guid.NewGuid();
            var seen = Stored(group, 1);
            seen.SeenAt = DateTimeOffset.UtcNow;
            _repository.Setup(r => r.GetProvidedGroupAsync(group, It.IsAny<CancellationToken>())).ReturnsAsync(new List<PatientDocument> { seen, Stored(group, 2) });

            var act = () => _service.DeleteAsync(PatientUserId, group);

            (await act.Should().ThrowAsync<ForbiddenException>()).WithMessage(ErrorConstants.ProvidedDocumentMessage.CannotDeleteSeen);
            _repository.Verify(r => r.RemoveDocuments(It.IsAny<IEnumerable<PatientDocument>>()), Times.Never);
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

        [Fact]
        public async Task GetByExaminationAsync_ShouldMarkUnseenUploadsSeenByTheDoctor()
        {
            var group = Guid.NewGuid();
            var earlier = DateTimeOffset.UtcNow.AddDays(-3);
            var doctor = new StaffProfile { Id = DoctorId, UserId = DoctorUserId, FullName = "BS. Trần Minh Khoa" };
            var otherDoctor = new StaffProfile { Id = DoctorId + 1, FullName = "BS. Lê Thu Hà" };
            var alreadySeen = Stored(Guid.NewGuid(), 2);
            alreadySeen.SeenAt = earlier;
            alreadySeen.SeenByDoctorId = otherDoctor.Id;
            alreadySeen.SeenByDoctor = otherDoctor;
            var unseen = Stored(group, 1);
            _staffRepository.Setup(r => r.GetByUserIdAsync(DoctorUserId)).ReturnsAsync(doctor);
            _repository
                .Setup(r => r.GetExaminationAsync(ExaminationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Examination { Id = ExaminationId, PatientId = PatientId, DoctorId = DoctorId });
            _repository
                .Setup(r => r.GetProvidedByPatientIdAsync(PatientId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<PatientDocument> { unseen, alreadySeen });

            var result = await _service.GetByExaminationAsync(DoctorUserId, ExaminationId);

            unseen.SeenAt.Should().NotBeNull();
            unseen.SeenByDoctorId.Should().Be(DoctorId);
            alreadySeen.SeenAt.Should().Be(earlier);
            alreadySeen.SeenByDoctorId.Should().Be(otherDoctor.Id);
            var mine = result.Single(d => d.Id == group);
            mine.SeenByDoctorName.Should().Be("BS. Trần Minh Khoa");
            mine.CanDelete.Should().BeFalse();
            _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetMineAsync_ShouldLetThePatientDeleteOnlyUnseenUploads()
        {
            var unseenGroup = Guid.NewGuid();
            var seenGroup = Guid.NewGuid();
            var seen = Stored(seenGroup, 2);
            seen.SeenAt = DateTimeOffset.UtcNow;
            _repository
                .Setup(r => r.GetProvidedByPatientIdAsync(PatientId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<PatientDocument> { Stored(unseenGroup, 1), seen });

            var result = await _service.GetMineAsync(PatientUserId);

            result.Single(d => d.Id == unseenGroup).CanDelete.Should().BeTrue();
            result.Single(d => d.Id == seenGroup).CanDelete.Should().BeFalse();
            _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}

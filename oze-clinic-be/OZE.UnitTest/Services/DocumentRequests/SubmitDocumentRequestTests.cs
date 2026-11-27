using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.UnitTest.Services.DocumentRequests
{
    public class SubmitDocumentRequestTests : DocumentRequestTestBase
    {
        [Theory]
        [InlineData(DocumentRequestConstants.Pending)]
        [InlineData(DocumentRequestConstants.Submitted)]
        public async Task SubmitAsync_ShouldStoreFiles_MarkSubmitted_AndNotifyDoctor(string status)
        {
            var request = SetupRequest(status);
            List<PatientDocument>? added = null;
            _repository
                .Setup(r => r.AddDocuments(It.IsAny<IEnumerable<PatientDocument>>()))
                .Callback<IEnumerable<PatientDocument>>(documents => added = documents.ToList());
            var savedPaths = new List<string>();
            _fileStore
                .Setup(s => s.SaveAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<CancellationToken>()))
                .Callback<string, byte[], CancellationToken>((path, _, _) => savedPaths.Add(path))
                .Returns(Task.CompletedTask);

            var result = await _service.SubmitAsync(PatientUserId, RequestId, new List<UploadedImagingFile>
            {
                File("ket-qua.PDF"),
                File("../../phim.jpeg")
            });

            request.Status.Should().Be(DocumentRequestConstants.Submitted);
            request.UpdatedAt.Should().NotBeNull();
            added.Should().HaveCount(2);
            added!.Should().OnlyContain(d => d.PatientId == PatientId && d.DocumentRequestId == RequestId && d.UploadedByUserId == PatientUserId);
            added[0].MimeType.Should().Be("application/pdf");
            added[1].MimeType.Should().Be("image/jpeg");
            added[1].FileName.Should().Be("phim.jpeg");
            // The stored name is made by the server; only the checked extension is kept
            savedPaths.Should().HaveCount(2);
            savedPaths.Should().OnlyContain(p => p.StartsWith("documents/") && p.Contains("/DR-77/") && !p.Contains(".."));
            savedPaths[0].Should().EndWith(".pdf");
            savedPaths[1].Should().EndWith(".jpeg");
            result.Status.Should().Be(DocumentRequestConstants.Submitted);
            result.Files.Should().HaveCount(2);
            _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
            _notifications.Verify(n => n.NotifyStaffAsync(DoctorId,
                It.Is<NotificationContent>(c => c.Title == NotificationConstants.Text.DocumentSubmittedTitle && c.ReferenceId == RequestId.ToString()),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SubmitAsync_ShouldKeepTheTypeAndWhatThePatientFilledIn()
        {
            var request = SetupRequest();
            request.Category = ProvidedDocumentConstants.Category.Imaging;
            List<PatientDocument>? added = null;
            _repository
                .Setup(r => r.AddDocuments(It.IsAny<IEnumerable<PatientDocument>>()))
                .Callback<IEnumerable<PatientDocument>>(documents => added = documents.ToList());
            var performedOn = new DateOnly(2026, 10, 20);

            var result = await _service.SubmitAsync(PatientUserId, RequestId, new List<UploadedImagingFile> { File("phim.png") },
                new SubmitDocumentRequestDetails { Note = " Chụp ở BV Răng Hàm Mặt ", PerformedOn = performedOn, ProviderAddress = " BV Răng Hàm Mặt " });

            added.Should().ContainSingle().Which.Should().Match<PatientDocument>(d =>
                d.Category == ProvidedDocumentConstants.Category.Imaging && d.Note == "Chụp ở BV Răng Hàm Mặt" &&
                d.PerformedOn == performedOn && d.ProviderAddress == "BV Răng Hàm Mặt");
            result.Category.Should().Be(ProvidedDocumentConstants.Category.Imaging);
            result.PatientNote.Should().Be("Chụp ở BV Răng Hàm Mặt");
            result.PerformedOn.Should().Be(performedOn);
        }

        [Fact]
        public async Task SubmitAsync_ShouldRejectAPerformedDateInTheFuture()
        {
            SetupRequest();

            var act = () => _service.SubmitAsync(PatientUserId, RequestId, new List<UploadedImagingFile> { File("a.png") },
                new SubmitDocumentRequestDetails { PerformedOn = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)) });

            (await act.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.ProvidedDocumentMessage.PerformedOnInFuture);
            _fileStore.Verify(s => s.SaveAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task SubmitAsync_ShouldWorkAfterTheExaminationEnded()
        {
            // The examination state is never checked when the patient submits
            SetupRequest();

            var result = await _service.SubmitAsync(PatientUserId, RequestId, new List<UploadedImagingFile> { File("a.png") });

            result.Status.Should().Be(DocumentRequestConstants.Submitted);
            _repository.Verify(r => r.GetExaminationAsync(It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        public static IEnumerable<object[]> InvalidFiles => new[]
        {
            new object[] { new List<UploadedImagingFile>(), ErrorConstants.DocumentRequestMessage.UploadFilesRequired },
            new object[] { new List<UploadedImagingFile> { File("ok.pdf"), File("virus.exe") }, "virus.exe is not a supported file. Use .pdf, .jpg, .jpeg or .png." },
            new object[] { new List<UploadedImagingFile> { File("ok.pdf"), File("empty.png", 0) }, "empty.png is empty." },
            new object[] { new List<UploadedImagingFile> { File("ok.pdf"), File("big.jpg", (int)DocumentRequestConstants.UploadMaxFileBytes + 1) }, "big.jpg is larger than 20 MB." },
            new object[] { Enumerable.Range(1, 11).Select(i => File($"f{i}.pdf")).ToList(), ErrorConstants.DocumentRequestMessage.UploadTooManyFiles },
        };

        [Theory]
        [MemberData(nameof(InvalidFiles))]
        public async Task SubmitAsync_ShouldRejectInvalidFiles_AndStoreNone(List<UploadedImagingFile> files, string message)
        {
            var request = SetupRequest();

            var act = () => _service.SubmitAsync(PatientUserId, RequestId, files);

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(message);
            request.Status.Should().Be(DocumentRequestConstants.Pending);
            _fileStore.Verify(s => s.SaveAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<CancellationToken>()), Times.Never);
            _repository.Verify(r => r.AddDocuments(It.IsAny<IEnumerable<PatientDocument>>()), Times.Never);
            _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task SubmitAsync_ShouldAcceptTenFilesOfExactly20Mb()
        {
            SetupRequest();
            var files = Enumerable.Range(1, 10).Select(i => File($"f{i}.png", i == 1 ? (int)DocumentRequestConstants.UploadMaxFileBytes : 16)).ToList();

            var result = await _service.SubmitAsync(PatientUserId, RequestId, files);

            result.Files.Should().HaveCount(10);
        }

        [Fact]
        public async Task SubmitAsync_ShouldRejectAnotherPatient()
        {
            SetupRequest(ownerUserId: "someone-else");

            var act = () => _service.SubmitAsync(PatientUserId, RequestId, new List<UploadedImagingFile> { File("a.pdf") });

            await act.Should().ThrowAsync<ForbiddenException>();
            _fileStore.Verify(s => s.SaveAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task SubmitAsync_ShouldRejectCancelledRequest()
        {
            SetupRequest(DocumentRequestConstants.Cancelled);

            var act = () => _service.SubmitAsync(PatientUserId, RequestId, new List<UploadedImagingFile> { File("a.pdf") });

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.DocumentRequestMessage.RequestCancelledCannotSubmit);
            _fileStore.Verify(s => s.SaveAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task SubmitAsync_ShouldRejectUnknownRequest()
        {
            var act = () => _service.SubmitAsync(PatientUserId, 404, new List<UploadedImagingFile> { File("a.pdf") });

            await act.Should().ThrowAsync<NotFoundException>();
        }
    }
}

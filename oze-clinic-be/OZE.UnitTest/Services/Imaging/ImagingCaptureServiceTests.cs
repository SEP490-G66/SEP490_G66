using System.Net;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Imaging
{
    // Imaging request 99 (Panoramic, "Tooth 36") of examination 10, technician 7, simulator capture SIM-1
    public abstract class ImagingCaptureTestBase
    {
        protected const long RequestId = 99;
        protected const string TechnicianUserId = "tech-user";
        protected const string SimulationId = "SIM-1";

        protected readonly Mock<IImagingCaptureRepository> _captures = new();
        protected readonly Mock<IImagingRequestRepository> _requests = new();
        protected readonly Mock<IStaffRepository> _staff = new();
        protected readonly Mock<IImagingRequestService> _requestService = new();
        protected readonly Mock<ISimulatorClient> _simulator = new();
        protected readonly Mock<IImagingFileStore> _files = new();
        protected readonly ImagingCaptureService _service;
        protected readonly ImagingRequest _request = new()
        {
            Id = RequestId,
            ExaminationId = 10,
            ImagingType = ImagingRequestConstants.Panoramic,
            TargetArea = "Tooth 36",
            RequestStatus = ImagingRequestConstants.Pending
        };

        protected ImagingCaptureTestBase()
        {
            _service = new ImagingCaptureService(_captures.Object, _requests.Object, _staff.Object, _requestService.Object,
                _simulator.Object, _files.Object, new Mock<ILogger<ImagingCaptureService>>().Object);

            _staff.Setup(r => r.GetByUserIdAsync(TechnicianUserId)).ReturnsAsync(new StaffProfile { Id = 7, UserId = TechnicianUserId });
            _requests.Setup(r => r.GetTrackedByIdAsync(RequestId, It.IsAny<CancellationToken>())).ReturnsAsync(_request);
            // The completion check after storing pictures reads the request without tracking
            _requests.Setup(r => r.GetByIdAsync(RequestId, It.IsAny<CancellationToken>())).ReturnsAsync(_request);
            _captures.Setup(r => r.GetResultsAsync(RequestId, It.IsAny<CancellationToken>())).ReturnsAsync(new List<ImagingResult>());
        }

        protected ImagingCapture RunningCapture(string status = ImagingCaptureConstants.Capturing)
        {
            var capture = new ImagingCapture
            {
                ImagingRequestId = RequestId,
                TechnicianId = 7,
                SimulationId = SimulationId,
                DeviceId = "XR-PANO-01",
                Modality = ImagingCaptureConstants.ModalityPanoramic,
                BodyRegion = "Tooth 36",
                ImageCount = 2,
                Kv = 70,
                Status = status,
                Progress = 10,
                CreatedAt = new DateTimeOffset(2026, 11, 16, 9, 0, 0, TimeSpan.Zero)
            };
            _captures.Setup(r => r.GetBySimulationIdAsync(SimulationId, It.IsAny<CancellationToken>())).ReturnsAsync(capture);
            return capture;
        }

        protected static SimulatorCapture SimulatorState(string status, int progress = 0, params SimulatorImage[] images) => new()
        {
            SimulationId = SimulationId,
            OrderReference = "IR-99",
            DeviceId = "XR-PANO-01",
            Modality = ImagingCaptureConstants.ModalityPanoramic,
            Status = status,
            Progress = progress,
            Images = images.ToList()
        };

        protected static SimulatorImage Image(int sequence) => new()
        {
            ImageId = $"IMG-{SimulationId}-{sequence}",
            FileName = $"panoramic_{SimulationId}_{sequence}.png",
            ContentType = "image/png",
            SequenceNumber = sequence,
            BodyRegion = "Tooth 36"
        };

        protected void SimulatorReturns(SimulatorCapture state) =>
            _simulator.Setup(s => s.GetCaptureAsync(SimulationId, It.IsAny<CancellationToken>())).ReturnsAsync(SimulatorResult<SimulatorCapture>.Ok(state));

        protected void ImagesDownload() =>
            _simulator.Setup(s => s.DownloadImageAsync(SimulationId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(SimulatorResult<byte[]>.Ok(new byte[] { 1, 2, 3 }));
    }

    public class StartImagingCaptureTests : ImagingCaptureTestBase
    {
        private static StartImagingCaptureRequest Body(string deviceId = "XR-PANO-01", int imageCount = 1) =>
            new() { DeviceId = deviceId, ImageCount = imageCount, Kv = 70, Ma = 10, ExposureSeconds = 12 };

        private void SimulatorAccepts() =>
            _simulator.Setup(s => s.StartCaptureAsync(It.IsAny<SimulatorCaptureRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(SimulatorResult<SimulatorCapture>.Ok(SimulatorState(ImagingCaptureConstants.Accepted)));

        [Fact]
        public async Task StartAsync_ShouldSendOrderAndRecordCapture()
        {
            SimulatorAccepts();

            var result = await _service.StartAsync(TechnicianUserId, RequestId, Body());

            result.SimulationId.Should().Be(SimulationId);
            result.Status.Should().Be(ImagingCaptureConstants.Accepted);
            _request.RequestStatus.Should().Be(ImagingRequestConstants.InProgress);
            _simulator.Verify(s => s.StartCaptureAsync(It.Is<SimulatorCaptureRequest>(r =>
                r.OrderReference == "IR-99" && r.Modality == ImagingCaptureConstants.ModalityPanoramic && r.BodyRegion == "Tooth 36"
                && r.DeviceId == "XR-PANO-01" && r.Exposure!.KV == 70), It.IsAny<CancellationToken>()), Times.Once);
            _captures.Verify(r => r.AddAsync(It.Is<ImagingCapture>(c => c.TechnicianId == 7 && c.SimulationId == SimulationId), It.IsAny<CancellationToken>()), Times.Once);
            _captures.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task StartAsync_ShouldUsePeriapicalModality_ForPeriapicalRequest()
        {
            _request.ImagingType = ImagingRequestConstants.PeriapicalXRay;
            SimulatorAccepts();

            await _service.StartAsync(TechnicianUserId, RequestId, Body("XR-IO-01"));

            _simulator.Verify(s => s.StartCaptureAsync(It.Is<SimulatorCaptureRequest>(r => r.Modality == ImagingCaptureConstants.ModalityPeriapical),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task StartAsync_ShouldThrow_WhenNoDevice()
        {
            var act = () => _service.StartAsync(TechnicianUserId, RequestId, Body(deviceId: "  "));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ImagingCaptureMessage.DeviceRequired);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(11)]
        public async Task StartAsync_ShouldThrow_WhenImageCountOutOfRange(int imageCount)
        {
            var act = () => _service.StartAsync(TechnicianUserId, RequestId, Body(imageCount: imageCount));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ImagingCaptureMessage.ImageCountInvalid);
        }

        [Fact]
        public async Task StartAsync_ShouldThrow_WhenTechnicianNotFound()
        {
            var act = () => _service.StartAsync("someone-else", RequestId, Body());

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.ImagingCaptureMessage.TechnicianNotFound);
        }

        [Fact]
        public async Task StartAsync_ShouldThrow_WhenRequestNotFound()
        {
            var act = () => _service.StartAsync(TechnicianUserId, 404, Body());

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.ImagingRequestMessage.RequestNotFound);
        }

        [Fact]
        public async Task StartAsync_ShouldThrow_WhenRequestAlreadyCompleted()
        {
            _request.RequestStatus = ImagingRequestConstants.Completed;

            var act = () => _service.StartAsync(TechnicianUserId, RequestId, Body());

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should()
                .Be(string.Format(ErrorConstants.ImagingCaptureMessage.RequestNotOpen, ImagingRequestConstants.Completed));
        }

        [Fact]
        public async Task StartAsync_ShouldThrow_WhenDeviceCannotTakeType()
        {
            _request.ImagingType = ImagingRequestConstants.Cbct;

            var act = () => _service.StartAsync(TechnicianUserId, RequestId, Body());

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should()
                .Be(string.Format(ErrorConstants.ImagingCaptureMessage.ImagingTypeNotSupported, ImagingRequestConstants.Cbct));
        }

        [Fact]
        public async Task StartAsync_ShouldThrow_WhenCaptureAlreadyRunning()
        {
            _captures.Setup(r => r.HasRunningCaptureAsync(RequestId, It.IsAny<CancellationToken>())).ReturnsAsync(true);

            var act = () => _service.StartAsync(TechnicianUserId, RequestId, Body());

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ImagingCaptureMessage.CaptureAlreadyRunning);
        }

        [Fact]
        public async Task StartAsync_ShouldThrow503_WhenSimulatorUnreachable()
        {
            _simulator.Setup(s => s.StartCaptureAsync(It.IsAny<SimulatorCaptureRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(SimulatorResult<SimulatorCapture>.Fail(0, "Connection refused", unreachable: true));

            var act = () => _service.StartAsync(TechnicianUserId, RequestId, Body());

            var error = (await act.Should().ThrowAsync<AppException>()).Which;
            error.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
            error.Message.Should().Be(ErrorConstants.ImagingCaptureMessage.SimulatorUnavailable);
            _captures.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task StartAsync_ShouldThrow_WhenSimulatorRefuses()
        {
            _simulator.Setup(s => s.StartCaptureAsync(It.IsAny<SimulatorCaptureRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(SimulatorResult<SimulatorCapture>.Fail(409, "Device XR-PANO-01 is busy"));

            var act = () => _service.StartAsync(TechnicianUserId, RequestId, Body());

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should()
                .Be(string.Format(ErrorConstants.ImagingCaptureMessage.SimulatorRejected, "Device XR-PANO-01 is busy"));
        }
    }

    public class GetImagingCaptureTests : ImagingCaptureTestBase
    {
        [Fact]
        public async Task GetAsync_ShouldUpdateProgress_WhileCapturing()
        {
            var capture = RunningCapture();
            SimulatorReturns(SimulatorState(ImagingCaptureConstants.Capturing, 40));

            var result = await _service.GetAsync(RequestId, SimulationId);

            result.Progress.Should().Be(40);
            capture.Status.Should().Be(ImagingCaptureConstants.Capturing);
        }

        [Fact]
        public async Task GetAsync_ShouldStorePicturesAndCompleteRequest_WhenDeviceIsDone()
        {
            var capture = RunningCapture();
            SimulatorReturns(SimulatorState(ImagingCaptureConstants.Completed, 100, Image(1), Image(2)));
            ImagesDownload();
            List<ImagingResult>? added = null;
            _captures.Setup(r => r.AddResults(It.IsAny<IEnumerable<ImagingResult>>())).Callback<IEnumerable<ImagingResult>>(r => added = r.ToList());

            await _service.GetAsync(RequestId, SimulationId);

            capture.Status.Should().Be(ImagingCaptureConstants.Completed);
            capture.Progress.Should().Be(100);
            added.Should().HaveCount(2);
            added![0].FilePath.Should().Be("2026/11/IR-99/SIM-1_1.png");
            added[0].UploadedByTechnicianId.Should().Be(7);
            added[0].FileSize.Should().Be(3);
            added[0].ReviewStatus.Should().Be(MedicalRecordConstants.PendingImageStatus);
            added[0].TechnicianNotes.Should().Be("XR-PANO-01 · PANORAMIC · Tooth 36 · 1/2 · 70 kV");
            _files.Verify(f => f.SaveAsync("2026/11/IR-99/SIM-1_2.png", It.IsAny<byte[]>(), It.IsAny<CancellationToken>()), Times.Once);
            _requestService.Verify(s => s.CompleteAsync(RequestId, null, null, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetAsync_ShouldMarkFailed_WhenDeviceLostTheCapture()
        {
            var capture = RunningCapture();
            _simulator.Setup(s => s.GetCaptureAsync(SimulationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(SimulatorResult<SimulatorCapture>.Fail(404, "not found"));

            var result = await _service.GetAsync(RequestId, SimulationId);

            result.Status.Should().Be(ImagingCaptureConstants.Failed);
            capture.FailureCode.Should().Be("SESSION_LOST");
        }

        [Fact]
        public async Task GetAsync_ShouldKeepState_WhenSimulatorUnreachable()
        {
            RunningCapture();
            _simulator.Setup(s => s.GetCaptureAsync(SimulationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(SimulatorResult<SimulatorCapture>.Fail(0, "Timeout", unreachable: true));

            var result = await _service.GetAsync(RequestId, SimulationId);

            result.Status.Should().Be(ImagingCaptureConstants.Capturing);
            _captures.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task GetAsync_ShouldThrow_WhenCaptureBelongsToAnotherRequest()
        {
            RunningCapture();

            var act = () => _service.GetAsync(5, SimulationId);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.ImagingCaptureMessage.CaptureNotFound);
        }
    }

    public class CancelImagingCaptureTests : ImagingCaptureTestBase
    {
        [Fact]
        public async Task CancelAsync_ShouldCancelOnDevice()
        {
            var capture = RunningCapture();
            _simulator.Setup(s => s.CancelCaptureAsync(SimulationId, It.IsAny<CancellationToken>())).ReturnsAsync(SimulatorResult<bool>.Ok(true));

            var result = await _service.CancelAsync(RequestId, SimulationId);

            result.Status.Should().Be(ImagingCaptureConstants.Cancelled);
            capture.CompletedAt.Should().NotBeNull();
        }

        [Fact]
        public async Task CancelAsync_ShouldThrow_WhenCaptureFinished()
        {
            RunningCapture(ImagingCaptureConstants.Completed);

            var act = () => _service.CancelAsync(RequestId, SimulationId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should()
                .Be(string.Format(ErrorConstants.ImagingCaptureMessage.CaptureNotRunning, ImagingCaptureConstants.Completed));
            _simulator.Verify(s => s.CancelCaptureAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }

    public class ImagingCaptureWebhookTests : ImagingCaptureTestBase
    {
        private static ImagingSimulatorWebhookPayload Event(string eventType, string state, string? failureMessage = null) => new()
        {
            EventId = "evt-1",
            EventType = eventType,
            SimulationId = SimulationId,
            OrderReference = "IR-99",
            State = state,
            Progress = state == ImagingCaptureConstants.Completed ? 100 : 55,
            FailureCode = failureMessage == null ? null : "DEVICE_FAULT",
            FailureMessage = failureMessage
        };

        [Fact]
        public async Task HandleWebhookAsync_ShouldOnlyCompleteRequest_WhenCaptureNotStartedFromOze()
        {
            var payload = Event(ImagingCaptureConstants.EventCompleted, ImagingCaptureConstants.Completed);
            _requestService.Setup(s => s.ProcessSimulatorWebhookAsync(payload, It.IsAny<CancellationToken>())).ReturnsAsync(true);

            var handled = await _service.HandleWebhookAsync(payload);

            handled.Should().BeTrue();
            _requestService.Verify(s => s.ProcessSimulatorWebhookAsync(payload, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task HandleWebhookAsync_ShouldStorePictures_WhenCaptureCompleted()
        {
            var capture = RunningCapture();
            SimulatorReturns(SimulatorState(ImagingCaptureConstants.Completed, 100, Image(1)));
            ImagesDownload();

            var handled = await _service.HandleWebhookAsync(Event(ImagingCaptureConstants.EventCompleted, ImagingCaptureConstants.Completed));

            handled.Should().BeTrue();
            capture.Status.Should().Be(ImagingCaptureConstants.Completed);
            _files.Verify(f => f.SaveAsync("2026/11/IR-99/SIM-1_1.png", It.IsAny<byte[]>(), It.IsAny<CancellationToken>()), Times.Once);
            _requestService.Verify(s => s.CompleteAsync(RequestId, null, null, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task HandleWebhookAsync_ShouldAskForResend_WhenPictureCannotBeDownloaded()
        {
            var capture = RunningCapture();
            SimulatorReturns(SimulatorState(ImagingCaptureConstants.Completed, 100, Image(1)));
            _simulator.Setup(s => s.DownloadImageAsync(SimulationId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(SimulatorResult<byte[]>.Fail(0, "Timeout", unreachable: true));

            var handled = await _service.HandleWebhookAsync(Event(ImagingCaptureConstants.EventCompleted, ImagingCaptureConstants.Completed));

            handled.Should().BeFalse();
            capture.Status.Should().Be(ImagingCaptureConstants.Capturing);
            _requestService.Verify(s => s.CompleteAsync(It.IsAny<long>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task HandleWebhookAsync_ShouldRecordFailure_WhenDeviceFails()
        {
            var capture = RunningCapture();

            var handled = await _service.HandleWebhookAsync(Event(ImagingCaptureConstants.EventFailed, ImagingCaptureConstants.Failed, "Tube overheated"));

            handled.Should().BeTrue();
            capture.Status.Should().Be(ImagingCaptureConstants.Failed);
            capture.FailureMessage.Should().Be("Tube overheated");
            _requestService.Verify(s => s.CompleteAsync(It.IsAny<long>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task HandleWebhookAsync_ShouldIgnore_WhenCaptureAlreadyFinished()
        {
            RunningCapture(ImagingCaptureConstants.Completed);

            var handled = await _service.HandleWebhookAsync(Event(ImagingCaptureConstants.EventCompleted, ImagingCaptureConstants.Completed));

            handled.Should().BeTrue();
            _captures.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }
    }

    public class GetImagingResultFileTests : ImagingCaptureTestBase
    {
        private void Result(string filePath, string? patientUserId = "patient-user") =>
            _captures.Setup(r => r.GetResultWithOwnerAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(new ImagingResult
            {
                Id = 1,
                FilePath = filePath,
                FileName = "pano.png",
                MimeType = "image/png",
                ImagingRequest = new ImagingRequest { Examination = new Examination { Patient = new Patient { UserId = patientUserId } } }
            });

        [Fact]
        public async Task GetResultFileAsync_ShouldReturnFile_ForOwnPatient()
        {
            Result("2026/11/IR-99/SIM-1_1.png");
            _files.Setup(f => f.ReadAsync("2026/11/IR-99/SIM-1_1.png", It.IsAny<CancellationToken>())).ReturnsAsync(new byte[] { 9 });

            var file = await _service.GetResultFileAsync("patient-user", isPatient: true, 1);

            file.Data.Should().Equal(9);
            file.ContentType.Should().Be("image/png");
        }

        [Fact]
        public async Task GetResultFileAsync_ShouldThrow_ForAnotherPatient()
        {
            Result("2026/11/IR-99/SIM-1_1.png");

            var act = () => _service.GetResultFileAsync("other-patient", isPatient: true, 1);

            (await act.Should().ThrowAsync<ForbiddenException>()).Which.Message.Should().Be(ErrorConstants.ImagingCaptureMessage.CannotViewResult);
        }

        [Fact]
        public async Task GetResultFileAsync_ShouldThrow_ForSampleFilm()
        {
            Result("mock/xray/pano_01.png");

            var act = () => _service.GetResultFileAsync("doctor-user", isPatient: false, 1);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task GetResultFileAsync_ShouldThrow_WhenFileMissingOnDisk()
        {
            Result("2026/11/IR-99/SIM-1_1.png");
            _files.Setup(f => f.ReadAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync((byte[]?)null);

            var act = () => _service.GetResultFileAsync("doctor-user", isPatient: false, 1);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.ImagingCaptureMessage.ResultNotFound);
        }
    }

    public class LocalImagingFileStoreTests : IDisposable
    {
        private readonly string _root = Path.Combine(Path.GetTempPath(), "oze-imaging-test-" + Guid.NewGuid().ToString("N"));
        private readonly LocalImagingFileStore _store;

        public LocalImagingFileStoreTests()
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { [ImagingCaptureConstants.StorageRootConfigKey] = _root })
                .Build();
            _store = new LocalImagingFileStore(configuration, new Mock<IHostEnvironment>().Object);
        }

        [Fact]
        public async Task SaveAsync_ThenReadAsync_ShouldReturnSameBytes()
        {
            await _store.SaveAsync("2026/11/IR-99/SIM-1_1.png", new byte[] { 1, 2, 3 });

            (await _store.ReadAsync("2026/11/IR-99/SIM-1_1.png")).Should().Equal(1, 2, 3);
        }

        [Fact]
        public async Task ReadAsync_ShouldReturnNull_WhenFileMissing()
        {
            (await _store.ReadAsync("2026/11/none.png")).Should().BeNull();
        }

        [Fact]
        public async Task ReadAsync_ShouldRefuse_PathOutsideRoot()
        {
            var act = () => _store.ReadAsync("../../secret.txt");

            await act.Should().ThrowAsync<InvalidOperationException>();
        }

        public void Dispose()
        {
            if (Directory.Exists(_root))
            {
                Directory.Delete(_root, recursive: true);
            }
        }
    }

    // OZ-IMG-07 UploadImagingResult — technician uploads images by hand
    [Trait("Tab", "OZ-IMG-07")]
    public class UploadImagingResultTests : ImagingCaptureTestBase
    {
        private static UploadedImagingFile Png(string name = "pano.png", byte[]? data = null) =>
            new(name, "image/png", data ?? new byte[] { 1, 2, 3, 4 });

        // UTCID01 (N): upload one PNG on a pending request → saved and request moves to InProgress
        [Fact]
        public async Task UploadAsync_ShouldSaveImage_WhenRequestPending()
        {
            List<ImagingResult>? added = null;
            _files.Setup(f => f.SaveAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _captures.Setup(r => r.AddResults(It.IsAny<IEnumerable<ImagingResult>>()))
                .Callback<IEnumerable<ImagingResult>>(rows => added = rows.ToList());
            _captures.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var result = await _service.UploadAsync(TechnicianUserId, RequestId, new List<UploadedImagingFile> { Png() }, "  note  ");

            result.Should().ContainSingle();
            result[0].FileName.Should().Be("pano.png");
            added.Should().ContainSingle();
            added![0].UploadedByTechnicianId.Should().Be(7);
            added[0].TechnicianNotes.Should().Be("note");
            _request.RequestStatus.Should().Be(ImagingRequestConstants.InProgress);
            _files.Verify(f => f.SaveAsync(It.Is<string>(p => p.EndsWith(".png")), It.IsAny<byte[]>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (A): no files chosen
        [Fact]
        public async Task UploadAsync_ShouldThrow_WhenNoFiles()
        {
            var act = () => _service.UploadAsync(TechnicianUserId, RequestId, new List<UploadedImagingFile>(), null);

            (await act.Should().ThrowAsync<BadRequestException>())
                .Which.Message.Should().Be(ErrorConstants.ImagingCaptureMessage.UploadFilesRequired);
        }

        // UTCID03 (A): unsupported extension
        [Fact]
        public async Task UploadAsync_ShouldThrow_WhenFileTypeInvalid()
        {
            var act = () => _service.UploadAsync(TechnicianUserId, RequestId,
                new List<UploadedImagingFile> { new("report.pdf", "application/pdf", new byte[] { 1 }) }, null);

            (await act.Should().ThrowAsync<BadRequestException>())
                .Which.Message.Should().Be(string.Format(ErrorConstants.ImagingCaptureMessage.UploadFileTypeInvalid, "report.pdf"));
        }

        // UTCID04 (B): empty file bytes
        [Fact]
        public async Task UploadAsync_ShouldThrow_WhenFileEmpty()
        {
            var act = () => _service.UploadAsync(TechnicianUserId, RequestId,
                new List<UploadedImagingFile> { Png(data: Array.Empty<byte>()) }, null);

            (await act.Should().ThrowAsync<BadRequestException>())
                .Which.Message.Should().Be(string.Format(ErrorConstants.ImagingCaptureMessage.UploadFileEmpty, "pano.png"));
        }

        // UTCID05 (A): imaging request already completed
        [Fact]
        public async Task UploadAsync_ShouldThrow_WhenRequestNotOpen()
        {
            _request.RequestStatus = ImagingRequestConstants.Completed;

            var act = () => _service.UploadAsync(TechnicianUserId, RequestId, new List<UploadedImagingFile> { Png() }, null);

            (await act.Should().ThrowAsync<BadRequestException>())
                .Which.Message.Should().Be(string.Format(ErrorConstants.ImagingCaptureMessage.RequestNotOpen, ImagingRequestConstants.Completed));
        }
    }
}

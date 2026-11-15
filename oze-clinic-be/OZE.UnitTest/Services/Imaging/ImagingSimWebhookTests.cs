using FluentAssertions;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Imaging
{
    // OZ-WH-01 ImagingSimWebhook
    [Trait("Tab", "OZ-WH-01")]
    public class ImagingSimWebhookTests : ImagingRequestTestBase
    {
        private readonly Mock<IQueueService> _queueService = new();
        private readonly ImagingRequestService _fullService;
        private readonly ImagingRequest _request = PendingRequest();

        public ImagingSimWebhookTests()
        {
            _fullService = new ImagingRequestService(_imagingRequestRepository.Object, _staffRepository.Object,
                new Mock<IAppointmentRepository>().Object, _queueService.Object, _notificationsMock.Object);
            var examination = ExaminationInProgress();
            examination.Appointment = new Appointment { Id = 7, Status = AppointmentConstants.CheckedInStatus };
            _imagingRequestRepository.Setup(r => r.GetTrackedByIdAsync(99, It.IsAny<CancellationToken>())).ReturnsAsync(_request);
            _imagingRequestRepository.Setup(r => r.GetExaminationAsync(ExaminationId, It.IsAny<CancellationToken>())).ReturnsAsync(examination);
            _imagingRequestRepository.Setup(r => r.GetByExaminationIdAsync(ExaminationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<ImagingRequest> { _request });
        }

        private static ImagingSimulatorWebhookPayload Payload(string orderReference = "IR-99", string state = "Completed", string eventType = "capture.completed") => new()
        {
            EventId = "evt-1",
            EventType = eventType,
            OrderReference = orderReference,
            State = state
        };

        // UTCID01 (N): the capture is done, the imaging request is completed
        [Fact]
        public async Task ProcessSimulatorWebhookAsync_ShouldCompleteRequest()
        {
            var handled = await _fullService.ProcessSimulatorWebhookAsync(Payload());

            handled.Should().BeTrue();
            _request.RequestStatus.Should().Be(ImagingRequestConstants.Completed);
            _imagingRequestRepository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (N): an order reference without the "IR-" prefix is also accepted
        [Fact]
        public async Task ProcessSimulatorWebhookAsync_ShouldAcceptPlainId()
        {
            var handled = await _fullService.ProcessSimulatorWebhookAsync(Payload(orderReference: " 99 "));

            handled.Should().BeTrue();
            _request.RequestStatus.Should().Be(ImagingRequestConstants.Completed);
        }

        // UTCID03 (B): a progress event is answered but changes nothing
        [Fact]
        public async Task ProcessSimulatorWebhookAsync_ShouldIgnoreProgressEvent()
        {
            var handled = await _fullService.ProcessSimulatorWebhookAsync(Payload(state: "Exposing", eventType: "capture.progress"));

            handled.Should().BeTrue();
            _request.RequestStatus.Should().Be(ImagingRequestConstants.Pending);
        }

        // UTCID04 (B): the same event again, or a cancelled order, changes nothing
        [Fact]
        public async Task ProcessSimulatorWebhookAsync_ShouldIgnore_WhenRequestNotOpen()
        {
            _request.RequestStatus = ImagingRequestConstants.Cancelled;

            var handled = await _fullService.ProcessSimulatorWebhookAsync(Payload());

            handled.Should().BeTrue();
            _request.RequestStatus.Should().Be(ImagingRequestConstants.Cancelled);
            _imagingRequestRepository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID05 (A): an order reference that is not a number
        [Fact]
        public async Task ProcessSimulatorWebhookAsync_ShouldReject_WhenReferenceInvalid()
        {
            var handled = await _fullService.ProcessSimulatorWebhookAsync(Payload(orderReference: "IR-abc"));

            handled.Should().BeFalse();
        }

        // UTCID06 (A): no imaging request has that id
        [Fact]
        public async Task ProcessSimulatorWebhookAsync_ShouldReject_WhenRequestNotFound()
        {
            var handled = await _fullService.ProcessSimulatorWebhookAsync(Payload(orderReference: "IR-404"));

            handled.Should().BeFalse();
        }
    }
}

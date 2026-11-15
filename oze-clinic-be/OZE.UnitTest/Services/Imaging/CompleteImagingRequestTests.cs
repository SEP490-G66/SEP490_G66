using FluentAssertions;
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
    // OZ-IMG-06 CompleteImagingRequest
    [Trait("Tab", "OZ-IMG-06")]
    public class CompleteImagingRequestTests : ImagingRequestTestBase
    {
        private readonly Mock<IAppointmentRepository> _appointmentRepository = new();
        private readonly Mock<IQueueService> _queueService = new();
        private readonly ImagingRequestService _fullService;
        private readonly ImagingRequest _request = PendingRequest();
        private readonly Appointment _appointment = new() { Id = 7, Status = AppointmentConstants.CheckedInStatus };

        public CompleteImagingRequestTests()
        {
            _fullService = new ImagingRequestService(_imagingRequestRepository.Object, _staffRepository.Object,
                _appointmentRepository.Object, _queueService.Object, _notificationsMock.Object);
            var examination = ExaminationInProgress();
            examination.AppointmentId = 7;
            examination.Appointment = _appointment;
            _imagingRequestRepository.Setup(r => r.GetTrackedByIdAsync(99, It.IsAny<CancellationToken>())).ReturnsAsync(_request);
            _imagingRequestRepository.Setup(r => r.GetExaminationAsync(ExaminationId, It.IsAny<CancellationToken>())).ReturnsAsync(examination);
            _imagingRequestRepository.Setup(r => r.GetByExaminationIdAsync(ExaminationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<ImagingRequest> { _request });
        }

        // UTCID01 (N): the film is done, the doctor is told and the waiting patient goes back to the front of the examination queue
        [Fact]
        public async Task CompleteAsync_ShouldCompleteAndReturnPatientToDoctor()
        {
            var result = await _fullService.CompleteAsync(99);

            result.RequestStatus.Should().Be(ImagingRequestConstants.Completed);
            result.PatientId.Should().Be(3);
            _appointment.Priority.Should().Be(PriorityConstants.Urgent);
            _notificationsMock.Verify(n => n.NotifyStaffAsync(5, It.IsAny<NotificationContent>(), It.IsAny<CancellationToken>()), Times.Once);
            _queueService.Verify(q => q.UpdateStatusAsync(7, QueueConstants.ImagingType, QueueConstants.Completed, It.IsAny<CancellationToken>()), Times.Once);
            _queueService.Verify(q => q.UpdateStatusAsync(7, QueueConstants.ExaminationType, QueueConstants.Waiting, It.IsAny<CancellationToken>()), Times.Once);
            _queueService.Verify(q => q.UpdatePriorityAsync(7, QueueConstants.ExaminationType, PriorityConstants.Urgent, It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (N): another film of the visit is still waiting, the patient stays in the imaging queue
        [Fact]
        public async Task CompleteAsync_ShouldKeepImagingQueue_WhenAnotherRequestOpen()
        {
            _imagingRequestRepository.Setup(r => r.GetByExaminationIdAsync(ExaminationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<ImagingRequest> { _request, new() { Id = 100, ExaminationId = ExaminationId, RequestStatus = ImagingRequestConstants.Pending } });

            await _fullService.CompleteAsync(99);

            _queueService.Verify(q => q.UpdateStatusAsync(7, QueueConstants.ImagingType, QueueConstants.Completed, It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID03 (B): a patient already taken back by the doctor is left as is
        [Fact]
        public async Task CompleteAsync_ShouldNotRequeue_WhenPatientNotWaiting()
        {
            _appointment.Status = AppointmentConstants.InServiceStatus;

            await _fullService.CompleteAsync(99);

            _appointment.Priority.Should().NotBe(PriorityConstants.Urgent);
            _queueService.Verify(q => q.UpdateStatusAsync(7, QueueConstants.ExaminationType, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID04 (A): the request does not exist
        [Fact]
        public async Task CompleteAsync_ShouldThrow_WhenRequestNotFound()
        {
            var act = () => _fullService.CompleteAsync(404);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.ImagingRequestMessage.RequestNotFound);
        }

        // UTCID05 (A): a cancelled request cannot be completed
        [Fact]
        public async Task CompleteAsync_ShouldThrow_WhenRequestNotOpen()
        {
            _request.RequestStatus = ImagingRequestConstants.Cancelled;

            var act = () => _fullService.CompleteAsync(99);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message
                .Should().Be("Cannot complete imaging request because the imaging request is Cancelled.");
        }
    }
}

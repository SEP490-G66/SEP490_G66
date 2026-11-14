using FluentAssertions;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.UnitTest.Services.Imaging
{
    // OZ-IMG-01 CreateImagingRequest
    [Trait("Tab", "OZ-IMG-01")]
    public class CreateImagingRequestTests : ImagingRequestTestBase
    {
        [Fact]
        public async Task CreateAsync_ShouldSavePendingRequest_AndNotifyActiveTechnicians()
        {
            var doctor = new StaffProfile { Id = 5, UserId = DoctorUserId, FullName = "Dr An" };
            var examination = ExaminationInProgress();
            ImagingRequest? saved = null;

            _staffRepository.Setup(r => r.GetByUserIdAsync(DoctorUserId)).ReturnsAsync(doctor);
            _imagingRequestRepository
                .Setup(r => r.GetExaminationAsync(ExaminationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(examination);
            _imagingRequestRepository
                .Setup(r => r.AddAsync(It.IsAny<ImagingRequest>(), It.IsAny<CancellationToken>()))
                .Callback<ImagingRequest, CancellationToken>((request, _) =>
                {
                    request.Id = 99;
                    saved = request;
                })
                .Returns(Task.CompletedTask);

            var result = await _service.CreateAsync(DoctorUserId, ExaminationId, new CreateImagingRequest
            {
                ImagingType = " panoramic ",
                TargetArea = " Tooth 36 ",
                ClinicalIndication = " Check root "
            });

            result.Id.Should().Be(99);
            result.ExaminationId.Should().Be(ExaminationId);
            result.PatientId.Should().Be(examination.PatientId);
            result.ImagingType.Should().Be(ImagingRequestConstants.Panoramic);
            result.TargetArea.Should().Be("Tooth 36");
            result.ClinicalIndication.Should().Be("Check root");
            result.RequestStatus.Should().Be(ImagingRequestConstants.Pending);

            saved.Should().NotBeNull();
            saved!.RequestedByDoctorId.Should().Be(doctor.Id);
            saved.RequestStatus.Should().Be(ImagingRequestConstants.Pending);
            _notificationsMock.Verify(n => n.NotifyRolesAsync(
                It.Is<IReadOnlyCollection<string>>(r => r.Contains(RoleConstants.DentalImagingTechnicianRole)),
                It.Is<NotificationContent>(c => c.Message == "Chỉ định chụp Panoramic cho Lan Nguyen vừa được gửi." && c.ReferenceId == "99"),
                It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(null, "Tooth 36", "Pain", "Please enter imaging type.")]
        [InlineData("   ", "Tooth 36", "Pain", "Please enter imaging type.")]
        [InlineData("Panoramic", null, "Pain", "Please enter target area.")]
        [InlineData("Panoramic", " ", "Pain", "Please enter target area.")]
        [InlineData("Panoramic", "Tooth 36", null, "Please enter clinical indication.")]
        [InlineData("Panoramic", "Tooth 36", "  ", "Please enter clinical indication.")]
        public async Task CreateAsync_ShouldRejectMissingFields(string? imagingType, string? targetArea, string? indication, string expectedMessage)
        {
            SetupReadyExamination();

            var act = () => _service.CreateAsync(DoctorUserId, ExaminationId, new CreateImagingRequest
            {
                ImagingType = imagingType,
                TargetArea = targetArea,
                ClinicalIndication = indication
            });

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(expectedMessage);
            _imagingRequestRepository.Verify(
                r => r.AddAsync(It.IsAny<ImagingRequest>(), It.IsAny<CancellationToken>()),
                Times.Never);
        }

        [Fact]
        public async Task CreateAsync_ShouldRejectImagingTypeOutsideTheAllowedList()
        {
            SetupReadyExamination();

            var act = () => _service.CreateAsync(DoctorUserId, ExaminationId, ValidRequest("MRI"));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.ImagingRequestMessage.ImagingTypeInvalid);
        }

        [Theory]
        [InlineData("Completed")]
        [InlineData("Locked")]
        public async Task CreateAsync_ShouldRejectExaminationThatIsNotInProgress(string status)
        {
            var examination = ExaminationInProgress();
            examination.ExaminationStatus = status;
            SetupReadyExamination(examination);

            var act = () => _service.CreateAsync(DoctorUserId, ExaminationId, ValidRequest());

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be($"Cannot request imaging because the examination is {status}.");
        }

        [Fact]
        public async Task CreateAsync_ShouldRejectDoctorWhoIsNotExaminingThisVisit()
        {
            var examination = ExaminationInProgress();
            examination.DoctorId = 8;
            SetupReadyExamination(examination);

            var act = () => _service.CreateAsync(DoctorUserId, ExaminationId, ValidRequest());

            var error = await act.Should().ThrowAsync<ForbiddenException>();
            error.Which.Message.Should().Be(ErrorConstants.ImagingRequestMessage.NotExaminingDoctor);
        }

        [Fact]
        public async Task CreateAsync_ShouldReturnNotFound_WhenExaminationDoesNotExist()
        {
            _staffRepository
                .Setup(r => r.GetByUserIdAsync(DoctorUserId))
                .ReturnsAsync(new StaffProfile { Id = 5, UserId = DoctorUserId });
            _imagingRequestRepository
                .Setup(r => r.GetExaminationAsync(ExaminationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Examination?)null);

            var act = () => _service.CreateAsync(DoctorUserId, ExaminationId, ValidRequest());

            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.MedicalRecordMessage.ExaminationNotFound);
        }

        [Fact]
        public async Task CreateAsync_ShouldReturnNotFound_WhenDoctorProfileDoesNotExist()
        {
            _staffRepository
                .Setup(r => r.GetByUserIdAsync(DoctorUserId))
                .ReturnsAsync((StaffProfile?)null);

            var act = () => _service.CreateAsync(DoctorUserId, ExaminationId, ValidRequest());

            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.MedicalRecordMessage.DoctorNotFound);
        }
    }
}

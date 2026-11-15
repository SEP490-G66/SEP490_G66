using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Examinations
{
    // Shared setup for calling and skipping a queue number
    public abstract class QueueEntryTestBase
    {
        protected const long EntryId = 30;
        protected const string DoctorUserId = "doctor-user-1";
        protected const int DoctorId = 10;
        protected readonly Mock<IQueueRepository> _queueRepo = new();
        protected readonly QueueService _service;

        protected QueueEntryTestBase()
        {
            _service = new QueueService(_queueRepo.Object, new Mock<ILogger<QueueService>>().Object);
            _queueRepo.Setup(r => r.GetStaffProfileIdByUserIdAsync(DoctorUserId, It.IsAny<CancellationToken>())).ReturnsAsync(DoctorId);
            _queueRepo.Setup(r => r.TryMarkCalledAsync(EntryId, It.IsAny<int?>(), It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
            _queueRepo.Setup(r => r.TryMoveBackAsync(EntryId, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        }

        protected QueueEntry Entry(string status, int assignedTo = DoctorId, DateTimeOffset? createdAt = null)
        {
            var entry = new QueueEntry
            {
                Id = EntryId,
                AppointmentId = 300,
                QueueType = QueueConstants.ExaminationType,
                AssignedStaffId = assignedTo,
                Status = status,
                QueueNumber = 5,
                CreatedAt = createdAt ?? DateTimeOffset.Now,
                Appointment = new Appointment { Id = 300, Patient = new Patient { FullName = "Nguyen Van An", PatientCode = "BN300" } }
            };
            _queueRepo.Setup(r => r.GetByIdAsync(EntryId, It.IsAny<CancellationToken>())).ReturnsAsync(entry);
            return entry;
        }
    }

    // OZ-Q-03 CallQueueEntry
    [Trait("Tab", "OZ-Q-03")]
    public class CallQueueEntryTests : QueueEntryTestBase
    {
        // UTCID01 (N): the doctor on shift calls their own waiting patient into a room
        [Fact]
        public async Task CallAsync_ShouldMarkCalled_WhenOwnWaitingPatient()
        {
            Entry(QueueConstants.Waiting);
            _queueRepo.Setup(r => r.IsOffDutyAsync(DoctorId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);

            var result = await _service.CallAsync(EntryId, roomId: 3, doctorUserId: DoctorUserId);

            result.Status.Should().Be(QueueConstants.Called);
            result.RoomId.Should().Be(3);
            result.CalledAt.Should().NotBeNull();
        }

        // UTCID02 (A): the number does not exist
        [Fact]
        public async Task CallAsync_ShouldThrow_WhenEntryNotFound()
        {
            var act = () => _service.CallAsync(999);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.QueueMessage.EntryNotFound);
        }

        // UTCID03 (A): a doctor cannot call another doctor's patient
        [Fact]
        public async Task CallAsync_ShouldThrow_WhenPatientOfAnotherDoctor()
        {
            Entry(QueueConstants.Waiting, assignedTo: 99);

            var act = () => _service.CallAsync(EntryId, doctorUserId: DoctorUserId);

            (await act.Should().ThrowAsync<ForbiddenException>()).Which.Message.Should().Be(ErrorConstants.QueueMessage.NotYourPatientToCall);
        }

        // UTCID04 (A): a doctor off shift cannot call a new patient
        [Fact]
        public async Task CallAsync_ShouldThrow_WhenDoctorOffShift()
        {
            Entry(QueueConstants.Waiting);
            _queueRepo.Setup(r => r.IsOffDutyAsync(DoctorId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);

            var act = () => _service.CallAsync(EntryId, doctorUserId: DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.QueueMessage.DoctorNotOnShift);
        }

        // UTCID05 (B): a number of an earlier day is history
        [Fact]
        public async Task CallAsync_ShouldThrow_WhenNumberFromEarlierDay()
        {
            Entry(QueueConstants.Waiting, createdAt: DateTimeOffset.Now.AddDays(-1));

            var act = () => _service.CallAsync(EntryId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.QueueMessage.NotInTodayQueue);
        }

        // UTCID06 (A): only a waiting number can be called
        [Fact]
        public async Task CallAsync_ShouldThrow_WhenAlreadyCalled()
        {
            Entry(QueueConstants.Called);

            var act = () => _service.CallAsync(EntryId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.QueueMessage.OnlyWaitingCanBeCalled);
        }
    }

    // OZ-Q-04 SkipQueueEntry
    [Trait("Tab", "OZ-Q-04")]
    public class SkipQueueEntryTests : QueueEntryTestBase
    {
        // UTCID01 (N): a called patient who is not there goes back to waiting, one more missed call counted
        [Fact]
        public async Task SkipAsync_ShouldMoveBackToWaiting_WhenCalled()
        {
            Entry(QueueConstants.Called);

            var result = await _service.SkipAsync(EntryId, DoctorUserId);

            result.Status.Should().Be(QueueConstants.Waiting);
            result.SkipCount.Should().Be(1);
            result.CalledAt.Should().BeNull();
        }

        // UTCID02 (A): only a called number can be skipped
        [Fact]
        public async Task SkipAsync_ShouldThrow_WhenStillWaiting()
        {
            Entry(QueueConstants.Waiting);

            var act = () => _service.SkipAsync(EntryId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.QueueMessage.OnlyCalledCanBeSkipped);
        }

        // UTCID03 (A): a doctor cannot skip another doctor's patient
        [Fact]
        public async Task SkipAsync_ShouldThrow_WhenPatientOfAnotherDoctor()
        {
            Entry(QueueConstants.Called, assignedTo: 99);

            var act = () => _service.SkipAsync(EntryId, DoctorUserId);

            (await act.Should().ThrowAsync<ForbiddenException>()).Which.Message.Should().Be(ErrorConstants.QueueMessage.NotYourPatient);
        }
    }

    // Shared setup for the examination screen: the examining doctor and an open examination
    public abstract class ExaminationWorkTestBase : ExaminationFollowUpTestBase
    {
        protected readonly Examination _exam;

        protected ExaminationWorkTestBase()
        {
            _exam = CreateTestExamination();
            _examinationRepoMock.Setup(r => r.GetForWorkAsync(ExaminationId, It.IsAny<CancellationToken>())).ReturnsAsync(_exam);
            _examinationRepoMock.Setup(r => r.GetEarlierChartEntriesAsync(It.IsAny<int>(), It.IsAny<DateTimeOffset>(), It.IsAny<long>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<DentalChartEntry>());
            _examinationRepoMock.Setup(r => r.GetConfigValueAsync(ConfigKeyConstants.SlotDurationMinutes)).ReturnsAsync("30");
        }
    }

    // OZ-EXAM-01 GetExamination
    [Trait("Tab", "OZ-EXAM-01")]
    public class GetExaminationTests : ExaminationWorkTestBase
    {
        // UTCID01 (N): the examining doctor opens the examination
        [Fact]
        public async Task GetAsync_ShouldReturnExamination_ForExaminingDoctor()
        {
            var result = await _service.GetAsync(DoctorUserId, ExaminationId);

            result.Should().NotBeNull();
            result.DentalChart.Should().BeEmpty();
        }

        // UTCID02 (A): the examination does not exist
        [Fact]
        public async Task GetAsync_ShouldThrow_WhenExaminationNotFound()
        {
            var act = () => _service.GetAsync(DoctorUserId, 999);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.MedicalRecordMessage.ExaminationNotFound);
        }

        // UTCID03 (A): another doctor's examination
        [Fact]
        public async Task GetAsync_ShouldThrow_WhenNotExaminingDoctor()
        {
            _exam.DoctorId = 99;

            var act = () => _service.GetAsync(DoctorUserId, ExaminationId);

            (await act.Should().ThrowAsync<ForbiddenException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.NotExaminingDoctor);
        }
    }

    // OZ-EXAM-02 UpdateExamContent
    [Trait("Tab", "OZ-EXAM-02")]
    public class UpdateExamContentTests : ExaminationWorkTestBase
    {
        // UTCID01 (N): the reason for the visit and the notes are saved, trimmed
        [Fact]
        public async Task UpdateContentAsync_ShouldSaveTrimmedText()
        {
            await _service.UpdateContentAsync(DoctorUserId, ExaminationId,
                new UpdateExaminationContentRequest { ChiefComplaint = " Dau rang ", ClinicalNotes = " Sau rang 36 " });

            _exam.ChiefComplaint.Should().Be("Dau rang");
            _exam.ClinicalNotes.Should().Be("Sau rang 36");
            _examinationRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (B): blank text clears the field
        [Fact]
        public async Task UpdateContentAsync_ShouldClearField_WhenBlank()
        {
            _exam.ClinicalNotes = "Cu";

            await _service.UpdateContentAsync(DoctorUserId, ExaminationId, new UpdateExaminationContentRequest { ChiefComplaint = "Dau", ClinicalNotes = "   " });

            _exam.ClinicalNotes.Should().BeNull();
        }

        // UTCID03 (B): one character over the limit of the reason for the visit
        [Fact]
        public async Task UpdateContentAsync_ShouldThrow_WhenChiefComplaintTooLong()
        {
            var act = () => _service.UpdateContentAsync(DoctorUserId, ExaminationId,
                new UpdateExaminationContentRequest { ChiefComplaint = new string('a', ExaminationConstants.ChiefComplaintMaxLength + 1) });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.ChiefComplaintTooLong);
        }

        // UTCID04 (A): clinical notes over the limit
        [Fact]
        public async Task UpdateContentAsync_ShouldThrow_WhenClinicalNotesTooLong()
        {
            var act = () => _service.UpdateContentAsync(DoctorUserId, ExaminationId,
                new UpdateExaminationContentRequest { ClinicalNotes = new string('a', ExaminationConstants.ClinicalNotesMaxLength + 1) });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.ClinicalNotesTooLong);
        }

        // UTCID05 (A): a locked examination is changed only by an addendum
        [Fact]
        public async Task UpdateContentAsync_ShouldThrow_WhenLocked()
        {
            _exam.ExaminationStatus = ExaminationConstants.Locked;

            var act = () => _service.UpdateContentAsync(DoctorUserId, ExaminationId, new UpdateExaminationContentRequest { ChiefComplaint = "Dau" });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AlreadyLocked);
        }
    }

    // OZ-EXAM-03 AddExamService
    [Trait("Tab", "OZ-EXAM-03")]
    public class AddExamServiceTests : ExaminationWorkTestBase
    {
        private static Service Scaling(string? roomType = null) => new()
        {
            Id = 4, ServiceName = "Cao voi", ReferencePrice = 300000, EstimatedMinutes = 30, IsActive = true, RequiredRoomType = roomType
        };

        // UTCID01 (N): a service is added with its price and time copied from the catalog
        [Fact]
        public async Task AddServiceAsync_ShouldAddServiceWithPriceSnapshot()
        {
            _examinationRepoMock.Setup(r => r.GetServiceAsync(4, It.IsAny<CancellationToken>())).ReturnsAsync(Scaling());

            var result = await _service.AddServiceAsync(DoctorUserId, ExaminationId, new SaveExaminationServiceRequest { ServiceId = 4 });

            result.Should().ContainSingle();
            _exam.Appointment.ServiceItems.Single().PriceAtBooking.Should().Be(300000);
            _exam.Appointment.ServiceItems.Single().DurationMinutes.Should().Be(30);
        }

        // UTCID02 (A): the same service twice
        [Fact]
        public async Task AddServiceAsync_ShouldThrow_WhenServiceAlreadyAdded()
        {
            var service = Scaling();
            _examinationRepoMock.Setup(r => r.GetServiceAsync(4, It.IsAny<CancellationToken>())).ReturnsAsync(service);
            _exam.Appointment.ServiceItems.Add(new AppointmentServiceItem { ServiceId = 4, Service = service });

            var act = () => _service.AddServiceAsync(DoctorUserId, ExaminationId, new SaveExaminationServiceRequest { ServiceId = 4 });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.ServiceAlreadyAdded);
        }

        // UTCID03 (A): a service that needs a different kind of room
        [Fact]
        public async Task AddServiceAsync_ShouldThrow_WhenServiceNeedsDifferentRoom()
        {
            _exam.Appointment.ServiceItems.Add(new AppointmentServiceItem { ServiceId = 1, Service = new Service { Id = 1, RequiredRoomType = RoomTypeConstants.GeneralTreatment } });
            _examinationRepoMock.Setup(r => r.GetServiceAsync(4, It.IsAny<CancellationToken>())).ReturnsAsync(Scaling(RoomTypeConstants.MinorSurgery));

            var act = () => _service.AddServiceAsync(DoctorUserId, ExaminationId, new SaveExaminationServiceRequest { ServiceId = 4 });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ServicesNeedDifferentRooms);
        }

        // UTCID04 (A): a service that is turned off
        [Fact]
        public async Task AddServiceAsync_ShouldThrow_WhenServiceInactive()
        {
            var service = Scaling();
            service.IsActive = false;
            _examinationRepoMock.Setup(r => r.GetServiceAsync(4, It.IsAny<CancellationToken>())).ReturnsAsync(service);

            var act = () => _service.AddServiceAsync(DoctorUserId, ExaminationId, new SaveExaminationServiceRequest { ServiceId = 4 });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ServiceInactive);
        }

        // UTCID05 (A): a locked examination
        [Fact]
        public async Task AddServiceAsync_ShouldThrow_WhenLocked()
        {
            _exam.ExaminationStatus = ExaminationConstants.Locked;

            var act = () => _service.AddServiceAsync(DoctorUserId, ExaminationId, new SaveExaminationServiceRequest { ServiceId = 4 });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AlreadyLocked);
        }
    }
}

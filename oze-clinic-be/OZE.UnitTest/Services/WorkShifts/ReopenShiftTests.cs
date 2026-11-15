using FluentAssertions;
using Moq;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.WorkShifts
{
    // OZ-WS-06 ReopenShift: the manager reopens a doctor's shift that was ended by mistake
    [Trait("Tab", "OZ-WS-06")]
    public class ReopenShiftTests
    {
        private const long ShiftId = 70;
        private const int RoomId = 3;

        private readonly Mock<IWorkShiftRepository> _shiftRepo = new();
        private readonly Mock<IAppointmentRepository> _appointmentRepo = new();
        private readonly Mock<IStaffRepository> _staffRepo = new();
        private readonly Mock<IQueueService> _queueService = new();
        private readonly Mock<IAuditLogService> _auditLogService = new();
        private readonly Mock<IAuditLogRepository> _auditLogRepo = new();
        private readonly DoctorScheduleService _service;

        public ReopenShiftTests()
        {
            _service = new DoctorScheduleService(_shiftRepo.Object, _appointmentRepo.Object, _staffRepo.Object,
                _queueService.Object, _auditLogService.Object, _auditLogRepo.Object);
            _shiftRepo.Setup(r => r.SaveChangesAsync()).Returns(Task.CompletedTask);
        }

        // A shift ended earlier; by default it is today and runs until the end of the day, whatever time the test runs
        private StaffSchedule EndedShift(DateOnly? date = null, TimeOnly? shiftEnd = null, bool ended = true)
        {
            var shift = new StaffSchedule
            {
                Id = ShiftId,
                StaffProfileId = 5,
                RoomId = RoomId,
                ScheduleDate = date ?? DateOnly.FromDateTime(ClinicClock.Today),
                ShiftStart = TimeOnly.MinValue,
                ShiftEnd = shiftEnd ?? TimeOnly.MaxValue,
                ActualStartTime = TimeOnly.MinValue,
                ActualEndTime = ended ? TimeOnly.MinValue.AddMinutes(1) : null
            };
            _shiftRepo.Setup(r => r.GetByIdAsync(ShiftId)).ReturnsAsync(shift);
            return shift;
        }

        // What the end of the shift wrote in the log: the patients it marked NO_SHOW and what they were before
        private void EndedLogWith(string restorableJson)
        {
            _auditLogRepo
                .Setup(r => r.GetLatestAsync(AuditConstants.ShiftEnded, AuditConstants.StaffScheduleEntity, ShiftId.ToString()))
                .ReturnsAsync(new AuditLog { NewValues = $"{{\"Restorable\":{restorableJson},\"Notified\":[]}}" });
        }

        private Appointment NoShow(long id, string status = AppointmentConstants.NoShowStatus)
        {
            var appointment = new Appointment { Id = id, DoctorId = 5, Status = status, Priority = 0 };
            _appointmentRepo.Setup(r => r.GetByIdWithDetailsAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(appointment);
            return appointment;
        }

        // UTCID01 (N): an ended shift with nobody marked NO_SHOW is opened again
        [Fact]
        public async Task ReopenShiftAsync_ShouldClearEndTime_WhenShiftWasEnded()
        {
            var shift = EndedShift();

            var result = await _service.ReopenShiftAsync(ShiftId);

            result.ShiftId.Should().Be(ShiftId);
            result.RestoredAppointmentIds.Should().BeEmpty();
            shift.ActualEndTime.Should().BeNull();
            _shiftRepo.Verify(r => r.Update(shift), Times.Once);
            _shiftRepo.Verify(r => r.SaveChangesAsync(), Times.Once);
        }

        // UTCID02 (N): patients the end marked NO_SHOW go back to what they were; a waiting one goes back in the queue
        [Fact]
        public async Task ReopenShiftAsync_ShouldRestoreNoShowPatients_WhenShiftWasEnded()
        {
            EndedShift();
            EndedLogWith("[{\"Id\":1,\"Status\":\"CONFIRMED\"},{\"Id\":2,\"Status\":\"CHECKED_IN\"}]");
            var booked = NoShow(1);
            var waiting = NoShow(2);

            var result = await _service.ReopenShiftAsync(ShiftId);

            result.RestoredAppointmentIds.Should().Equal(1, 2);
            booked.Status.Should().Be(AppointmentConstants.ConfirmedStatus);
            waiting.Status.Should().Be(AppointmentConstants.CheckedInStatus);
            _queueService.Verify(q => q.EnqueueAsync(2, QueueConstants.ExaminationType, RoomId, 5, 0, It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
            _queueService.Verify(q => q.EnqueueAsync(1, It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<int>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID03 (B): a patient whose status changed since the end is left as is
        [Fact]
        public async Task ReopenShiftAsync_ShouldSkipPatient_WhenNoLongerNoShow()
        {
            EndedShift();
            EndedLogWith("[{\"Id\":1,\"Status\":\"CONFIRMED\"}]");
            var moved = NoShow(1, AppointmentConstants.CancelledStatus);

            var result = await _service.ReopenShiftAsync(ShiftId);

            result.SkippedAppointmentIds.Should().Equal(1);
            result.RestoredAppointmentIds.Should().BeEmpty();
            moved.Status.Should().Be(AppointmentConstants.CancelledStatus);
        }

        // UTCID04 (A): an unknown shift id is rejected
        [Fact]
        public async Task ReopenShiftAsync_ShouldThrowNotFound_WhenShiftDoesNotExist()
        {
            _shiftRepo.Setup(r => r.GetByIdAsync(999)).ReturnsAsync((StaffSchedule?)null);

            var act = () => _service.ReopenShiftAsync(999);

            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.ShiftNotFound);
        }

        // UTCID05 (A): a shift that is still running has nothing to reopen
        [Fact]
        public async Task ReopenShiftAsync_ShouldThrowBadRequest_WhenShiftNotEnded()
        {
            EndedShift(ended: false);

            var act = () => _service.ReopenShiftAsync(ShiftId);

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.ShiftNotEnded);
        }

        // UTCID06 (A): a shift of an earlier day cannot be reopened
        [Fact]
        public async Task ReopenShiftAsync_ShouldThrowBadRequest_WhenShiftIsOfAnEarlierDay()
        {
            EndedShift(date: DateOnly.FromDateTime(ClinicClock.Today.AddDays(-1)));

            var act = () => _service.ReopenShiftAsync(ShiftId);

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.ShiftTimeOver);
        }

        // UTCID07 (B): a shift of today whose time is already over cannot be reopened
        [Fact]
        public async Task ReopenShiftAsync_ShouldThrowBadRequest_WhenShiftTimeIsOverToday()
        {
            EndedShift(shiftEnd: TimeOnly.MinValue);

            var act = () => _service.ReopenShiftAsync(ShiftId);

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.ShiftTimeOver);
        }

        // UTCID08 (A): another doctor is working in the room now
        [Fact]
        public async Task ReopenShiftAsync_ShouldThrowBadRequest_WhenRoomIsUsedByAnotherShift()
        {
            var shift = EndedShift();
            _shiftRepo.Setup(r => r.HasRunningShiftInRoomAsync(RoomId, shift.ScheduleDate, ShiftId)).ReturnsAsync(true);

            var act = () => _service.ReopenShiftAsync(ShiftId);

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.RoomInUse);
            shift.ActualEndTime.Should().NotBeNull();
        }
    }
}

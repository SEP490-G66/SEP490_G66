using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Schedules
{
    // OZ-DS-01 GetMySchedule
    [Trait("Tab", "OZ-DS-01")]
    public class GetMyScheduleTests : DoctorScheduleTestBase
    {
        // UTCID01 (N): no dates -> the current week, only the signed-in doctor's shifts
        [Fact]
        public async Task GetMyScheduleAsync_ShouldUseCurrentWeek_WhenNoDates()
        {
            var from = StartOfCurrentWeek;
            var to = from.AddDays(6);
            _shiftRepo.Setup(r => r.GetAllAsync(from, to, DoctorUserId, null))
                .ReturnsAsync(new List<StaffSchedule> { Shift(date: from) });

            var result = await _service.GetMyScheduleAsync(DoctorUserId, new DoctorScheduleQueryRequest());

            result.Should().ContainSingle(x => x.Id == ShiftId);
        }

        // UTCID02 (B): a range of exactly 7 days is allowed
        [Fact]
        public async Task GetMyScheduleAsync_ShouldSucceed_WhenRangeIsSevenDays()
        {
            var from = Today;
            _shiftRepo.Setup(r => r.GetAllAsync(from, from.AddDays(6), DoctorUserId, null)).ReturnsAsync(new List<StaffSchedule>());

            var result = await _service.GetMyScheduleAsync(DoctorUserId, new DoctorScheduleQueryRequest { FromDate = from, ToDate = from.AddDays(6) });

            result.Should().BeEmpty();
        }

        // UTCID03 (A): from date after to date
        [Fact]
        public async Task GetMyScheduleAsync_ShouldThrow_WhenFromDateAfterToDate()
        {
            var act = () => _service.GetMyScheduleAsync(DoctorUserId, new DoctorScheduleQueryRequest { FromDate = Today.AddDays(1), ToDate = Today });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.InvalidDateRange);
        }

        // UTCID04 (A): more than one week
        [Fact]
        public async Task GetMyScheduleAsync_ShouldThrow_WhenRangeLongerThanOneWeek()
        {
            var act = () => _service.GetMyScheduleAsync(DoctorUserId, new DoctorScheduleQueryRequest { FromDate = Today, ToDate = Today.AddDays(7) });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.DateRangeTooLong);
        }

        // UTCID05 (A): the account has no staff profile
        [Fact]
        public async Task GetMyScheduleAsync_ShouldThrow_WhenDoctorNotFound()
        {
            var act = () => _service.GetMyScheduleAsync("unknown-user", new DoctorScheduleQueryRequest());

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.DoctorNotFound);
        }
    }

    // OZ-DS-02 GetMyShiftDetail
    [Trait("Tab", "OZ-DS-02")]
    public class GetMyShiftDetailTests : DoctorScheduleTestBase
    {
        // UTCID01 (N): own shift with the appointments inside its time
        [Fact]
        public async Task GetMyShiftDetailAsync_ShouldReturnShiftWithAppointments()
        {
            Shift(start: new TimeOnly(8, 0), end: new TimeOnly(12, 0));
            _appointmentRepo.Setup(r => r.GetDoctorAppointmentsAsync(DoctorId, Today, Today))
                .ReturnsAsync(new List<Appointment> { Booked(1, Today, new TimeOnly(9, 0)), Booked(2, Today, new TimeOnly(14, 0)) });

            var result = await _service.GetMyShiftDetailAsync(DoctorUserId, ShiftId);

            result.Id.Should().Be(ShiftId);
            result.RoomName.Should().Be("Phong kham 1");
            result.AppointmentCount.Should().Be(1);
            result.Appointments.Should().ContainSingle(x => x.Id == 1);
        }

        // UTCID02 (A): the shift does not exist
        [Fact]
        public async Task GetMyShiftDetailAsync_ShouldThrow_WhenShiftNotFound()
        {
            _shiftRepo.Setup(r => r.GetByIdAsync(999)).ReturnsAsync((StaffSchedule?)null);

            var act = () => _service.GetMyShiftDetailAsync(DoctorUserId, 999);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.ShiftNotFound);
        }

        // UTCID03 (A): another doctor's shift looks the same as a missing one
        [Fact]
        public async Task GetMyShiftDetailAsync_ShouldThrow_WhenShiftBelongsToAnotherDoctor()
        {
            Shift(staffId: 99);

            var act = () => _service.GetMyShiftDetailAsync(DoctorUserId, ShiftId);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.ShiftNotFound);
        }
    }

    // OZ-DS-03 StartShift
    [Trait("Tab", "OZ-DS-03")]
    public class StartShiftTests : DoctorScheduleTestBase
    {
        // UTCID01 (N): a shift of today running now is started
        [Fact]
        public async Task StartShiftAsync_ShouldRecordClockIn()
        {
            var shift = Shift();

            var result = await _service.StartShiftAsync(DoctorUserId, ShiftId);

            result.ActualStartTime.Should().NotBeNull();
            shift.IsPresent.Should().BeTrue();
            _shiftRepo.Verify(r => r.SaveChangesAsync(), Times.Once);
        }

        // UTCID02 (A): a shift of another day
        [Fact]
        public async Task StartShiftAsync_ShouldThrow_WhenShiftNotToday()
        {
            Shift(date: Today.AddDays(1));

            var act = () => _service.StartShiftAsync(DoctorUserId, ShiftId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.ShiftNotToday);
        }

        // UTCID03 (A): already started
        [Fact]
        public async Task StartShiftAsync_ShouldThrow_WhenAlreadyStarted()
        {
            Shift(startedAt: TimeOnly.MinValue);

            var act = () => _service.StartShiftAsync(DoctorUserId, ShiftId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.ShiftAlreadyStarted);
        }

        // UTCID04 (B): the shift time is already over
        [Fact]
        public async Task StartShiftAsync_ShouldThrow_WhenShiftTimeIsOver()
        {
            Shift(end: TimeOnly.MinValue);

            var act = () => _service.StartShiftAsync(DoctorUserId, ShiftId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.ShiftOverCannotStart);
        }

        // UTCID05 (A): another doctor is working in the room
        [Fact]
        public async Task StartShiftAsync_ShouldThrow_WhenRoomInUse()
        {
            Shift();
            _shiftRepo.Setup(r => r.HasRunningShiftInRoomAsync(RoomId, Today, ShiftId)).ReturnsAsync(true);

            var act = () => _service.StartShiftAsync(DoctorUserId, ShiftId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.RoomInUse);
        }
    }

    // OZ-DS-04 EndShift
    [Trait("Tab", "OZ-DS-04")]
    public class EndShiftTests : DoctorScheduleTestBase
    {
        // UTCID01 (N): a started shift without patients is ended
        [Fact]
        public async Task EndShiftAsync_ShouldRecordClockOut()
        {
            var shift = Shift(startedAt: TimeOnly.MinValue);

            var result = await _service.EndShiftAsync(DoctorUserId, ShiftId);

            result.ActualEndTime.Should().NotBeNull();
            shift.ActualEndTime.Should().NotBeNull();
        }

        // UTCID02 (N): a confirmed patient whose time has passed becomes NO_SHOW
        [Fact]
        public async Task EndShiftAsync_ShouldMarkLatePatientNoShow()
        {
            Shift(startedAt: TimeOnly.MinValue);
            var late = Booked(1, Today, TimeOnly.MinValue);
            _appointmentRepo.Setup(r => r.GetDoctorOpenAppointmentsAsync(DoctorId, Today, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<Appointment> { late });

            var result = await _service.EndShiftAsync(DoctorUserId, ShiftId);

            result.NoShowAppointmentIds.Should().Equal(1);
            late.Status.Should().Be(AppointmentConstants.NoShowStatus);
        }

        // UTCID03 (A): the shift was not started
        [Fact]
        public async Task EndShiftAsync_ShouldThrow_WhenShiftNotStarted()
        {
            Shift();

            var act = () => _service.EndShiftAsync(DoctorUserId, ShiftId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.ShiftNotStarted);
        }

        // UTCID04 (A): a patient is still being examined
        [Fact]
        public async Task EndShiftAsync_ShouldThrow_WhenExaminationStillRunning()
        {
            Shift(startedAt: TimeOnly.MinValue);
            _appointmentRepo.Setup(r => r.GetDoctorOpenAppointmentsAsync(DoctorId, Today, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<Appointment> { Booked(1, Today, TimeOnly.MinValue, AppointmentConstants.InServiceStatus) });

            var act = () => _service.EndShiftAsync(DoctorUserId, ShiftId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.ExaminationStillRunning);
        }
    }
}

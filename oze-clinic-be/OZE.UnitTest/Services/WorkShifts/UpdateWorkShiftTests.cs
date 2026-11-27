using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.WorkShifts
{
    // OZ-WS-04 UpdateWorkShift
    [Trait("Tab", "OZ-WS-04")]
    public class UpdateWorkShiftTests : WorkShiftTestBase
    {
        private const long ShiftId = 1;
        private const string OtherStaffUserId = "staff-user-2";

        // The shift as stored: tomorrow 08:00-12:00, valid staff and room, no clash, no booked appointment
        private StaffSchedule SetupExistingShift(DateOnly? date = null)
        {
            var shift = CreateSampleSchedule(id: ShiftId, date: date ?? TomorrowDate);
            _workShiftRepositoryMock.Setup(r => r.GetByIdAsync(ShiftId)).ReturnsAsync(shift);
            SetupValidStaffAndRoom();
            _workShiftRepositoryMock
                .Setup(r => r.HasBookedAppointmentsAsync(It.IsAny<int>(), It.IsAny<DateOnly>(), It.IsAny<TimeOnly>(), It.IsAny<TimeOnly>()))
                .ReturnsAsync(false);
            return shift;
        }

        private static UpdateWorkShiftRequest Request(DateOnly date, int startHour = 8, int endHour = 12, string staffUserId = ValidStaffUserId, int? roomId = ValidRoomId) => new()
        {
            StaffUserId = staffUserId,
            ScheduleDate = date,
            ShiftStart = new TimeOnly(startHour, 0),
            ShiftEnd = new TimeOnly(endHour, 0),
            RoomId = roomId,
            Assignment = "Nho rang khon",
            Note = "Doi phan cong"
        };

        // UTCID01 (N): only the assignment and note change; nothing about booked appointments is checked
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldUpdateAssignmentAndNote_WhenTimeIsUnchanged()
        {
            var shift = SetupExistingShift();

            var result = await _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate));

            result.Assignment.Should().Be("Nho rang khon");
            result.Notes.Should().Be("Doi phan cong");
            shift.UpdatedAt.Should().NotBeNull();
            _workShiftRepositoryMock.Verify(r => r.HasBookedAppointmentsAsync(It.IsAny<int>(), It.IsAny<DateOnly>(), It.IsAny<TimeOnly>(), It.IsAny<TimeOnly>()), Times.Never);
            _workShiftRepositoryMock.Verify(r => r.Update(shift), Times.Once);
            _workShiftRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
        }

        // UTCID02 (N): the time moves when the shift has no booked appointment
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldChangeTime_WhenNoBookedAppointments()
        {
            var shift = SetupExistingShift();

            var result = await _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate, 13, 17));

            result.ShiftStart.Should().Be(new TimeOnly(13, 0));
            result.ShiftEnd.Should().Be(new TimeOnly(17, 0));
            shift.ShiftStart.Should().Be(new TimeOnly(13, 0));
        }

        // UTCID03 (N): the shift is given to another active staff member
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldMoveShiftToAnotherStaff_WhenNoBookedAppointments()
        {
            var shift = SetupExistingShift();
            var other = new StaffProfile { Id = 20, UserId = OtherStaffUserId, FullName = "Bs. Tran Thi B", IsActive = true };
            _staffRepositoryMock.Setup(r => r.GetByUserIdAsync(OtherStaffUserId)).ReturnsAsync(other);

            var result = await _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate, staffUserId: OtherStaffUserId));

            shift.StaffProfileId.Should().Be(20);
            result.StaffUserId.Should().Be(OtherStaffUserId);
            result.StaffName.Should().Be("Bs. Tran Thi B");
        }

        // UTCID04 (B): the new date may be today
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldSucceed_WhenNewDateIsToday()
        {
            SetupExistingShift();

            var result = await _service.UpdateWorkShiftAsync(ShiftId, Request(TodayDate));

            result.ScheduleDate.Should().Be(TodayDate);
        }

        // UTCID05 (A): an unknown id is rejected
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrowNotFound_WhenShiftDoesNotExist()
        {
            _workShiftRepositoryMock.Setup(r => r.GetByIdAsync(999)).ReturnsAsync((StaffSchedule?)null);

            var act = () => _service.UpdateWorkShiftAsync(999, Request(TomorrowDate));

            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.WorkShiftNotFound);
        }

        // UTCID06 (A): a shift that has already started or passed keeps its schedule
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrowBadRequest_WhenShiftAlreadyStarted()
        {
            SetupExistingShift(YesterdayDate);

            var act = () => _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.CannotUpdateStartedShift);
        }

        // UTCID07 (B): start equal to end is not a time range
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrowBadRequest_WhenStartEqualsEnd()
        {
            SetupExistingShift();

            var act = () => _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate, 9, 9));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.InvalidTimeRange);
        }

        // UTCID08 (A): the new date cannot be in the past
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrowBadRequest_WhenNewDateIsInThePast()
        {
            SetupExistingShift();

            var act = () => _service.UpdateWorkShiftAsync(ShiftId, Request(YesterdayDate));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.PastDate);
        }

        // UTCID09 (A): the staff member does not exist
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrowNotFound_WhenStaffDoesNotExist()
        {
            SetupExistingShift();
            _staffRepositoryMock.Setup(r => r.GetByUserIdAsync("unknown-user")).ReturnsAsync((StaffProfile?)null);

            var act = () => _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate, staffUserId: "unknown-user"));

            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.StaffNotFound);
        }

        // UTCID10 (A): an inactive staff member cannot take a shift
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrowBadRequest_WhenStaffIsInactive()
        {
            SetupExistingShift();
            _staffRepositoryMock.Setup(r => r.GetByUserIdAsync(ValidStaffUserId)).ReturnsAsync(CreateSampleStaff(isActive: false));

            var act = () => _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.StaffInactive);
        }

        // UTCID11 (A): the room does not exist
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrowNotFound_WhenRoomDoesNotExist()
        {
            SetupExistingShift();
            _roomRepositoryMock.Setup(r => r.GetByIdAsync(77, It.IsAny<CancellationToken>())).ReturnsAsync((Room?)null);

            var act = () => _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate, roomId: 77));

            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.RoomNotFound);
        }

        // UTCID12 (A): an inactive room cannot be used
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrowBadRequest_WhenRoomIsInactive()
        {
            SetupExistingShift();
            _roomRepositoryMock.Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>())).ReturnsAsync(CreateSampleRoom(isActive: false));

            var act = () => _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.RoomNotActive);
        }

        // UTCID13 (A): staff, date or time cannot change while patients are booked in the shift
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrowBadRequest_WhenTimeChangesWithBookedAppointments()
        {
            SetupExistingShift();
            _workShiftRepositoryMock
                .Setup(r => r.HasBookedAppointmentsAsync(ValidStaffProfileId, TomorrowDate, new TimeOnly(8, 0), new TimeOnly(12, 0)))
                .ReturnsAsync(true);

            var act = () => _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate, 13, 17));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.ShiftHasAppointmentsCannotChange);
            _workShiftRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Never);
        }

        // UTCID14 (A): the staff member already has another shift at the new time
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrowBadRequest_WhenStaffShiftOverlaps()
        {
            SetupExistingShift();
            _workShiftRepositoryMock
                .Setup(r => r.HasOverlapAsync(ValidStaffProfileId, TomorrowDate, new TimeOnly(13, 0), new TimeOnly(17, 0), ShiftId))
                .ReturnsAsync(true);

            var act = () => _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate, 13, 17));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.ShiftOverlap);
        }

        // UTCID15 (A): the room is used by another shift at the new time
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrowBadRequest_WhenRoomOverlaps()
        {
            SetupExistingShift();
            _workShiftRepositoryMock
                .Setup(r => r.HasRoomOverlapAsync(ValidRoomId, TomorrowDate, new TimeOnly(13, 0), new TimeOnly(17, 0), ShiftId))
                .ReturnsAsync(true);

            var act = () => _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate, 13, 17));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.RoomOverlap);
        }

        // UTCID16 (N): a substitute put on a shift marked absent (leave approved without a substitute) starts unmarked
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldClearAbsence_WhenAbsentShiftGoesToAnotherStaff()
        {
            var shift = SetupExistingShift();
            shift.IsPresent = false;
            shift.AbsenceReason = "Nghỉ phép: Việc gia đình";
            var other = new StaffProfile { Id = 20, UserId = OtherStaffUserId, FullName = "Bs. Tran Thi B", IsActive = true };
            _staffRepositoryMock.Setup(r => r.GetByUserIdAsync(OtherStaffUserId)).ReturnsAsync(other);

            await _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate, staffUserId: OtherStaffUserId));

            shift.StaffProfileId.Should().Be(20);
            shift.IsPresent.Should().BeNull();
            shift.AbsenceReason.Should().BeNull();
        }

        // UTCID17 (N): the same person keeps the absence when only the assignment or note changes
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldKeepAbsence_WhenStaffIsUnchanged()
        {
            var shift = SetupExistingShift();
            shift.IsPresent = false;
            shift.AbsenceReason = "Nghỉ phép: Việc gia đình";

            await _service.UpdateWorkShiftAsync(ShiftId, Request(TomorrowDate));

            shift.IsPresent.Should().BeFalse();
            shift.AbsenceReason.Should().Be("Nghỉ phép: Việc gia đình");
        }

        // UTCID18 (A): moving the shift to a start between two 30-minute slots is refused
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrow_WhenNewStartOffSlotBoundary()
        {
            SetupExistingShift();
            SetupSlotMinutes("30");
            var request = Request(TomorrowDate);
            request.ShiftStart = new TimeOnly(8, 45);

            var act = () => _service.UpdateWorkShiftAsync(ShiftId, request);

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.ShiftStartOffSlot);
        }

        // UTCID19 (B): an old shift that already starts off the grid can still be edited while its start stays the same
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldAllowEdit_WhenOffBoundaryStartIsUnchanged()
        {
            var shift = SetupExistingShift();
            shift.ShiftStart = new TimeOnly(8, 15);
            SetupSlotMinutes("30");
            var request = Request(TomorrowDate);
            request.ShiftStart = new TimeOnly(8, 15);

            var result = await _service.UpdateWorkShiftAsync(ShiftId, request);

            result.Notes.Should().Be("Doi phan cong");
            _workShiftRepositoryMock.Verify(r => r.Update(shift), Times.Once);
        }
    }
}

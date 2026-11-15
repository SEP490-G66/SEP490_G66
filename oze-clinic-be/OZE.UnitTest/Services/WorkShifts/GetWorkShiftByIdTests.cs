using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using Xunit;

namespace OZE.UnitTest.Services.WorkShifts
{
    // OZ-WS-03 GetWorkShiftById
    [Trait("Tab", "OZ-WS-03")]
    public class GetWorkShiftByIdTests : WorkShiftTestBase
    {
        // UTCID01 (N): an existing shift with a room is returned with every field
        [Fact]
        public async Task GetWorkShiftByIdAsync_ShouldReturnShift_WhenShiftExists()
        {
            var shift = CreateSampleSchedule(id: 1);
            _workShiftRepositoryMock.Setup(r => r.GetByIdAsync(1)).ReturnsAsync(shift);

            var result = await _service.GetWorkShiftByIdAsync(1);

            result.Id.Should().Be(1);
            result.StaffUserId.Should().Be(ValidStaffUserId);
            result.StaffName.Should().Be("Bs. Nguyen Van A");
            result.RoomId.Should().Be(ValidRoomId);
            result.RoomName.Should().Be(ValidRoomName);
            result.ScheduleDate.Should().Be(TomorrowDate);
            result.ShiftStart.Should().Be(new TimeOnly(8, 0));
            result.ShiftEnd.Should().Be(new TimeOnly(12, 0));
            result.Assignment.Should().Be("Kham rang tong quat");
            result.Notes.Should().Be("Ghi chu ca truc");
        }

        // UTCID02 (B): a shift without a room returns an empty room
        [Fact]
        public async Task GetWorkShiftByIdAsync_ShouldReturnEmptyRoom_WhenShiftHasNoRoom()
        {
            var shift = CreateSampleSchedule(id: 2);
            shift.RoomId = null;
            shift.Room = null;
            _workShiftRepositoryMock.Setup(r => r.GetByIdAsync(2)).ReturnsAsync(shift);

            var result = await _service.GetWorkShiftByIdAsync(2);

            result.Id.Should().Be(2);
            result.RoomId.Should().BeNull();
            result.RoomName.Should().BeNull();
        }

        // UTCID03 (A): an unknown id is rejected
        [Fact]
        public async Task GetWorkShiftByIdAsync_ShouldThrowNotFound_WhenShiftDoesNotExist()
        {
            _workShiftRepositoryMock.Setup(r => r.GetByIdAsync(999)).ReturnsAsync((OZE.Domain.Entities.StaffSchedule?)null);

            var act = () => _service.GetWorkShiftByIdAsync(999);

            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.WorkShiftNotFound);
        }
    }
}

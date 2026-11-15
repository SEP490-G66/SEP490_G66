using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
 feat/unittest-get-work-shift-by-id
using OZE.Common.Models;
using OZE.Domain.Entities;
using System;
using System.Threading.Tasks;
> main
using Xunit;

namespace OZE.UnitTest.Services.WorkShifts
{
    // OZ-WS-03 GetWorkShiftById
    [Trait("Tab", "OZ-WS-03")]
    public class GetWorkShiftByIdTests : WorkShiftTestBase
    {
 feat/unittest-get-work-shift-by-id
        // UTCID01 (N): Retrieve an existing shift with room assigned -> all fields mapped
        [Fact]
        public async Task GetWorkShiftByIdAsync_ShouldReturnShift_WhenShiftExistsWithRoom()
        {
            // Arrange
            const long shiftId = 100;
            var sampleSchedule = CreateSampleSchedule(shiftId);

            _workShiftRepositoryMock
                .Setup(r => r.GetByIdAsync(shiftId))
                .ReturnsAsync(sampleSchedule);

            // Act
            var result = await _service.GetWorkShiftByIdAsync(shiftId);

            // Assert
            result.Should().NotBeNull();
            result.Id.Should().Be(shiftId);

        // UTCID01 (N): an existing shift with a room is returned with every field
        [Fact]
        public async Task GetWorkShiftByIdAsync_ShouldReturnShift_WhenShiftExists()
        {
            var shift = CreateSampleSchedule(id: 1);
            _workShiftRepositoryMock.Setup(r => r.GetByIdAsync(1)).ReturnsAsync(shift);

            var result = await _service.GetWorkShiftByIdAsync(1);

            result.Id.Should().Be(1);
 main
            result.StaffUserId.Should().Be(ValidStaffUserId);
            result.StaffName.Should().Be("Bs. Nguyen Van A");
            result.RoomId.Should().Be(ValidRoomId);
            result.RoomName.Should().Be(ValidRoomName);
 feat/unittest-get-work-shift-by-id
            result.ScheduleDate.Should().Be(sampleSchedule.ScheduleDate);
            result.ShiftStart.Should().Be(sampleSchedule.ShiftStart);
            result.ShiftEnd.Should().Be(sampleSchedule.ShiftEnd);
            result.Assignment.Should().Be(sampleSchedule.Assignment);
            result.Notes.Should().Be(sampleSchedule.Notes);
            result.CreatedAt.Should().Be(sampleSchedule.CreatedAt);

            _workShiftRepositoryMock.Verify(r => r.GetByIdAsync(shiftId), Times.Once);
        }

        // UTCID02 (N): Retrieve an existing shift without room assigned (RoomId is null)
        [Fact]
        public async Task GetWorkShiftByIdAsync_ShouldReturnShift_WhenShiftExistsWithoutRoom()
        {
            // Arrange
            const long shiftId = 101;
            var staff = CreateSampleStaff();
            var scheduleWithoutRoom = new StaffSchedule
            {
                Id = shiftId,
                StaffProfileId = staff.Id,
                StaffProfile = staff,
                RoomId = null,
                Room = null,
                ScheduleDate = TomorrowDate,
                ShiftStart = new TimeOnly(13, 0),
                ShiftEnd = new TimeOnly(17, 0),
                Assignment = "Truc tong dai ho tro",
                Notes = "Khong can phong",
                IsPresent = null,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _workShiftRepositoryMock
                .Setup(r => r.GetByIdAsync(shiftId))
                .ReturnsAsync(scheduleWithoutRoom);

            // Act
            var result = await _service.GetWorkShiftByIdAsync(shiftId);

            // Assert
            result.Should().NotBeNull();
            result.Id.Should().Be(shiftId);
            result.RoomId.Should().BeNull();
            result.RoomName.Should().BeNull();
            result.StaffUserId.Should().Be(ValidStaffUserId);
            result.Assignment.Should().Be("Truc tong dai ho tro");
            result.Notes.Should().Be("Khong can phong");
        }

        // UTCID03 (N): Retrieve a shift with completed attendance details (checked in & checked out)
        [Fact]
        public async Task GetWorkShiftByIdAsync_ShouldReturnShift_WithCompletedAttendanceDetails()
        {
            // Arrange
            const long shiftId = 102;
            var sampleSchedule = CreateSampleSchedule(shiftId);
            sampleSchedule.IsPresent = true;
            sampleSchedule.AbsenceReason = null;
            sampleSchedule.ActualStartTime = new TimeOnly(7, 50);
            sampleSchedule.ActualEndTime = new TimeOnly(12, 10);

            _workShiftRepositoryMock
                .Setup(r => r.GetByIdAsync(shiftId))
                .ReturnsAsync(sampleSchedule);

            // Act
            var result = await _service.GetWorkShiftByIdAsync(shiftId);

            // Assert
            result.Should().NotBeNull();
            result.IsPresent.Should().BeTrue();
            result.AbsenceReason.Should().BeNull();
            result.ActualStartTime.Should().Be(new TimeOnly(7, 50));
            result.ActualEndTime.Should().Be(new TimeOnly(12, 10));
        }

        // UTCID04 (N): Retrieve a shift with recorded absence details
        [Fact]
        public async Task GetWorkShiftByIdAsync_ShouldReturnShift_WithAbsenceDetails()
        {
            // Arrange
            const long shiftId = 103;
            var sampleSchedule = CreateSampleSchedule(shiftId);
            sampleSchedule.IsPresent = false;
            sampleSchedule.AbsenceReason = "Nghi phep dot xuat vi ly do suc khoe";
            sampleSchedule.ActualStartTime = null;
            sampleSchedule.ActualEndTime = null;

            _workShiftRepositoryMock
                .Setup(r => r.GetByIdAsync(shiftId))
                .ReturnsAsync(sampleSchedule);

            // Act
            var result = await _service.GetWorkShiftByIdAsync(shiftId);

            // Assert
            result.Should().NotBeNull();
            result.IsPresent.Should().BeFalse();
            result.AbsenceReason.Should().Be("Nghi phep dot xuat vi ly do suc khoe");
            result.ActualStartTime.Should().BeNull();
            result.ActualEndTime.Should().BeNull();
        }

        // UTCID05 (B): Boundary valid minimum positive id (id = 1)
        [Fact]
        public async Task GetWorkShiftByIdAsync_ShouldReturnShift_WhenIdIsMinimumPositiveBoundaryValue()
        {
            // Arrange
            const long shiftId = 1;
            var sampleSchedule = CreateSampleSchedule(shiftId);

            _workShiftRepositoryMock
                .Setup(r => r.GetByIdAsync(shiftId))
                .ReturnsAsync(sampleSchedule);

            // Act
            var result = await _service.GetWorkShiftByIdAsync(shiftId);

            // Assert
            result.Should().NotBeNull();
            result.Id.Should().Be(1);
            _workShiftRepositoryMock.Verify(r => r.GetByIdAsync(1), Times.Once);
        }

        // UTCID06 (B): Boundary non-positive id (id = 0) -> not found
        [Fact]
        public async Task GetWorkShiftByIdAsync_ShouldThrowNotFoundException_WhenIdIsZeroBoundary()
        {
            // Arrange
            const long shiftId = 0;

            _workShiftRepositoryMock
                .Setup(r => r.GetByIdAsync(shiftId))
                .ReturnsAsync((StaffSchedule?)null);

            // Act
            var act = () => _service.GetWorkShiftByIdAsync(shiftId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.WorkShiftNotFound);
            _workShiftRepositoryMock.Verify(r => r.GetByIdAsync(0), Times.Once);
        }

        // UTCID07 (A): Non-existent shift id -> throws NotFoundException
        [Fact]
        public async Task GetWorkShiftByIdAsync_ShouldThrowNotFoundException_WhenShiftDoesNotExist()
        {
            // Arrange
            const long nonExistentId = 99999;

            _workShiftRepositoryMock
                .Setup(r => r.GetByIdAsync(nonExistentId))
                .ReturnsAsync((StaffSchedule?)null);

            // Act
            var act = () => _service.GetWorkShiftByIdAsync(nonExistentId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.WorkShiftNotFound);
            _workShiftRepositoryMock.Verify(r => r.GetByIdAsync(nonExistentId), Times.Once);

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
 main
        }
    }
}

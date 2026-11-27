using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Xunit;

namespace OZE.UnitTest.Services.WorkShifts
{
    // OZ-WS-08 ShiftSlotBoundary
    [Trait("Tab", "OZ-WS-08")]
    public class ShiftSlotBoundaryTests : WorkShiftTestBase
    {
        private const long ShiftId = 1;

        private void SetupSlotMinutes(string? value) =>
            _workShiftRepositoryMock.Setup(r => r.GetConfigValueAsync(ConfigKeyConstants.SlotDurationMinutes)).ReturnsAsync(value);

        private CreateWorkShiftRequest CreateRequest(TimeOnly start, TimeOnly end)
        {
            var request = CreateValidRequest();
            request.ShiftStart = start;
            request.ShiftEnd = end;
            return request;
        }

        // UTCID01 (N): 08:30 is on a 30-minute boundary
        [Fact]
        public async Task CreateWorkShipAsync_ShouldCreate_WhenStartOnSlotBoundary()
        {
            SetupValidStaffAndRoom();
            SetupSlotMinutes("30");

            var result = await _service.CreateWorkShipAsync(CreateRequest(new TimeOnly(8, 30), new TimeOnly(12, 0)));

            result.ShiftStart.Should().Be(new TimeOnly(8, 30));
            _workShiftRepositoryMock.Verify(r => r.AddAsync(It.IsAny<StaffSchedule>()), Times.Once);
        }

        // UTCID02 (A): 08:15 is between two 30-minute slots
        [Fact]
        public async Task CreateWorkShipAsync_ShouldThrow_WhenStartOffSlotBoundary()
        {
            SetupValidStaffAndRoom();
            SetupSlotMinutes("30");

            var act = () => _service.CreateWorkShipAsync(CreateRequest(new TimeOnly(8, 15), new TimeOnly(12, 0)));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.ShiftStartOffSlot);
            _workShiftRepositoryMock.Verify(r => r.AddAsync(It.IsAny<StaffSchedule>()), Times.Never);
        }

        // UTCID03 (B): the same 08:15 is fine once the slots are 15 minutes
        [Fact]
        public async Task CreateWorkShipAsync_ShouldCreate_WhenSlotIsFifteenMinutes()
        {
            SetupValidStaffAndRoom();
            SetupSlotMinutes("15");

            var result = await _service.CreateWorkShipAsync(CreateRequest(new TimeOnly(8, 15), new TimeOnly(12, 0)));

            result.ShiftStart.Should().Be(new TimeOnly(8, 15));
        }

        // UTCID04 (B): without a usable setting there is nothing to check against
        [Theory]
        [InlineData(null)]
        [InlineData("abc")]
        [InlineData("0")]
        public async Task CreateWorkShipAsync_ShouldSkipCheck_WhenSettingMissing(string? value)
        {
            SetupValidStaffAndRoom();
            SetupSlotMinutes(value);

            var result = await _service.CreateWorkShipAsync(CreateRequest(new TimeOnly(8, 15), new TimeOnly(12, 0)));

            result.ShiftStart.Should().Be(new TimeOnly(8, 15));
        }

        // UTCID05 (A): one slot of a bulk request off the boundary stops the whole request before anything is checked
        [Fact]
        public async Task PreviewBulkWorkShiftsAsync_ShouldThrow_WhenAnySlotStartsOffBoundary()
        {
            SetupValidStaffAndRoom();
            SetupSlotMinutes("30");
            var request = CreateValidBulkRequest();
            request.Slots = new List<BulkWorkShiftSlot>
            {
                new() { ShiftStart = new TimeOnly(8, 0), ShiftEnd = new TimeOnly(12, 0) },
                new() { ShiftStart = new TimeOnly(13, 10), ShiftEnd = new TimeOnly(17, 0) }
            };

            var act = () => _service.PreviewBulkWorkShiftsAsync(request);

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.ShiftStartOffSlot);
        }

        // UTCID06 (A): moving a shift to an off-boundary start is refused
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldThrow_WhenNewStartOffSlotBoundary()
        {
            var shift = CreateSampleSchedule(id: ShiftId);
            _workShiftRepositoryMock.Setup(r => r.GetByIdAsync(ShiftId)).ReturnsAsync(shift);
            SetupValidStaffAndRoom();
            SetupSlotMinutes("30");

            var act = () => _service.UpdateWorkShiftAsync(ShiftId, UpdateRequest(shift.ScheduleDate, new TimeOnly(8, 45)));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.ShiftStartOffSlot);
        }

        // UTCID07 (B): an old shift that already starts off the grid can still be edited when its start stays the same
        [Fact]
        public async Task UpdateWorkShiftAsync_ShouldAllowEdit_WhenOffBoundaryStartIsUnchanged()
        {
            var shift = CreateSampleSchedule(id: ShiftId);
            shift.ShiftStart = new TimeOnly(8, 15);
            _workShiftRepositoryMock.Setup(r => r.GetByIdAsync(ShiftId)).ReturnsAsync(shift);
            SetupValidStaffAndRoom();
            SetupSlotMinutes("30");

            var result = await _service.UpdateWorkShiftAsync(ShiftId, UpdateRequest(shift.ScheduleDate, new TimeOnly(8, 15)));

            result.Notes.Should().Be("Doi phan cong");
            _workShiftRepositoryMock.Verify(r => r.Update(shift), Times.Once);
        }

        private static UpdateWorkShiftRequest UpdateRequest(DateOnly date, TimeOnly start) => new()
        {
            StaffUserId = ValidStaffUserId,
            ScheduleDate = date,
            ShiftStart = start,
            ShiftEnd = new TimeOnly(12, 0),
            RoomId = ValidRoomId,
            Assignment = "Kham rang tong quat",
            Note = "Doi phan cong"
        };
    }
}

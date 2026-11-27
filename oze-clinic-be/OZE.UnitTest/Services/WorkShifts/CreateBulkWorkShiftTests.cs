using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace OZE.UnitTest.Services.WorkShifts
{
    // SCRUM-1008 Bulk create / preview work shifts
    public class CreateBulkWorkShiftTests : WorkShiftTestBase
    {
        [Fact]
        public async Task PreviewBulkWorkShiftsAsync_ShouldReturnValidItems_WithoutSaving()
        {
            SetupValidStaffAndRoom();
            var request = CreateValidBulkRequest();

            var result = await _service.PreviewBulkWorkShiftsAsync(request);

            result.ValidCount.Should().Be(1);
            result.InvalidCount.Should().Be(0);
            result.Items.Should().HaveCount(1);
            result.Items[0].Valid.Should().BeTrue();
            result.Items[0].StaffUserId.Should().Be(ValidStaffUserId);
            _workShiftRepositoryMock.Verify(r => r.AddRangeAsync(It.IsAny<IEnumerable<StaffSchedule>>()), Times.Never);
            _workShiftRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Never);
        }

        [Fact]
        public async Task CreateBulkWorkShiftsAsync_ShouldCreateValidShifts_AndWriteOneAudit()
        {
            SetupValidStaffAndRoom();
            var request = CreateValidBulkRequest();
            List<StaffSchedule>? saved = null;
            _workShiftRepositoryMock
                .Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<StaffSchedule>>()))
                .Callback<IEnumerable<StaffSchedule>>(items =>
                {
                    saved = items.ToList();
                    var id = 100L;
                    foreach (var item in saved)
                        item.Id = id++;
                })
                .Returns(Task.CompletedTask);

            var result = await _service.CreateBulkWorkShiftsAsync(request);

            result.CreatedCount.Should().Be(1);
            result.CreatedIds.Should().HaveCount(1);
            result.Skipped.Should().BeEmpty();
            saved.Should().NotBeNull();
            saved!.Should().HaveCount(1);
            saved[0].StaffProfileId.Should().Be(ValidStaffProfileId);
            saved[0].RoomId.Should().Be(ValidRoomId);
            saved[0].Assignment.Should().Be("Kham rang tong quat");
            saved[0].Notes.Should().Be("Bulk note");

            _workShiftRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
            _auditLogServiceMock.Verify(a => a.LogAsync(
                AuditConstants.ShiftBulkCreated,
                AuditConstants.StaffScheduleEntity,
                It.IsAny<string>(),
                null,
                It.IsAny<object?>(),
                null), Times.Once);
        }

        [Fact]
        public async Task CreateBulkWorkShiftsAsync_ShouldSkipOverlappingStaffShift_AndCreateOthers()
        {
            SetupValidStaffAndRoom();
            var from = TomorrowDate;
            var to = from.AddDays(1);
            var request = new BulkWorkShiftRequest
            {
                StaffUserIds = new List<string> { ValidStaffUserId },
                FromDate = from,
                ToDate = to,
                DaysOfWeek = new List<int> { (int)from.DayOfWeek, (int)to.DayOfWeek },
                Slots = new List<BulkWorkShiftSlot>
                {
                    new() { ShiftStart = new TimeOnly(8, 0), ShiftEnd = new TimeOnly(12, 0) }
                },
                RoomId = ValidRoomId
            };

            _workShiftRepositoryMock
                .Setup(r => r.HasOverlapAsync(ValidStaffProfileId, from, new TimeOnly(8, 0), new TimeOnly(12, 0), null))
                .ReturnsAsync(true);

            List<StaffSchedule>? saved = null;
            _workShiftRepositoryMock
                .Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<StaffSchedule>>()))
                .Callback<IEnumerable<StaffSchedule>>(items =>
                {
                    saved = items.ToList();
                    foreach (var (item, index) in saved.Select((s, i) => (s, i)))
                        item.Id = 200 + index;
                })
                .Returns(Task.CompletedTask);

            var result = await _service.CreateBulkWorkShiftsAsync(request);

            result.CreatedCount.Should().Be(1);
            result.Skipped.Should().ContainSingle();
            result.Skipped[0].ScheduleDate.Should().Be(from);
            result.Skipped[0].Reason.Should().Be(ErrorConstants.WorkShiftMessage.ShiftOverlap);
            saved.Should().HaveCount(1);
            saved![0].ScheduleDate.Should().Be(to);
        }

        [Fact]
        public async Task CreateBulkWorkShiftsAsync_ShouldSkipRoomOverlap_AndCreateOthers()
        {
            SetupValidStaffAndRoom();
            var from = TomorrowDate;
            var to = from.AddDays(1);
            var request = new BulkWorkShiftRequest
            {
                StaffUserIds = new List<string> { ValidStaffUserId },
                FromDate = from,
                ToDate = to,
                DaysOfWeek = new List<int> { (int)from.DayOfWeek, (int)to.DayOfWeek },
                Slots = new List<BulkWorkShiftSlot>
                {
                    new() { ShiftStart = new TimeOnly(8, 0), ShiftEnd = new TimeOnly(12, 0) }
                },
                RoomId = ValidRoomId
            };

            _workShiftRepositoryMock
                .Setup(r => r.HasRoomOverlapAsync(ValidRoomId, from, new TimeOnly(8, 0), new TimeOnly(12, 0), null))
                .ReturnsAsync(true);

            var result = await _service.CreateBulkWorkShiftsAsync(request);

            result.CreatedCount.Should().Be(1);
            result.Skipped.Should().ContainSingle(s =>
                s.ScheduleDate == from && s.Reason == ErrorConstants.WorkShiftMessage.RoomOverlap);
        }

        [Fact]
        public async Task CreateBulkWorkShiftsAsync_ShouldThrow_WhenDateRangeExceeds62Days()
        {
            SetupValidStaffAndRoom();
            var request = CreateValidBulkRequest(TomorrowDate, TomorrowDate.AddDays(63));

            var act = () => _service.CreateBulkWorkShiftsAsync(request);

            await act.Should().ThrowAsync<BadRequestException>()
                .WithMessage(ErrorConstants.WorkShiftMessage.BulkShiftInvalidRange);
        }

        [Fact]
        public async Task CreateBulkWorkShiftsAsync_ShouldThrow_WhenToDateBeforeFromDate()
        {
            SetupValidStaffAndRoom();
            var request = CreateValidBulkRequest(TomorrowDate.AddDays(2), TomorrowDate);

            var act = () => _service.CreateBulkWorkShiftsAsync(request);

            await act.Should().ThrowAsync<BadRequestException>()
                .WithMessage(ErrorConstants.WorkShiftMessage.BulkShiftInvalidRange);
        }

        [Fact]
        public async Task CreateBulkWorkShiftsAsync_ShouldThrow_WhenFromDateIsInThePast()
        {
            SetupValidStaffAndRoom();
            var request = CreateValidBulkRequest(YesterdayDate, TomorrowDate);

            var act = () => _service.CreateBulkWorkShiftsAsync(request);

            await act.Should().ThrowAsync<BadRequestException>()
                .WithMessage(ErrorConstants.WorkShiftMessage.BulkShiftInvalidRange);
        }

        [Fact]
        public async Task CreateBulkWorkShiftsAsync_ShouldThrow_WhenSlotsOverlap()
        {
            SetupValidStaffAndRoom();
            var request = CreateValidBulkRequest();
            request.Slots = new List<BulkWorkShiftSlot>
            {
                new() { ShiftStart = new TimeOnly(8, 0), ShiftEnd = new TimeOnly(12, 0) },
                new() { ShiftStart = new TimeOnly(11, 0), ShiftEnd = new TimeOnly(15, 0) }
            };

            var act = () => _service.CreateBulkWorkShiftsAsync(request);

            await act.Should().ThrowAsync<BadRequestException>()
                .WithMessage(ErrorConstants.WorkShiftMessage.BulkShiftInvalidSlots);
        }

        [Fact]
        public async Task CreateBulkWorkShiftsAsync_ShouldThrow_WhenNothingToCreate()
        {
            SetupValidStaffAndRoom();
            var request = CreateValidBulkRequest();
            _workShiftRepositoryMock
                .Setup(r => r.HasOverlapAsync(It.IsAny<int>(), It.IsAny<DateOnly>(), It.IsAny<TimeOnly>(), It.IsAny<TimeOnly>(), It.IsAny<long?>()))
                .ReturnsAsync(true);

            var act = () => _service.CreateBulkWorkShiftsAsync(request);

            await act.Should().ThrowAsync<BadRequestException>()
                .WithMessage(ErrorConstants.WorkShiftMessage.BulkShiftNothingToCreate);
            _workShiftRepositoryMock.Verify(r => r.AddRangeAsync(It.IsAny<IEnumerable<StaffSchedule>>()), Times.Never);
        }

        [Fact]
        public async Task CreateBulkWorkShiftsAsync_ShouldHonorSkippedItems()
        {
            SetupValidStaffAndRoom();
            var request = CreateValidBulkRequest();
            request.SkippedItems = new List<BulkSkippedItem>
            {
                new()
                {
                    StaffUserId = ValidStaffUserId,
                    ScheduleDate = request.FromDate,
                    ShiftStart = new TimeOnly(8, 0)
                }
            };

            var act = () => _service.CreateBulkWorkShiftsAsync(request);

            await act.Should().ThrowAsync<BadRequestException>()
                .WithMessage(ErrorConstants.WorkShiftMessage.BulkShiftNothingToCreate);
        }

        // UTCID11 (A): one slot of the request starting off the slot boundary stops the whole request
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
    }
}

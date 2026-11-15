using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.WorkShifts
{
    // OZ-WS-05 DeleteWorkShift
    [Trait("Tab", "OZ-WS-05")]
    public class DeleteWorkShiftTests : WorkShiftTestBase
    {
        private StaffSchedule SetupShift(DateOnly date, TimeOnly start, bool hasAppointments = false)
        {
            var shift = CreateSampleSchedule(id: 1, date: date);
            shift.ShiftStart = start;
            shift.ShiftEnd = start == TimeOnly.MaxValue ? TimeOnly.MaxValue : start.AddHours(4);
            _workShiftRepositoryMock.Setup(r => r.GetByIdAsync(1)).ReturnsAsync(shift);
            _workShiftRepositoryMock
                .Setup(r => r.HasBookedAppointmentsAsync(shift.StaffProfileId, shift.ScheduleDate, shift.ShiftStart, shift.ShiftEnd))
                .ReturnsAsync(hasAppointments);
            _workShiftRepositoryMock.Setup(r => r.SaveChangesAsync()).Returns(Task.CompletedTask);
            return shift;
        }

        // UTCID01 (N): a future shift without booked appointments is deleted
        [Fact]
        public async Task DeleteWorkShiftAsync_ShouldRemoveShift_WhenFutureAndNoAppointments()
        {
            var shift = SetupShift(TomorrowDate, new TimeOnly(8, 0));

            await _service.DeleteWorkShiftAsync(1);

            _workShiftRepositoryMock.Verify(r => r.Remove(shift), Times.Once);
            _workShiftRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
        }

        // UTCID02 (B): a shift of today that has not started yet can still be deleted
        [Fact]
        public async Task DeleteWorkShiftAsync_ShouldRemoveShift_WhenShiftIsTodayButNotStarted()
        {
            var shift = SetupShift(TodayDate, TimeOnly.MaxValue);

            await _service.DeleteWorkShiftAsync(1);

            _workShiftRepositoryMock.Verify(r => r.Remove(shift), Times.Once);
        }

        // UTCID03 (A): an unknown id is rejected
        [Fact]
        public async Task DeleteWorkShiftAsync_ShouldThrowNotFound_WhenShiftDoesNotExist()
        {
            _workShiftRepositoryMock.Setup(r => r.GetByIdAsync(999)).ReturnsAsync((StaffSchedule?)null);

            var act = () => _service.DeleteWorkShiftAsync(999);

            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.WorkShiftNotFound);
            _workShiftRepositoryMock.Verify(r => r.Remove(It.IsAny<StaffSchedule>()), Times.Never);
        }

        // UTCID04 (A): a shift of a past day keeps its history
        [Fact]
        public async Task DeleteWorkShiftAsync_ShouldThrowBadRequest_WhenShiftIsInThePast()
        {
            SetupShift(YesterdayDate, new TimeOnly(8, 0));

            var act = () => _service.DeleteWorkShiftAsync(1);

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.ShiftAlreadyStarted);
            _workShiftRepositoryMock.Verify(r => r.Remove(It.IsAny<StaffSchedule>()), Times.Never);
        }

        // UTCID05 (B): a shift of today that started at midnight has already started
        [Fact]
        public async Task DeleteWorkShiftAsync_ShouldThrowBadRequest_WhenShiftStartedEarlierToday()
        {
            SetupShift(TodayDate, TimeOnly.MinValue);

            var act = () => _service.DeleteWorkShiftAsync(1);

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.ShiftAlreadyStarted);
        }

        // UTCID06 (A): a shift with booked appointments must have them moved first
        [Fact]
        public async Task DeleteWorkShiftAsync_ShouldThrowBadRequest_WhenShiftHasBookedAppointments()
        {
            SetupShift(TomorrowDate, new TimeOnly(8, 0), hasAppointments: true);

            var act = () => _service.DeleteWorkShiftAsync(1);

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.WorkShiftMessage.ShiftHasAppointments);
            _workShiftRepositoryMock.Verify(r => r.Remove(It.IsAny<StaffSchedule>()), Times.Never);
        }
    }
}

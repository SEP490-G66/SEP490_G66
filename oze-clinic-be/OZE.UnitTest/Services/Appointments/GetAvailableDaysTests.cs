using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // GET api/appointments/available-days: the free-slot count of a whole range with one shift and one appointment query
    public class GetAvailableDaysTests : BookingFlowTestBase
    {
        private const int OtherDoctorId = DoctorId + 1;

        private static StaffSchedule Shift(DateOnly date, int doctorId, TimeOnly start, TimeOnly end) => new()
        {
            StaffProfileId = doctorId,
            ScheduleDate = date,
            ShiftStart = start,
            ShiftEnd = end,
            Room = new Room { Id = RoomId, RoomType = RoomTypeConstants.GeneralTreatment },
            StaffProfile = new StaffProfile { Id = doctorId, FullName = "BS" }
        };

        private void SetupRange(DateOnly from, DateOnly to, List<StaffSchedule> shifts, List<Appointment>? booked = null)
        {
            _appointmentRepoMock
                .Setup(r => r.GetDoctorShiftsInRangeAsync(from, to, null))
                .ReturnsAsync(shifts);
            _appointmentRepoMock
                .Setup(r => r.GetActiveAppointmentsInRangeAsync(from, to, It.IsAny<IReadOnlyCollection<int>>()))
                .ReturnsAsync(booked ?? new List<Appointment>());
        }

        private static AvailableDaysRequest Query(DateOnly from, DateOnly to) => new() { From = from, To = to };

        [Fact]
        public async Task GetAvailableDaysAsync_ShouldCountEveryDayWithOneQueryEach()
        {
            var day1 = Tomorrow;
            var day2 = Tomorrow.AddDays(1);
            var day3 = Tomorrow.AddDays(2);
            SetupRange(day1, day3,
                new List<StaffSchedule>
                {
                    Shift(day1, DoctorId, new TimeOnly(8, 0), new TimeOnly(10, 0)),
                    // Same times as the first doctor: counted once per start time
                    Shift(day1, OtherDoctorId, new TimeOnly(8, 0), new TimeOnly(9, 0)),
                    Shift(day2, DoctorId, new TimeOnly(13, 0), new TimeOnly(14, 0))
                },
                new List<Appointment>
                {
                    new() { DoctorId = DoctorId, AppointmentDate = day2, TimeSlotStart = new TimeOnly(13, 0), TimeSlotEnd = new TimeOnly(14, 0) }
                });

            var result = await _service.GetAvailableDaysAsync(Query(day1, day3));

            result.Select(d => d.Date).Should().Equal(day1, day2, day3);
            result[0].FreeSlotCount.Should().Be(4);
            result[0].FirstSlotStart.Should().Be(new TimeOnly(8, 0));
            result[0].IsWorkingDay.Should().BeTrue();
            // Working but fully booked
            result[1].FreeSlotCount.Should().Be(0);
            result[1].IsWorkingDay.Should().BeTrue();
            result[1].FirstSlotStart.Should().BeNull();
            // No shift: day off
            result[2].IsWorkingDay.Should().BeFalse();
            _appointmentRepoMock.Verify(r => r.GetDoctorShiftsInRangeAsync(day1, day3, null), Times.Once);
            _appointmentRepoMock.Verify(r => r.GetActiveAppointmentsInRangeAsync(day1, day3, It.IsAny<IReadOnlyCollection<int>>()), Times.Once);
            // One query for the whole range, no extra per-day query
            _appointmentRepoMock.Verify(r => r.GetDoctorShiftsInRangeAsync(It.IsAny<DateOnly>(), It.IsAny<DateOnly>(), It.IsAny<int?>()), Times.Once);
        }

        [Fact]
        public async Task GetAvailableDaysAsync_ShouldClampToTheBookableWindow()
        {
            // The window is today .. today + 30 (BookingMaxDaysAhead in the test config)
            var lastDay = Today.AddDays(30);
            SetupRange(Today, lastDay, new List<StaffSchedule>());

            var result = await _service.GetAvailableDaysAsync(Query(Today.AddDays(-3), Today.AddDays(40)));

            result.First().Date.Should().Be(Today);
            result.Last().Date.Should().Be(lastDay);
            result.Should().HaveCount(31);
        }

        [Fact]
        public async Task GetAvailableDaysAsync_ShouldReturnNothing_WhenTheRangeIsOutsideTheWindow()
        {
            var result = await _service.GetAvailableDaysAsync(Query(Today.AddDays(-10), Today.AddDays(-1)));

            result.Should().BeEmpty();
            _appointmentRepoMock.Verify(r => r.GetDoctorShiftsInRangeAsync(It.IsAny<DateOnly>(), It.IsAny<DateOnly>(), It.IsAny<int?>()), Times.Never);
        }

        [Fact]
        public async Task GetAvailableDaysAsync_ShouldRejectAReversedRange()
        {
            var act = () => _service.GetAvailableDaysAsync(Query(Tomorrow.AddDays(2), Tomorrow));

            (await act.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.AppointmentMessage.DateRangeInvalid);
        }

        [Fact]
        public async Task GetAvailableDaysAsync_ShouldNotQueryAppointments_WhenNoDoctorWorks()
        {
            SetupRange(Tomorrow, Tomorrow, new List<StaffSchedule>());

            var result = await _service.GetAvailableDaysAsync(Query(Tomorrow, Tomorrow));

            result.Should().ContainSingle().Which.IsWorkingDay.Should().BeFalse();
            _appointmentRepoMock.Verify(r => r.GetActiveAppointmentsInRangeAsync(It.IsAny<DateOnly>(), It.IsAny<DateOnly>(), It.IsAny<IReadOnlyCollection<int>>()), Times.Never);
        }
    }
}

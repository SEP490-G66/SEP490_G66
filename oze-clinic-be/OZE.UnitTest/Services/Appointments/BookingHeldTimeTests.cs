using FluentAssertions;
using Moq;
using OZE.Application.Helpers;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // OZ-APPT-23 BookingHeldTime
    [Trait("Tab", "OZ-APPT-23")]
    public class BookingHeldTimeTests : BookingFlowTestBase
    {
        private static AvailableSlotRequest Query() => new() { Date = Tomorrow, DoctorId = DoctorId };

        // UTCID01 (N): rounding of the held time
        [Theory]
        [InlineData(20, 30, 30)]
        [InlineData(30, 30, 30)]
        [InlineData(45, 30, 60)]
        [InlineData(75, 30, 90)]
        [InlineData(10, 15, 15)]
        [InlineData(0, 30, 0)]
        [InlineData(45, 0, 45)]
        public void HeldMinutes_ShouldRoundUpToWholeSlots(int serviceMinutes, int slotMinutes, int expected)
        {
            SlotTimeHelper.HeldMinutes(serviceMinutes, slotMinutes).Should().Be(expected);
        }

        // UTCID02 (N): slot boundaries of the day
        [Theory]
        [InlineData(8, 0, 30, true)]
        [InlineData(8, 30, 30, true)]
        [InlineData(8, 15, 30, false)]
        [InlineData(8, 15, 15, true)]
        [InlineData(8, 20, 0, true)]
        public void IsOnSlot_ShouldMatchSlotBoundaries(int hour, int minute, int slotMinutes, bool expected)
        {
            SlotTimeHelper.IsOnSlot(new TimeOnly(hour, minute), slotMinutes).Should().Be(expected);
        }

        // UTCID03 (N): a 20-minute service still holds a whole 30-minute slot, so it ends on the grid
        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldHoldWholeSlot_WhenServiceIsShorter()
        {
            _generalExamService.EstimatedMinutes = 20;

            var result = await _service.GetAvailableSlotsAsync(Query());

            result.Select(x => x.SlotStart).Should().Equal(new TimeOnly(8, 0), new TimeOnly(8, 30), new TimeOnly(9, 0), new TimeOnly(9, 30));
            result.Should().OnlyContain(x => x.SlotEnd == x.SlotStart.AddMinutes(30));
        }

        // UTCID04 (N): a 45-minute service holds 60 minutes; the last start that fits the 08:00-10:00 shift is 09:00
        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldHoldTwoSlots_WhenServiceIsFortyFiveMinutes()
        {
            _generalExamService.EstimatedMinutes = 45;

            var result = await _service.GetAvailableSlotsAsync(Query());

            result.Select(x => x.SlotStart).Should().Equal(new TimeOnly(8, 0), new TimeOnly(8, 30), new TimeOnly(9, 0));
            result.Should().OnlyContain(x => x.SlotEnd == x.SlotStart.AddMinutes(60));
        }

        // UTCID05 (N): the saved booking ends on the slot boundary, while the service line keeps its own 20 minutes
        [Fact]
        public async Task BookAsGuestAsync_ShouldSaveRoundedEnd_AndKeepServiceMinutes()
        {
            _generalExamService.EstimatedMinutes = 20;
            Appointment? saved = null;
            _appointmentRepoMock.Setup(r => r.AddAsync(It.IsAny<Appointment>())).Callback<Appointment>(a => { a.Id = 500; saved = a; }).Returns(Task.CompletedTask);

            await _service.BookAsGuestAsync(Booking(new GuestBookingRequest { FullName = "Nguyen Van A", PhoneNumber = Phone }));

            saved!.TimeSlotStart.Should().Be(new TimeOnly(8, 0));
            saved.TimeSlotEnd.Should().Be(new TimeOnly(8, 30));
            saved.ServiceItems.Should().ContainSingle().Which.DurationMinutes.Should().Be(20);
        }
    }
}

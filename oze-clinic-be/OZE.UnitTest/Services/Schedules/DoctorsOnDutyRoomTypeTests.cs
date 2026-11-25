using FluentAssertions;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Schedules
{
    // OZ-SCH-01 DoctorsOnDuty: room type and waiting count, so the desk picks a doctor in a suitable room (BE-D1, BE-C1)
    [Trait("Tab", "OZ-SCH-01")]
    public class DoctorsOnDutyRoomTypeTests
    {
        private readonly Mock<IWorkShiftRepository> _shiftRepo = new();
        private readonly Mock<ILeaveRequestRepository> _leaveRepo = new();
        private readonly ScheduleViewService _service;
        private readonly DateOnly _date = new(2026, 11, 25);

        public DoctorsOnDutyRoomTypeTests()
        {
            _service = new ScheduleViewService(_shiftRepo.Object, new Mock<IStaffRepository>().Object, _leaveRepo.Object);
            _leaveRepo.Setup(r => r.GetApprovedOnDateAsync(_date, It.IsAny<CancellationToken>())).ReturnsAsync(new List<LeaveRequest>());
            _shiftRepo.Setup(r => r.GetDoctorShiftsOnDateAsync(_date)).ReturnsAsync(new List<StaffSchedule>
            {
                Shift(1, new Room { Id = 1, RoomName = "Phong kham 1", RoomType = RoomTypeConstants.GeneralTreatment }),
                Shift(2, new Room { Id = 3, RoomName = "Phong X-quang", RoomType = RoomTypeConstants.XRay })
            });
        }

        private static StaffSchedule Shift(int staffId, Room room) => new()
        {
            Id = staffId,
            StaffProfileId = staffId,
            StaffProfile = new StaffProfile { Id = staffId, UserId = $"u{staffId}", FullName = $"Bac si {staffId}" },
            Room = room,
            RoomId = room.Id,
            ShiftStart = new TimeOnly(8, 0),
            ShiftEnd = new TimeOnly(12, 0)
        };

        // UTCID05 (N): each doctor carries the type of the shift's room
        [Fact]
        public async Task OnDuty_ReturnsRoomTypeOfShift()
        {
            var result = await _service.GetDoctorsOnDutyAsync(new DoctorsOnDutyQuery { Date = _date });

            result.Select(x => x.RoomType).Should().Equal(RoomTypeConstants.GeneralTreatment, RoomTypeConstants.XRay);
        }

        // UTCID06 (N): the number of patients waiting per doctor; 0 for a doctor nobody waits for
        [Fact]
        public async Task OnDuty_ReturnsWaitingCount()
        {
            _shiftRepo.Setup(r => r.CountWaitingByDoctorAsync(_date, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Dictionary<int, int> { [1] = 3 });

            var result = await _service.GetDoctorsOnDutyAsync(new DoctorsOnDutyQuery { Date = _date });

            result.Select(x => x.WaitingCount).Should().Equal(3, 0);
        }
    }
}

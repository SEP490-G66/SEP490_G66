using Moq;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Domain.Entities;

namespace OZE.UnitTest.Services.Schedules
{
    // Shared mocks and data for the doctor's own schedule (OZ-DS). Holds no tests itself.
    public abstract class DoctorScheduleTestBase
    {
        protected const string DoctorUserId = "doctor-user-1";
        protected const int DoctorId = 5;
        protected const long ShiftId = 70;
        protected const int RoomId = 3;

        protected readonly Mock<IWorkShiftRepository> _shiftRepo = new();
        protected readonly Mock<IAppointmentRepository> _appointmentRepo = new();
        protected readonly Mock<IStaffRepository> _staffRepo = new();
        protected readonly Mock<IQueueService> _queueService = new();
        protected readonly Mock<IAuditLogService> _auditLogService = new();
        protected readonly DoctorScheduleService _service;

        protected static DateOnly Today => DateOnly.FromDateTime(ClinicClock.Today);

        protected DoctorScheduleTestBase()
        {
            _service = new DoctorScheduleService(_shiftRepo.Object, _appointmentRepo.Object, _staffRepo.Object,
                _queueService.Object, _auditLogService.Object);
            _staffRepo.Setup(r => r.GetByUserIdAsync(DoctorUserId))
                .ReturnsAsync(new StaffProfile { Id = DoctorId, UserId = DoctorUserId, FullName = "BS. Le Thu Ha" });
            _shiftRepo.Setup(r => r.SaveChangesAsync()).Returns(Task.CompletedTask);
            _appointmentRepo.Setup(r => r.GetDoctorAppointmentsAsync(DoctorId, It.IsAny<DateOnly>(), It.IsAny<DateOnly>()))
                .ReturnsAsync(new List<Appointment>());
            _appointmentRepo.Setup(r => r.GetDoctorOpenAppointmentsAsync(DoctorId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<Appointment>());
        }

        protected static DateOnly StartOfCurrentWeek
        {
            get
            {
                var diff = ((int)Today.DayOfWeek - (int)WorkShiftConstants.WeekStartDay + WorkShiftConstants.DaysInWeek) % WorkShiftConstants.DaysInWeek;
                return Today.AddDays(-diff);
            }
        }

        // A shift of the doctor; by default today and running the whole day, whatever time the test runs
        protected StaffSchedule Shift(DateOnly? date = null, TimeOnly? start = null, TimeOnly? end = null,
            TimeOnly? startedAt = null, int staffId = DoctorId)
        {
            var shift = new StaffSchedule
            {
                Id = ShiftId,
                StaffProfileId = staffId,
                RoomId = RoomId,
                Room = new Room { Id = RoomId, RoomName = "Phong kham 1" },
                ScheduleDate = date ?? Today,
                ShiftStart = start ?? TimeOnly.MinValue,
                ShiftEnd = end ?? TimeOnly.MaxValue,
                ActualStartTime = startedAt
            };
            _shiftRepo.Setup(r => r.GetByIdAsync(ShiftId)).ReturnsAsync(shift);
            return shift;
        }

        protected static Appointment Booked(long id, DateOnly date, TimeOnly time, string status = AppointmentConstants.ConfirmedStatus) => new()
        {
            Id = id,
            PatientId = (int)id,
            Patient = new Patient { Id = (int)id, PatientCode = "BN" + id, FullName = "Benh nhan " + id },
            DoctorId = DoctorId,
            AppointmentType = AppointmentConstants.BookedType,
            AppointmentDate = date,
            TimeSlotStart = time,
            TimeSlotEnd = time.AddMinutes(30),
            Status = status
        };
    }
}

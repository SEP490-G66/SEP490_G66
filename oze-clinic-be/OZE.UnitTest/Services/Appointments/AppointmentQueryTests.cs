using FluentAssertions;
using Moq;
using OZE.Application.Helpers;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // OZ-APPT-07 GetMyAppointments
    [Trait("Tab", "OZ-APPT-07")]
    public class GetMyAppointmentsTests : AppointmentFollowUpTestBase
    {
        // UTCID01 (N): the list is always the signed-in patient's own, whatever patient id was sent
        [Fact]
        public async Task GetMyAppointmentsAsync_ShouldUseOwnPatientId()
        {
            _appointmentRepoMock.Setup(r => r.GetPatientByUserIdAsync(_patient.UserId!)).ReturnsAsync(_patient);
            _appointmentRepoMock.Setup(r => r.GetAppointmentsAsync(It.IsAny<AppointmentQueryParameters>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PagedResult<Appointment>(new List<Appointment>(), 0, 1, 10));
            var query = new AppointmentQueryParameters { PatientId = 999 };

            await _service.GetMyAppointmentsAsync(query, _patient.UserId!);

            query.PatientId.Should().Be(_patient.Id);
            _appointmentRepoMock.Verify(r => r.GetAppointmentsAsync(It.Is<AppointmentQueryParameters>(q => q.PatientId == _patient.Id), It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (A): the account has no patient record
        [Fact]
        public async Task GetMyAppointmentsAsync_ShouldThrow_WhenNoPatientProfile()
        {
            var act = () => _service.GetMyAppointmentsAsync(new AppointmentQueryParameters(), "user-without-profile");

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PatientProfileNotFound);
        }
    }

    // OZ-APPT-08 GetAppointmentById
    [Trait("Tab", "OZ-APPT-08")]
    public class GetAppointmentByIdTests : AppointmentFollowUpTestBase
    {
        private void Exists() => _appointmentRepoMock.Setup(r => r.GetByIdWithDetailsAsync(500, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Appointment { Id = 500, PatientId = _patient.Id, Patient = _patient, Status = AppointmentConstants.PendingStatus });

        // UTCID01 (N): staff can open any appointment
        [Fact]
        public async Task GetAppointmentByIdAsync_ShouldReturnAppointment_ForStaff()
        {
            Exists();

            var result = await _service.GetAppointmentByIdAsync(500, null);

            result.Id.Should().Be(500);
            result.PatientName.Should().Be(_patient.FullName);
        }

        // UTCID02 (N): a patient opens their own appointment
        [Fact]
        public async Task GetAppointmentByIdAsync_ShouldReturnAppointment_ForOwnerPatient()
        {
            Exists();

            var result = await _service.GetAppointmentByIdAsync(500, _patient.UserId);

            result.Id.Should().Be(500);
        }

        // UTCID03 (A): the appointment does not exist
        [Fact]
        public async Task GetAppointmentByIdAsync_ShouldThrow_WhenNotFound()
        {
            var act = () => _service.GetAppointmentByIdAsync(999, null);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.AppointmentNotFound);
        }

        // UTCID04 (A): another patient's appointment looks the same as a missing one
        [Fact]
        public async Task GetAppointmentByIdAsync_ShouldThrow_WhenAppointmentOfAnotherPatient()
        {
            Exists();

            var act = () => _service.GetAppointmentByIdAsync(500, "other-patient-user");

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.AppointmentNotFound);
        }
    }

    // OZ-APPT-09 GetWaitingList (more cases next to GetWaitingListTests)
    [Trait("Tab", "OZ-APPT-09")]
    public class GetWaitingListDoctorTests : AppointmentQueueTestBase
    {
        // UTCID02 (N): a doctor gets the list of their own patients
        [Fact]
        public async Task GetWaitingListAsync_ShouldUseOwnDoctorId_ForDoctor()
        {
            _appointmentRepoMock.Setup(r => r.GetStaffProfileIdByUserIdAsync(DoctorUserId)).ReturnsAsync(DoctorId);
            _appointmentRepoMock.Setup(r => r.GetWaitingAppointmentsAsync(It.IsAny<DateOnly>(), DoctorId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<Appointment>());

            var result = await _service.GetWaitingListAsync(77, DoctorUserId);

            result.Should().BeEmpty();
            _appointmentRepoMock.Verify(r => r.GetWaitingAppointmentsAsync(It.IsAny<DateOnly>(), DoctorId, It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID03 (A): the doctor account has no staff profile
        [Fact]
        public async Task GetWaitingListAsync_ShouldThrow_WhenDoctorProfileNotFound()
        {
            _appointmentRepoMock.Setup(r => r.GetStaffProfileIdByUserIdAsync("unknown-doctor")).ReturnsAsync((int?)null);

            var act = () => _service.GetWaitingListAsync(null, "unknown-doctor");

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.DoctorProfileNotFound);
        }
    }

    // OZ-APPT-10 GetNeedsAttention
    [Trait("Tab", "OZ-APPT-10")]
    public class GetNeedsAttentionTests : AppointmentFollowUpTestBase
    {
        private static DateOnly Today => DateOnly.FromDateTime(ClinicClock.Today);

        private Appointment At(long id, int hour, int minute, string status) => new()
        {
            Id = id,
            PatientId = _patient.Id,
            Patient = _patient,
            DoctorId = DoctorId,
            Doctor = new StaffProfile { Id = DoctorId, FullName = "BS. Le Thu Ha" },
            AppointmentType = AppointmentConstants.BookedType,
            AppointmentDate = Today,
            TimeSlotStart = new TimeOnly(hour, minute),
            Status = status
        };

        // UTCID01 (B): no doctor has ended a shift today
        [Fact]
        public async Task GetNeedsAttentionAsync_ShouldReturnEmpty_WhenNoShiftEnded()
        {
            _appointmentRepoMock.Setup(r => r.GetEndedShiftsAsync(Today)).ReturnsAsync(new List<StaffSchedule>());

            var result = await _service.GetNeedsAttentionAsync();

            result.Should().BeEmpty();
        }

        // UTCID02 (N): the doctor ended at 10:00 -> a patient waiting is WAITING, a booking at 11:00 is UPCOMING, 09:30 is left out
        [Fact]
        public async Task GetNeedsAttentionAsync_ShouldGroupWaitingAndUpcomingPatients()
        {
            _appointmentRepoMock.Setup(r => r.GetEndedShiftsAsync(Today)).ReturnsAsync(new List<StaffSchedule>
            {
                new() { Id = 1, StaffProfileId = DoctorId, ScheduleDate = Today, ShiftStart = new TimeOnly(8, 0), ShiftEnd = new TimeOnly(12, 0), ActualEndTime = new TimeOnly(10, 0) }
            });
            _appointmentRepoMock.Setup(r => r.GetAppointmentsOfDoctorsAsync(Today, It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<IReadOnlyCollection<string>>()))
                .ReturnsAsync(new List<Appointment>
                {
                    At(1, 9, 0, AppointmentConstants.CheckedInStatus),
                    At(2, 11, 0, AppointmentConstants.ConfirmedStatus),
                    At(3, 9, 30, AppointmentConstants.ConfirmedStatus)
                });

            var result = await _service.GetNeedsAttentionAsync();

            result.Select(x => (x.AppointmentId, x.Group)).Should().Equal(
                (1L, AppointmentConstants.AttentionWaiting), (2L, AppointmentConstants.AttentionUpcoming));
            result[0].PatientPhoneNumber.Should().Be(_patient.PhoneNumber);
        }
    }

    // OZ-APPT-11 ConfirmAppointment
    [Trait("Tab", "OZ-APPT-11")]
    public class ConfirmAppointmentTests : AppointmentFollowUpTestBase
    {
        private Appointment Exists(string status)
        {
            var appointment = new Appointment
            {
                Id = 500, PatientId = _patient.Id, Patient = _patient, DoctorId = DoctorId, Status = status,
                AppointmentDate = DateOnly.FromDateTime(ClinicClock.Today).AddDays(2), TimeSlotStart = new TimeOnly(9, 0)
            };
            _appointmentRepoMock.Setup(r => r.GetByIdWithDetailsAsync(500, It.IsAny<CancellationToken>())).ReturnsAsync(appointment);
            return appointment;
        }

        // UTCID01 (N): a PENDING booking becomes CONFIRMED and the change is logged
        [Fact]
        public async Task ConfirmAppointmentAsync_ShouldConfirmPendingAppointment()
        {
            var appointment = Exists(AppointmentConstants.PendingStatus);

            var result = await _service.ConfirmAppointmentAsync(500);

            result.Status.Should().Be(AppointmentConstants.ConfirmedStatus);
            appointment.Status.Should().Be(AppointmentConstants.ConfirmedStatus);
            _auditLogMock.Verify(a => a.LogAsync(AuditConstants.AppointmentConfirmed, AuditConstants.AppointmentEntity, "500",
                It.IsAny<object?>(), It.IsAny<object?>(), It.IsAny<string?>()), Times.Once);
        }

        // UTCID02 (A): only a PENDING booking can be confirmed
        [Fact]
        public async Task ConfirmAppointmentAsync_ShouldThrow_WhenNotPending()
        {
            Exists(AppointmentConstants.ConfirmedStatus);

            var act = () => _service.ConfirmAppointmentAsync(500);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.OnlyPendingCanBeConfirmed);
        }

        // UTCID03 (A): the appointment does not exist
        [Fact]
        public async Task ConfirmAppointmentAsync_ShouldThrow_WhenNotFound()
        {
            var act = () => _service.ConfirmAppointmentAsync(999);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.AppointmentNotFound);
        }
    }
}

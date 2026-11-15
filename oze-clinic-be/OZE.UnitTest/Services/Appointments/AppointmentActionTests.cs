using FluentAssertions;
using Moq;
using OZE.Application.Helpers;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // Shared data for the actions on one appointment (cancel, reschedule, check-in, priority, no-show)
    public abstract class AppointmentActionTestBase : AppointmentFollowUpTestBase
    {
        protected const long Id = 500;
        protected static DateOnly Today => DateOnly.FromDateTime(ClinicClock.Today);

        protected AppointmentActionTestBase()
        {
            _appointmentRepoMock.Setup(r => r.GetConfigValueAsync(ConfigKeyConstants.BookingCancelCutoffHours)).ReturnsAsync("24");
        }

        protected Appointment Existing(string status, DateOnly date, TimeOnly? time = null, Examination? examination = null)
        {
            var appointment = new Appointment
            {
                Id = Id,
                PatientId = _patient.Id,
                Patient = _patient,
                DoctorId = DoctorId,
                AppointmentType = AppointmentConstants.BookedType,
                AppointmentDate = date,
                TimeSlotStart = time ?? new TimeOnly(9, 0),
                TimeSlotEnd = (time ?? new TimeOnly(9, 0)).AddMinutes(30),
                Status = status,
                Examination = examination,
                ServiceItems = new List<AppointmentServiceItem> { new() { ServiceId = _generalExamService.Id, Service = _generalExamService } }
            };
            _appointmentRepoMock.Setup(r => r.GetByIdWithDetailsAsync(Id, It.IsAny<CancellationToken>())).ReturnsAsync(appointment);
            _appointmentRepoMock.Setup(r => r.GetByIdWithExaminationAsync(Id, It.IsAny<CancellationToken>())).ReturnsAsync(appointment);
            return appointment;
        }
    }

    // OZ-APPT-12 CancelAppointment (UTCID01 is in CancelAppointmentTests)
    [Trait("Tab", "OZ-APPT-12")]
    public class CancelAppointmentRuleTests : AppointmentActionTestBase
    {
        private static CancelAppointmentRequest Reason(string reason = " Ban viec ") => new() { Reason = reason };

        // UTCID02 (N): staff cancel a confirmed appointment; the reason is kept and logged
        [Fact]
        public async Task CancelAppointmentAsync_ShouldCancel_WhenStaffCancelsConfirmed()
        {
            var appointment = Existing(AppointmentConstants.ConfirmedStatus, Today.AddDays(2));

            var result = await _service.CancelAppointmentAsync(Id, Reason(), "receptionist-1", null);

            result.Status.Should().Be(AppointmentConstants.CancelledStatus);
            appointment.CancellationReason.Should().Be("Ban viec");
            appointment.CancelledByUserId.Should().Be("receptionist-1");
            _auditLogMock.Verify(a => a.LogAsync(AuditConstants.AppointmentCancelled, AuditConstants.AppointmentEntity, "500",
                It.IsAny<object?>(), It.IsAny<object?>(), "Ban viec"), Times.Once);
        }

        // UTCID03 (N): a patient cancels their own PENDING booking well before the time
        [Fact]
        public async Task CancelAppointmentAsync_ShouldCancel_WhenPatientCancelsOwnPendingInTime()
        {
            Existing(AppointmentConstants.PendingStatus, Today.AddDays(5));

            var result = await _service.CancelAppointmentAsync(Id, Reason(), _patient.UserId, _patient.UserId);

            result.Status.Should().Be(AppointmentConstants.CancelledStatus);
        }

        // UTCID04 (A): no reason
        [Fact]
        public async Task CancelAppointmentAsync_ShouldThrow_WhenReasonEmpty()
        {
            var act = () => _service.CancelAppointmentAsync(Id, Reason("  "), "receptionist-1", null);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ReasonRequired);
        }

        // UTCID05 (A): a finished appointment cannot be cancelled
        [Fact]
        public async Task CancelAppointmentAsync_ShouldThrow_WhenNotOpen()
        {
            Existing(AppointmentConstants.CompletedStatus, Today);

            var act = () => _service.CancelAppointmentAsync(Id, Reason(), "receptionist-1", null);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.OnlyOpenCanBeCancelled);
        }

        // UTCID06 (A): a patient cannot cancel a confirmed appointment online
        [Fact]
        public async Task CancelAppointmentAsync_ShouldThrow_WhenPatientCancelsConfirmed()
        {
            Existing(AppointmentConstants.ConfirmedStatus, Today.AddDays(5));

            var act = () => _service.CancelAppointmentAsync(Id, Reason(), _patient.UserId, _patient.UserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ConfirmedNeedsReceptionistToCancel);
        }

        // UTCID07 (B): less than 24 hours before the visit, a patient cannot cancel online
        [Fact]
        public async Task CancelAppointmentAsync_ShouldThrow_WhenPatientCancelsInsideCutoff()
        {
            Existing(AppointmentConstants.PendingStatus, Today.AddDays(1), TimeOnly.MinValue);

            var act = () => _service.CancelAppointmentAsync(Id, Reason(), _patient.UserId, _patient.UserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.CancelDeadlinePassed);
        }
    }

    // OZ-APPT-13 RescheduleAppointment (UTCID01 is in RescheduleAppointmentTests)
    [Trait("Tab", "OZ-APPT-13")]
    public class RescheduleAppointmentRuleTests : AppointmentActionTestBase
    {
        private static DateOnly NewDate => Today.AddDays(10);

        public RescheduleAppointmentRuleTests()
        {
            SetupDoctorShift(NewDate, new TimeOnly(8, 0), new TimeOnly(12, 0));
            _appointmentRepoMock.Setup(r => r.ExecuteSerializableAsync(It.IsAny<Func<Task<AvailableSlotResponse>>>()))
                .Returns<Func<Task<AvailableSlotResponse>>>(action => action());
        }

        private static RescheduleAppointmentRequest To(TimeOnly slot) => new() { Date = NewDate, SlotStart = slot, DoctorId = DoctorId };

        // UTCID02 (N): a patient moves their own PENDING booking; it stays PENDING for the desk to confirm
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldMoveAndKeepPending_WhenPatientReschedules()
        {
            var appointment = Existing(AppointmentConstants.PendingStatus, Today.AddDays(5));

            await _service.RescheduleAppointmentAsync(Id, To(new TimeOnly(9, 0)), _patient.UserId);

            appointment.AppointmentDate.Should().Be(NewDate);
            appointment.TimeSlotStart.Should().Be(new TimeOnly(9, 0));
            appointment.Status.Should().Be(AppointmentConstants.PendingStatus);
        }

        // UTCID03 (N): staff move a booking; it is CONFIRMED at once
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldConfirm_WhenStaffReschedules()
        {
            var appointment = Existing(AppointmentConstants.PendingStatus, Today.AddDays(5));

            await _service.RescheduleAppointmentAsync(Id, To(new TimeOnly(10, 0)), null);

            appointment.Status.Should().Be(AppointmentConstants.ConfirmedStatus);
        }

        // UTCID04 (A): a patient cannot move a confirmed appointment online
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldThrow_WhenPatientReschedulesConfirmed()
        {
            Existing(AppointmentConstants.ConfirmedStatus, Today.AddDays(5));

            var act = () => _service.RescheduleAppointmentAsync(Id, To(new TimeOnly(9, 0)), _patient.UserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ConfirmedNeedsReceptionistToReschedule);
        }

        // UTCID05 (A): a cancelled appointment cannot be moved
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldThrow_WhenNotOpen()
        {
            Existing(AppointmentConstants.CancelledStatus, Today.AddDays(5));

            var act = () => _service.RescheduleAppointmentAsync(Id, To(new TimeOnly(9, 0)), null);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.OnlyOpenCanBeRescheduled);
        }

        // UTCID06 (A): the new time is not a free slot
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldThrow_WhenNewSlotNotAvailable()
        {
            Existing(AppointmentConstants.PendingStatus, Today.AddDays(5));

            var act = () => _service.RescheduleAppointmentAsync(Id, To(new TimeOnly(13, 0)), null);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.SlotNotAvailable);
        }

        // UTCID07 (B): less than 24 hours before the visit, a patient cannot move it online
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldThrow_WhenPatientReschedulesInsideCutoff()
        {
            Existing(AppointmentConstants.PendingStatus, Today.AddDays(1), TimeOnly.MinValue);

            var act = () => _service.RescheduleAppointmentAsync(Id, To(new TimeOnly(9, 0)), _patient.UserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.RescheduleDeadlinePassed);
        }
    }

    // OZ-APPT-14 CheckInAppointment
    [Trait("Tab", "OZ-APPT-14")]
    public class CheckInAppointmentTests : AppointmentActionTestBase
    {
        public CheckInAppointmentTests()
        {
            SetupDoctorShift(Today, TimeOnly.MinValue, TimeOnly.MaxValue);
        }

        // UTCID01 (N): a confirmed patient of today is checked in and sent to the doctor's room
        [Fact]
        public async Task CheckInAppointmentAsync_ShouldCheckIn_WhenConfirmedToday()
        {
            var appointment = Existing(AppointmentConstants.ConfirmedStatus, Today);

            var result = await _service.CheckInAppointmentAsync(Id, null);

            appointment.Status.Should().Be(AppointmentConstants.CheckedInStatus);
            appointment.Priority.Should().Be(PriorityConstants.Normal);
            appointment.CheckInAt.Should().NotBeNull();
            result.RoomId.Should().Be(RoomId);
        }

        // UTCID02 (N): an urgent patient with a reason
        [Fact]
        public async Task CheckInAppointmentAsync_ShouldSetPriority_WhenUrgentWithReason()
        {
            var appointment = Existing(AppointmentConstants.ConfirmedStatus, Today);

            await _service.CheckInAppointmentAsync(Id, new CheckInRequest { Priority = PriorityConstants.Urgent, Reason = "Dau nhieu" });

            appointment.Priority.Should().Be(PriorityConstants.Urgent);
        }

        // UTCID03 (A): a PENDING booking must be confirmed first
        [Fact]
        public async Task CheckInAppointmentAsync_ShouldThrow_WhenPending()
        {
            Existing(AppointmentConstants.PendingStatus, Today);

            var act = () => _service.CheckInAppointmentAsync(Id, null);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.CheckInNeedsConfirmation);
        }

        // UTCID04 (A): only on the day of the appointment
        [Fact]
        public async Task CheckInAppointmentAsync_ShouldThrow_WhenNotToday()
        {
            Existing(AppointmentConstants.ConfirmedStatus, Today.AddDays(1));

            var act = () => _service.CheckInAppointmentAsync(Id, null);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.CheckInWrongDay);
        }

        // UTCID05 (A): a priority above normal needs a reason
        [Fact]
        public async Task CheckInAppointmentAsync_ShouldThrow_WhenHighPriorityWithoutReason()
        {
            Existing(AppointmentConstants.ConfirmedStatus, Today);

            var act = () => _service.CheckInAppointmentAsync(Id, new CheckInRequest { Priority = PriorityConstants.High });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PriorityReasonRequired);
        }

        // UTCID06 (A): the appointment does not exist
        [Fact]
        public async Task CheckInAppointmentAsync_ShouldThrow_WhenNotFound()
        {
            var act = () => _service.CheckInAppointmentAsync(999, null);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.AppointmentNotFound);
        }
    }

    // OZ-APPT-15 SetPriority
    [Trait("Tab", "OZ-APPT-15")]
    public class SetPriorityTests : AppointmentActionTestBase
    {
        // UTCID01 (N): a waiting patient is moved up with a reason
        [Fact]
        public async Task SetPriorityAsync_ShouldChangePriority_WhenWaiting()
        {
            var appointment = Existing(AppointmentConstants.CheckedInStatus, Today);

            await _service.SetPriorityAsync(Id, new SetPriorityRequest { Priority = PriorityConstants.High, Reason = "Nguoi gia" });

            appointment.Priority.Should().Be(PriorityConstants.High);
        }

        // UTCID02 (A): only a patient who is waiting
        [Fact]
        public async Task SetPriorityAsync_ShouldThrow_WhenNotWaiting()
        {
            Existing(AppointmentConstants.ConfirmedStatus, Today);

            var act = () => _service.SetPriorityAsync(Id, new SetPriorityRequest { Priority = PriorityConstants.High, Reason = "Nguoi gia" });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PriorityOnlyForWaiting);
        }

        // UTCID03 (A): a level that does not exist
        [Fact]
        public async Task SetPriorityAsync_ShouldThrow_WhenPriorityInvalid()
        {
            Existing(AppointmentConstants.CheckedInStatus, Today);

            var act = () => _service.SetPriorityAsync(Id, new SetPriorityRequest { Priority = 5, Reason = "x" });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PriorityInvalid);
        }
    }

    // OZ-APPT-16 MarkNoShow
    [Trait("Tab", "OZ-APPT-16")]
    public class MarkNoShowTests : AppointmentActionTestBase
    {
        // UTCID01 (N): a checked-in patient who left is marked NO_SHOW
        [Fact]
        public async Task MarkNoShowAsync_ShouldMarkNoShow_WhenWaitingAndNotExamined()
        {
            var appointment = Existing(AppointmentConstants.CheckedInStatus, Today);

            var result = await _service.MarkNoShowAsync(Id, new MarkNoShowRequest { Reason = "Bo ve" });

            result.Status.Should().Be(AppointmentConstants.NoShowStatus);
            appointment.Status.Should().Be(AppointmentConstants.NoShowStatus);
        }

        // UTCID02 (A): only a patient who is checked in and waiting
        [Fact]
        public async Task MarkNoShowAsync_ShouldThrow_WhenNotWaiting()
        {
            Existing(AppointmentConstants.ConfirmedStatus, Today);

            var act = () => _service.MarkNoShowAsync(Id, null);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.NoShowOnlyWaiting);
        }

        // UTCID03 (A): the doctor has already started on the patient
        [Fact]
        public async Task MarkNoShowAsync_ShouldThrow_WhenAlreadyExamined()
        {
            Existing(AppointmentConstants.CheckedInStatus, Today, examination: new Examination { Id = 50 });

            var act = () => _service.MarkNoShowAsync(Id, null);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.NoShowAlreadyExamined);
        }
    }
}

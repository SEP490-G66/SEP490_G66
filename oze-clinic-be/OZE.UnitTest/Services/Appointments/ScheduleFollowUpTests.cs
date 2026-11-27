using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // OZ-APPT-21 ScheduleFollowUp
    [Trait("Tab", "OZ-APPT-21")]
    public class ScheduleFollowUpTests : AppointmentFollowUpTestBase
    {
        [Fact]
        public async Task ScheduleFollowUpAsync_ShouldCreateAppointmentAndLinkToExamination()
        {
            var original = CreateOriginalAppointment();
            var followUpDate = DateOnly.FromDateTime(ClinicClock.Today.AddDays(7));
            var slotStart = new TimeOnly(9, 0);

            _appointmentRepoMock
                .Setup(r => r.GetByIdWithExaminationAsync(OriginalAppointmentId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(original);

            SetupDoctorShift(followUpDate, new TimeOnly(8, 0), new TimeOnly(12, 0));

            Appointment? createdAppointment = null;
            _appointmentRepoMock
                .Setup(r => r.AddAsync(It.IsAny<Appointment>()))
                .Callback<Appointment>(a =>
                {
                    a.Id = 500;
                    createdAppointment = a;
                })
                .Returns(Task.CompletedTask);

            var request = new ScheduleFollowUpRequest
            {
                Date = followUpDate,
                SlotStart = slotStart,
                Notes = "Tái khám theo hẹn"
            };

            var result = await _service.ScheduleFollowUpAsync(OriginalAppointmentId, request, "receptionist-user-1");

            result.Should().NotBeNull();
            createdAppointment.Should().NotBeNull();
            createdAppointment!.ParentAppointmentId.Should().Be(OriginalAppointmentId);
            createdAppointment.AppointmentDate.Should().Be(followUpDate);
            createdAppointment.TimeSlotStart.Should().Be(slotStart);
            createdAppointment.Status.Should().Be(AppointmentConstants.ConfirmedStatus);

            original.Examination!.FollowUpAppointmentId.Should().Be(500);
            original.Examination.FollowUpDate.Should().Be(followUpDate);
            original.Examination.FollowUpNotes.Should().Be("Tái khám theo hẹn");

            _notificationsMock.Verify(n => n.NotifyPatientAsync(original.PatientId,
                It.Is<NotificationContent>(c => c.Title == NotificationConstants.Text.FollowUpScheduledTitle && c.ReferenceId == "500"),
                It.IsAny<CancellationToken>()), Times.Once);

            _auditLogMock.Verify(a => a.LogAsync(
                AuditConstants.AppointmentFollowUpScheduled,
                AuditConstants.AppointmentEntity,
                "500",
                It.IsAny<object?>(),
                It.IsAny<object?>(),
                It.IsAny<string?>()), Times.Once);
        }

        [Fact]
        public async Task ScheduleFollowUpAsync_ShouldThrowBadRequest_WhenDateIsNotAfterOriginal()
        {
            var original = CreateOriginalAppointment();
            _appointmentRepoMock
                .Setup(r => r.GetByIdWithExaminationAsync(OriginalAppointmentId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(original);

            var request = new ScheduleFollowUpRequest
            {
                Date = original.AppointmentDate, // Same day
                SlotStart = new TimeOnly(14, 0)
            };

            var act = () => _service.ScheduleFollowUpAsync(OriginalAppointmentId, request, "staff-1");

            (await act.Should().ThrowAsync<BadRequestException>())
                .WithMessage(ErrorConstants.ExaminationMessage.FollowUpDateMustBeFuture);
        }

        [Fact]
        public async Task ScheduleFollowUpAsync_ShouldThrowBadRequest_WhenAlreadyScheduled()
        {
            var original = CreateOriginalAppointment();
            original.Examination!.FollowUpAppointmentId = 999;

            _appointmentRepoMock
                .Setup(r => r.GetByIdWithExaminationAsync(OriginalAppointmentId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(original);

            var request = new ScheduleFollowUpRequest
            {
                Date = DateOnly.FromDateTime(ClinicClock.Today.AddDays(7)),
                SlotStart = new TimeOnly(9, 0)
            };

            var act = () => _service.ScheduleFollowUpAsync(OriginalAppointmentId, request, "staff-1");

            (await act.Should().ThrowAsync<BadRequestException>())
                .WithMessage(ErrorConstants.AppointmentMessage.FollowUpAlreadyScheduled);
        }

        [Fact]
        public async Task ScheduleFollowUpAsync_ShouldAllowScheduling_WhenCurrentAppointmentIsInService()
        {
            // The appointment is currently IN_SERVICE today (doctor is examining the patient right now)
            var original = CreateOriginalAppointment(status: AppointmentConstants.InServiceStatus);
            var followUpDate = DateOnly.FromDateTime(ClinicClock.Today.AddDays(5));
            var slotStart = new TimeOnly(10, 0);

            _appointmentRepoMock
                .Setup(r => r.GetByIdWithExaminationAsync(OriginalAppointmentId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(original);

            SetupDoctorShift(followUpDate, new TimeOnly(8, 0), new TimeOnly(12, 0));

            // HasUnfinishedAppointmentAsync passes excludeAppointmentId = original.Id, returning false
            _appointmentRepoMock
                .Setup(r => r.HasUnfinishedAppointmentAsync(_patient.Id, OriginalAppointmentId))
                .ReturnsAsync(false);

            Appointment? createdAppointment = null;
            _appointmentRepoMock
                .Setup(r => r.AddAsync(It.IsAny<Appointment>()))
                .Callback<Appointment>(a =>
                {
                    a.Id = 501;
                    createdAppointment = a;
                })
                .Returns(Task.CompletedTask);

            var request = new ScheduleFollowUpRequest
            {
                Date = followUpDate,
                SlotStart = slotStart,
                Notes = "Tái khám sau trám tủy"
            };

            var result = await _service.ScheduleFollowUpAsync(OriginalAppointmentId, request, "doctor-user-1");

            result.Should().NotBeNull();
            createdAppointment.Should().NotBeNull();
            createdAppointment!.ParentAppointmentId.Should().Be(OriginalAppointmentId);
        }

        [Fact]
        public async Task ScheduleFollowUpAsync_ShouldAllowScheduling_WhenPreviousFollowUpWasCancelled()
        {
            var original = CreateOriginalAppointment();
            var cancelledFollowUp = new Appointment
            {
                Id = 999,
                Status = AppointmentConstants.CancelledStatus,
                AppointmentDate = DateOnly.FromDateTime(ClinicClock.Today.AddDays(2))
            };
            original.Examination!.FollowUpAppointmentId = 999;
            original.Examination.FollowUpAppointment = cancelledFollowUp;

            var newFollowUpDate = DateOnly.FromDateTime(ClinicClock.Today.AddDays(8));
            var slotStart = new TimeOnly(10, 0);

            _appointmentRepoMock
                .Setup(r => r.GetByIdWithExaminationAsync(OriginalAppointmentId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(original);

            SetupDoctorShift(newFollowUpDate, new TimeOnly(8, 0), new TimeOnly(12, 0));

            _appointmentRepoMock
                .Setup(r => r.HasUnfinishedAppointmentAsync(_patient.Id, OriginalAppointmentId))
                .ReturnsAsync(false);

            Appointment? createdAppointment = null;
            _appointmentRepoMock
                .Setup(r => r.AddAsync(It.IsAny<Appointment>()))
                .Callback<Appointment>(a =>
                {
                    a.Id = 502;
                    createdAppointment = a;
                })
                .Returns(Task.CompletedTask);

            var request = new ScheduleFollowUpRequest
            {
                Date = newFollowUpDate,
                SlotStart = slotStart,
                Notes = "Đặt lại lịch tái khám sau khi đã hủy lần trước"
            };

            var result = await _service.ScheduleFollowUpAsync(OriginalAppointmentId, request, "receptionist-1");

            result.Should().NotBeNull();
            createdAppointment.Should().NotBeNull();
            original.Examination.FollowUpAppointmentId.Should().Be(502);
            original.Examination.FollowUpDate.Should().Be(newFollowUpDate);
        }

        // UTCID06 (N): a doctor proposes follow-up in their own shift; it stays PENDING for the desk to confirm (no confirmation email)
        [Fact]
        public async Task ScheduleFollowUpByDoctorAsync_ShouldCreatePending_WithoutConfirmationEmail()
        {
            var original = CreateOriginalAppointment(status: AppointmentConstants.InServiceStatus);
            _patient.Email = "patient@example.com";
            var followUpDate = DateOnly.FromDateTime(ClinicClock.Today.AddDays(7));
            var slotStart = new TimeOnly(9, 0);

            _appointmentRepoMock
                .Setup(r => r.GetByIdWithExaminationAsync(OriginalAppointmentId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(original);
            _appointmentRepoMock
                .Setup(r => r.GetStaffProfileIdByUserIdAsync("doctor-user-1"))
                .ReturnsAsync(DoctorId);
            _appointmentRepoMock
                .Setup(r => r.HasUnfinishedAppointmentAsync(_patient.Id, OriginalAppointmentId))
                .ReturnsAsync(false);

            SetupDoctorShift(followUpDate, new TimeOnly(8, 0), new TimeOnly(12, 0));

            Appointment? createdAppointment = null;
            _appointmentRepoMock
                .Setup(r => r.AddAsync(It.IsAny<Appointment>()))
                .Callback<Appointment>(a =>
                {
                    a.Id = 510;
                    createdAppointment = a;
                })
                .Returns(Task.CompletedTask);

            var request = new ScheduleFollowUpRequest
            {
                Date = followUpDate,
                SlotStart = slotStart,
                Notes = "Tai kham sau 1 tuan"
            };

            var result = await _service.ScheduleFollowUpByDoctorAsync(OriginalAppointmentId, request, "doctor-user-1");

            result.Should().NotBeNull();
            createdAppointment.Should().NotBeNull();
            createdAppointment!.Status.Should().Be(AppointmentConstants.PendingStatus);
            createdAppointment.DoctorId.Should().Be(DoctorId);
            createdAppointment.ParentAppointmentId.Should().Be(OriginalAppointmentId);
            _emailSenderMock.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _smsSenderMock.Verify(s => s.SendSmsAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _notificationsMock.Verify(n => n.NotifyPatientAsync(original.PatientId,
                It.Is<NotificationContent>(c => c.Title == NotificationConstants.Text.FollowUpProposedTitle && c.ReferenceId == "510"),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID07 (A): the signed-in account is not linked to a doctor profile
        [Fact]
        public async Task ScheduleFollowUpByDoctorAsync_ShouldThrow_WhenDoctorProfileNotFound()
        {
            var original = CreateOriginalAppointment();
            _appointmentRepoMock
                .Setup(r => r.GetByIdWithExaminationAsync(OriginalAppointmentId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(original);
            _appointmentRepoMock
                .Setup(r => r.GetStaffProfileIdByUserIdAsync("not-a-doctor"))
                .ReturnsAsync((int?)null);

            var request = new ScheduleFollowUpRequest
            {
                Date = DateOnly.FromDateTime(ClinicClock.Today.AddDays(7)),
                SlotStart = new TimeOnly(9, 0)
            };

            var act = () => _service.ScheduleFollowUpByDoctorAsync(OriginalAppointmentId, request, "not-a-doctor");

            (await act.Should().ThrowAsync<ForbiddenException>())
                .WithMessage(ErrorConstants.AppointmentMessage.DoctorProfileNotFound);
        }
    }
}

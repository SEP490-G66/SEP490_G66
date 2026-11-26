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
    // OZ-APPT-13 RescheduleAppointment
    [Trait("Tab", "OZ-APPT-13")]
    public class RescheduleAppointmentTests : AppointmentFollowUpTestBase
    {
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldUpdateFollowUpDate_OnParentExamination()
        {
            var original = CreateOriginalAppointment();
            var oldDate = DateOnly.FromDateTime(ClinicClock.Today.AddDays(5));
            var newDate = DateOnly.FromDateTime(ClinicClock.Today.AddDays(10));
            var newSlotStart = new TimeOnly(9, 0);

            var followUpAppointment = new Appointment
            {
                Id = 888,
                Status = AppointmentConstants.ConfirmedStatus,
                AppointmentDate = oldDate,
                TimeSlotStart = new TimeOnly(8, 0),
                TimeSlotEnd = new TimeOnly(8, 30),
                DoctorId = DoctorId,
                ParentAppointmentId = OriginalAppointmentId,
                ParentAppointment = original,
                ServiceItems = new List<AppointmentServiceItem>
                {
                    new() { Service = _generalExamService, ServiceId = _generalExamService.Id }
                }
            };
            original.Examination!.FollowUpAppointmentId = 888;
            original.Examination.FollowUpDate = oldDate;

            _appointmentRepoMock
                .Setup(r => r.GetByIdWithDetailsAsync(888, It.IsAny<CancellationToken>()))
                .ReturnsAsync(followUpAppointment);

            SetupDoctorShift(newDate, new TimeOnly(8, 0), new TimeOnly(12, 0));

            _appointmentRepoMock
                .Setup(r => r.ExecuteSerializableAsync(It.IsAny<Func<Task<AvailableSlotResponse>>>()))
                .Returns<Func<Task<AvailableSlotResponse>>>(action => action());

            var request = new RescheduleAppointmentRequest
            {
                Date = newDate,
                SlotStart = newSlotStart,
                DoctorId = DoctorId
            };

            var result = await _service.RescheduleAppointmentAsync(888, request, null);

            result.Should().NotBeNull();
            followUpAppointment.AppointmentDate.Should().Be(newDate);
            original.Examination.FollowUpDate.Should().Be(newDate);
        }

        private (Appointment Appointment, DateOnly NewDate) MovableAppointment()
        {
            var newDate = DateOnly.FromDateTime(ClinicClock.Today.AddDays(10));
            var appointment = new Appointment
            {
                Id = 889,
                Status = AppointmentConstants.ConfirmedStatus,
                AppointmentDate = DateOnly.FromDateTime(ClinicClock.Today.AddDays(5)),
                TimeSlotStart = new TimeOnly(8, 0),
                TimeSlotEnd = new TimeOnly(8, 30),
                DoctorId = DoctorId,
                ServiceItems = new List<AppointmentServiceItem>
                {
                    new() { Service = _generalExamService, ServiceId = _generalExamService.Id }
                }
            };
            _appointmentRepoMock
                .Setup(r => r.GetByIdWithDetailsAsync(889, It.IsAny<CancellationToken>()))
                .ReturnsAsync(appointment);
            SetupDoctorShift(newDate, new TimeOnly(8, 0), new TimeOnly(12, 0));
            _appointmentRepoMock
                .Setup(r => r.ExecuteSerializableAsync(It.IsAny<Func<Task<AvailableSlotResponse>>>()))
                .Returns<Func<Task<AvailableSlotResponse>>>(action => action());
            return (appointment, newDate);
        }

        // UTCID02 (N): no services sent keeps the lines of the appointment
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldKeepServices_WhenNoneAreSent()
        {
            var (appointment, newDate) = MovableAppointment();

            await _service.RescheduleAppointmentAsync(889, new RescheduleAppointmentRequest { Date = newDate, SlotStart = new TimeOnly(9, 0), DoctorId = DoctorId }, null);

            _appointmentRepoMock.Verify(r => r.ReplaceServiceItems(It.IsAny<Appointment>(), It.IsAny<IEnumerable<AppointmentServiceItem>>()), Times.Never);
            appointment.ServiceItems.Should().ContainSingle();
        }

        // UTCID03 (N): new services sent replace the lines, the general exam first, with the price of now
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldReplaceServices_WhenNewOnesAreSent()
        {
            var (appointment, newDate) = MovableAppointment();
            var scaling = new Service { Id = 7, ServiceName = "Lay cao rang", ReferencePrice = 300000, EstimatedMinutes = 30, IsActive = true };
            _appointmentRepoMock
                .Setup(r => r.GetServicesByIdsAsync(It.Is<IReadOnlyCollection<int>>(ids => ids.Contains(7))))
                .ReturnsAsync(new List<Service> { scaling });
            List<AppointmentServiceItem>? saved = null;
            _appointmentRepoMock
                .Setup(r => r.ReplaceServiceItems(appointment, It.IsAny<IEnumerable<AppointmentServiceItem>>()))
                .Callback<Appointment, IEnumerable<AppointmentServiceItem>>((_, items) => saved = items.ToList());

            await _service.RescheduleAppointmentAsync(889, new RescheduleAppointmentRequest
            {
                Date = newDate, SlotStart = new TimeOnly(9, 0), DoctorId = DoctorId, ServiceId = new List<int> { 7 }
            }, null);

            saved.Should().NotBeNull();
            saved!.Select(i => i.ServiceId).Should().Equal(_generalExamService.Id, 7);
            saved[1].PriceAtBooking.Should().Be(300000);
        }

        // UTCID05 (A): the patient's treatment plan is being carried out, so a visit outside the plan cannot be moved
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldThrow_WhenTreatmentPlanActive()
        {
            var (_, newDate) = MovableAppointment();
            _appointmentRepoMock.Setup(r => r.HasActiveTreatmentPlanAsync(It.IsAny<int>())).ReturnsAsync(true);

            var act = () => _service.RescheduleAppointmentAsync(889, new RescheduleAppointmentRequest { Date = newDate, SlotStart = new TimeOnly(9, 0), DoctorId = DoctorId }, null);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PatientHasActiveTreatmentPlan);
        }

        // UTCID06 (N): a session of that plan can still be moved
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldMovePlanSession_WhenTreatmentPlanActive()
        {
            var (appointment, newDate) = MovableAppointment();
            appointment.TreatmentPlanStageId = 7;
            _appointmentRepoMock.Setup(r => r.HasActiveTreatmentPlanAsync(It.IsAny<int>())).ReturnsAsync(true);

            await _service.RescheduleAppointmentAsync(889, new RescheduleAppointmentRequest { Date = newDate, SlotStart = new TimeOnly(9, 0), DoctorId = DoctorId }, null);

            appointment.AppointmentDate.Should().Be(newDate);
        }

        // UTCID04 (A): an inactive service cannot be moved into the appointment
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldThrow_WhenNewServiceIsInactive()
        {
            var (_, newDate) = MovableAppointment();
            _appointmentRepoMock
                .Setup(r => r.GetServicesByIdsAsync(It.Is<IReadOnlyCollection<int>>(ids => ids.Contains(7))))
                .ReturnsAsync(new List<Service> { new() { Id = 7, ServiceName = "Cu", IsActive = false } });

            var act = () => _service.RescheduleAppointmentAsync(889, new RescheduleAppointmentRequest
            {
                Date = newDate, SlotStart = new TimeOnly(9, 0), DoctorId = DoctorId, ServiceId = new List<int> { 7 }
            }, null);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ServiceInactive);
        }
    }
}

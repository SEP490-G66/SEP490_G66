using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // OZ-APPT-24 PlanSessionDoctor: a treatment plan session is booked with the doctor chosen for it in the plan
    [Trait("Tab", "OZ-APPT-24")]
    public class PlanSessionDoctorBookingTests : BookingFlowTestBase
    {
        private const long StageId = 301;
        private const int OtherDoctorId = 9;

        private TreatmentPlanStage Stage(int? assignedDoctorId)
        {
            var plan = new TreatmentPlan { Id = 30, PatientId = _patient.Id, CreatedByDoctorId = DoctorId, PlanName = "Boc rang su", Status = TreatmentPlanConstants.Approved };
            var stage = new TreatmentPlanStage
            {
                Id = StageId,
                TreatmentPlanId = plan.Id,
                TreatmentPlan = plan,
                StageNumber = 1,
                StageName = "Mai rang",
                StageStatus = TreatmentPlanConstants.StageStatus.Scheduled,
                AssignedDoctorId = assignedDoctorId
            };
            plan.Stages.Add(stage);
            _appointmentRepoMock.Setup(r => r.GetPatientByIdAsync(_patient.Id)).ReturnsAsync(_patient);
            _appointmentRepoMock.Setup(r => r.GetTreatmentStageAsync(StageId)).ReturnsAsync(stage);
            return stage;
        }

        private ReceptionBookingRequest Request(int? doctorId) =>
            new() { PatientId = _patient.Id, TreatmentPlanStageId = StageId, Date = Tomorrow, SlotStart = new TimeOnly(8, 0), DoctorId = doctorId };

        // UTCID01 (N): no doctor sent, the session's doctor is used
        [Fact]
        public async Task BookByReceptionistAsync_ShouldBookWithSessionDoctor_WhenNoDoctorSent()
        {
            Stage(assignedDoctorId: DoctorId);
            Appointment? saved = null;
            _appointmentRepoMock.Setup(r => r.AddAsync(It.IsAny<Appointment>())).Callback<Appointment>(a => { a.Id = 500; saved = a; }).Returns(Task.CompletedTask);

            await _service.BookByReceptionistAsync(Request(doctorId: null), "receptionist-user");

            saved!.DoctorId.Should().Be(DoctorId);
            saved.TreatmentPlanStageId.Should().Be(StageId);
            _appointmentRepoMock.Verify(r => r.GetDoctorShiftsInRangeAsync(Tomorrow, Tomorrow, DoctorId), Times.AtLeastOnce);
        }

        // UTCID02 (N): a session saved before a doctor could be chosen goes to the planning doctor
        [Fact]
        public async Task BookByReceptionistAsync_ShouldUsePlanningDoctor_WhenSessionHasNoDoctor()
        {
            Stage(assignedDoctorId: null);
            Appointment? saved = null;
            _appointmentRepoMock.Setup(r => r.AddAsync(It.IsAny<Appointment>())).Callback<Appointment>(a => { a.Id = 500; saved = a; }).Returns(Task.CompletedTask);

            await _service.BookByReceptionistAsync(Request(doctorId: null), "receptionist-user");

            saved!.DoctorId.Should().Be(DoctorId);
        }

        // UTCID03 (A): the front desk cannot book the session with another doctor
        [Fact]
        public async Task BookByReceptionistAsync_ShouldThrow_WhenAnotherDoctorSent()
        {
            Stage(assignedDoctorId: DoctorId);

            var act = () => _service.BookByReceptionistAsync(Request(doctorId: OtherDoctorId), "receptionist-user");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.TreatmentStageDoctorMismatch);
            _appointmentRepoMock.Verify(r => r.AddAsync(It.IsAny<Appointment>()), Times.Never);
        }

        // UTCID04 (B): a session given to another doctor is booked with that doctor, not with the planning doctor
        [Fact]
        public async Task BookByReceptionistAsync_ShouldSearchAssignedDoctor_WhenSessionGivenToAnotherDoctor()
        {
            Stage(assignedDoctorId: OtherDoctorId);
            _appointmentRepoMock.Setup(r => r.GetDoctorShiftsInRangeAsync(Tomorrow, Tomorrow, OtherDoctorId)).ReturnsAsync(new List<StaffSchedule>());

            var act = () => _service.BookByReceptionistAsync(Request(doctorId: null), "receptionist-user");

            // The other doctor has no shift that day, so there is no slot, even though the planning doctor is free
            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.SlotNotAvailable);
            _appointmentRepoMock.Verify(r => r.GetDoctorShiftsInRangeAsync(Tomorrow, Tomorrow, OtherDoctorId), Times.AtLeastOnce);
        }
    }

    // OZ-APPT-24 PlanSessionDoctor: moving a session's appointment keeps its doctor
    [Trait("Tab", "OZ-APPT-24")]
    public class PlanSessionDoctorRescheduleTests : AppointmentActionTestBase
    {
        private static DateOnly NewDate => Today.AddDays(10);

        public PlanSessionDoctorRescheduleTests()
        {
            SetupDoctorShift(NewDate, new TimeOnly(8, 0), new TimeOnly(12, 0));
            _appointmentRepoMock.Setup(r => r.ExecuteSerializableAsync(It.IsAny<Func<Task<AvailableSlotResponse>>>()))
                .Returns<Func<Task<AvailableSlotResponse>>>(action => action());
        }

        private Appointment SessionAppointment()
        {
            var appointment = Existing(AppointmentConstants.ConfirmedStatus, Today.AddDays(5));
            var plan = new TreatmentPlan { Id = 30, PatientId = _patient.Id, CreatedByDoctorId = DoctorId, Status = TreatmentPlanConstants.Approved };
            appointment.TreatmentPlanStageId = 301;
            appointment.TreatmentPlanStage = new TreatmentPlanStage { Id = 301, TreatmentPlan = plan, AssignedDoctorId = DoctorId };
            return appointment;
        }

        // UTCID05 (N): no doctor sent, the appointment moves and stays with the session's doctor
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldKeepSessionDoctor_WhenNoDoctorSent()
        {
            var appointment = SessionAppointment();

            await _service.RescheduleAppointmentAsync(Id, new RescheduleAppointmentRequest { Date = NewDate, SlotStart = new TimeOnly(9, 0) }, null);

            appointment.AppointmentDate.Should().Be(NewDate);
            appointment.DoctorId.Should().Be(DoctorId);
        }

        // UTCID06 (A): a session's appointment cannot be moved to another doctor
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldThrow_WhenAnotherDoctorSent()
        {
            SessionAppointment();

            var act = () => _service.RescheduleAppointmentAsync(Id, new RescheduleAppointmentRequest { Date = NewDate, SlotStart = new TimeOnly(9, 0), DoctorId = 9 }, null);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.TreatmentStageDoctorMismatch);
        }
    }
}

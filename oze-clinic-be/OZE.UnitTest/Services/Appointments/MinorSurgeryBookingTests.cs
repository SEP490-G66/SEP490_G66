using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // OZ-APPT-25 MinorSurgeryBooking (R8): the front desk books minor surgery only for a treatment plan session
    [Trait("Tab", "OZ-APPT-25")]
    public class MinorSurgeryBookingTests : BookingFlowTestBase
    {
        private const int SurgeryServiceId = 16;
        private const long StageId = 301;

        private readonly Service _surgery = new()
        {
            Id = SurgeryServiceId,
            ServiceName = "Trong rang Implant",
            IsActive = true,
            EstimatedMinutes = 60,
            RequiredRoomType = RoomTypeConstants.MinorSurgery
        };

        public MinorSurgeryBookingTests()
        {
            _appointmentRepoMock.Setup(r => r.GetServicesByIdsAsync(It.Is<IReadOnlyCollection<int>>(ids => ids.Contains(SurgeryServiceId))))
                .ReturnsAsync(new List<Service> { _surgery });
            _appointmentRepoMock.Setup(r => r.GetPatientByIdAsync(_patient.Id)).ReturnsAsync(_patient);

            // The doctor works the minor surgery room tomorrow 08:00-12:00
            var room = new Room { Id = 9, RoomName = "Phong tieu phau", RoomType = RoomTypeConstants.MinorSurgery };
            _appointmentRepoMock.Setup(r => r.GetDoctorShiftsInRangeAsync(Tomorrow, Tomorrow, DoctorId)).ReturnsAsync(new List<StaffSchedule>
            {
                new()
                {
                    Id = 2, StaffProfileId = DoctorId, ScheduleDate = Tomorrow, ShiftStart = new TimeOnly(8, 0), ShiftEnd = new TimeOnly(12, 0),
                    Room = room, RoomId = room.Id, StaffProfile = new StaffProfile { Id = DoctorId, FullName = "BS. Ngo Van Duc" }
                }
            });
        }

        private ReceptionBookingRequest Request(long? stageId) => new()
        {
            PatientId = _patient.Id,
            TreatmentPlanStageId = stageId,
            ServiceId = new List<int> { SurgeryServiceId },
            Date = Tomorrow,
            SlotStart = new TimeOnly(8, 0),
            DoctorId = DoctorId
        };

        private void SetupStage()
        {
            var plan = new TreatmentPlan { Id = 30, PatientId = _patient.Id, CreatedByDoctorId = DoctorId, Status = TreatmentPlanConstants.Approved };
            var stage = new TreatmentPlanStage
            {
                Id = StageId, TreatmentPlanId = plan.Id, TreatmentPlan = plan, StageNumber = 1, ServiceId = SurgeryServiceId,
                StageStatus = TreatmentPlanConstants.StageStatus.Scheduled, AssignedDoctorId = DoctorId
            };
            plan.Stages.Add(stage);
            _appointmentRepoMock.Setup(r => r.GetTreatmentStageAsync(StageId)).ReturnsAsync(stage);
        }

        // UTCID01 (A): minor surgery picked by the front desk on its own is refused
        [Fact]
        public async Task BookByReceptionistAsync_ShouldThrow_WhenSurgeryWithoutPlanSession()
        {
            var act = () => _service.BookByReceptionistAsync(Request(stageId: null), "receptionist-user");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.MinorSurgeryNeedsPlanSession);
            _appointmentRepoMock.Verify(r => r.AddAsync(It.IsAny<Appointment>()), Times.Never);
        }

        // UTCID02 (N): minor surgery for a treatment plan session is booked in the surgery room
        [Fact]
        public async Task BookByReceptionistAsync_ShouldBook_WhenSurgeryForPlanSession()
        {
            SetupStage();
            Appointment? saved = null;
            _appointmentRepoMock.Setup(r => r.AddAsync(It.IsAny<Appointment>())).Callback<Appointment>(a => { a.Id = 500; saved = a; }).Returns(Task.CompletedTask);

            var result = await _service.BookByReceptionistAsync(Request(StageId), "receptionist-user");

            saved!.TreatmentPlanStageId.Should().Be(StageId);
            result.RequiredRoomType.Should().Be(RoomTypeConstants.MinorSurgery);
            // The general exam (30') and the surgery (60') hold 90 minutes
            saved.TimeSlotEnd.Should().Be(new TimeOnly(9, 30));
        }

        // UTCID03 (N): a general service is still booked without a plan session
        [Fact]
        public async Task BookByReceptionistAsync_ShouldBook_WhenGeneralServiceWithoutPlanSession()
        {
            var request = Request(stageId: null);
            request.ServiceId = new List<int>();
            SetupDoctorShift(Tomorrow, new TimeOnly(8, 0), new TimeOnly(10, 0));

            var result = await _service.BookByReceptionistAsync(request, "receptionist-user");

            result.RequiredRoomType.Should().Be(RoomTypeConstants.GeneralTreatment);
            _appointmentRepoMock.Verify(r => r.AddAsync(It.IsAny<Appointment>()), Times.Once);
        }
    }

    // OZ-APPT-25 MinorSurgeryBooking (R8): staff cannot turn a visit outside the plans into minor surgery when moving it
    [Trait("Tab", "OZ-APPT-25")]
    public class MinorSurgeryRescheduleTests : AppointmentActionTestBase
    {
        // UTCID04 (A): staff move a visit and change its service to minor surgery
        [Fact]
        public async Task RescheduleAppointmentAsync_ShouldThrow_WhenStaffChangeToSurgeryWithoutPlanSession()
        {
            Existing(AppointmentConstants.ConfirmedStatus, Today.AddDays(5));
            var surgery = new Service { Id = 16, ServiceName = "Nho rang khon", IsActive = true, RequiredRoomType = RoomTypeConstants.MinorSurgery };
            _appointmentRepoMock.Setup(r => r.GetServicesByIdsAsync(It.IsAny<IReadOnlyCollection<int>>())).ReturnsAsync(new List<Service> { surgery });

            var act = () => _service.RescheduleAppointmentAsync(Id,
                new RescheduleAppointmentRequest { Date = Today.AddDays(10), SlotStart = new TimeOnly(9, 0), ServiceId = new List<int> { 16 } }, null);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.MinorSurgeryNeedsPlanSession);
        }
    }
}

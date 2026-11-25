using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // OZ-APPT-17 ReassignDoctor: the reason is required, logged and kept (BE-Q2)
    [Trait("Tab", "OZ-APPT-17")]
    public class ReassignDoctorReasonTests : AppointmentActionTestBase
    {
        private const int NewDoctorId = 9;

        public ReassignDoctorReasonTests()
        {
            var room = new Room { Id = 2, RoomName = "Phong kham 2", RoomType = RoomTypeConstants.GeneralTreatment };
            _appointmentRepoMock.Setup(r => r.GetDoctorShiftsInRangeAsync(Today, Today, NewDoctorId)).ReturnsAsync(new List<StaffSchedule>
            {
                new() { Id = 2, StaffProfileId = NewDoctorId, ScheduleDate = Today, ShiftStart = TimeOnly.MinValue, ShiftEnd = TimeOnly.MaxValue,
                    Room = room, RoomId = room.Id, StaffProfile = new StaffProfile { Id = NewDoctorId, FullName = "BS. Tran Van C" } }
            });
        }

        // UTCID06 (A): moving a patient without saying why is refused
        [Fact]
        public async Task ReassignDoctorAsync_ShouldThrow_WhenNoReason()
        {
            var appointment = Existing(AppointmentConstants.CheckedInStatus, Today);

            var act = () => _service.ReassignDoctorAsync(Id, new ReassignDoctorRequest { DoctorId = NewDoctorId, Reason = "  " });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ReassignReasonRequired);
            appointment.DoctorId.Should().Be(DoctorId);
        }

        // UTCID07 (N): the reason goes into the audit log
        [Fact]
        public async Task ReassignDoctorAsync_ShouldLogReason()
        {
            Existing(AppointmentConstants.CheckedInStatus, Today);

            await _service.ReassignDoctorAsync(Id, new ReassignDoctorRequest { DoctorId = NewDoctorId, Reason = " Bac si ban dau nghi dot xuat " });

            _auditLogMock.Verify(a => a.LogAsync(AuditConstants.AppointmentDoctorReassigned, AuditConstants.AppointmentEntity, Id.ToString(),
                It.IsAny<object?>(), It.IsAny<object?>(), "Bac si ban dau nghi dot xuat"), Times.Once);
        }
    }

    // OZ-APPT-15 SetPriority: the reason is saved while above normal (BE-Q8)
    [Trait("Tab", "OZ-APPT-15")]
    public class PriorityReasonTests : AppointmentActionTestBase
    {
        // UTCID05 (N): raising the priority keeps the reason
        [Fact]
        public async Task SetPriorityAsync_ShouldSaveReason()
        {
            var appointment = Existing(AppointmentConstants.CheckedInStatus, Today);

            await _service.SetPriorityAsync(Id, new SetPriorityRequest { Priority = PriorityConstants.High, Reason = "  Nguoi cao tuoi " });

            appointment.PriorityReason.Should().Be("Nguoi cao tuoi");
        }

        // UTCID06 (N): back to normal clears the reason
        [Fact]
        public async Task SetPriorityAsync_ShouldClearReason_WhenBackToNormal()
        {
            var appointment = Existing(AppointmentConstants.CheckedInStatus, Today);
            appointment.Priority = PriorityConstants.High;
            appointment.PriorityReason = "Nguoi cao tuoi";

            await _service.SetPriorityAsync(Id, new SetPriorityRequest { Priority = PriorityConstants.Normal, Reason = "Da het uu tien" });

            appointment.PriorityReason.Should().BeNull();
        }

        // UTCID07 (N): the waiting list shows the reason, phone, allergies and missed calls to the desk (BE-Q3)
        [Fact]
        public async Task GetWaitingListAsync_ShouldReturnReasonPhoneAllergiesAndSkips()
        {
            _appointmentRepoMock.Setup(r => r.GetConfigValueAsync(ConfigKeyConstants.CheckInLateMinutes)).ReturnsAsync("15");
            _patient.MedicalProfiles = new List<PatientMedicalProfile>
            {
                new() { RecordType = PatientConstants.MedicalProfile.AllergyType, Status = PatientConstants.MedicalProfile.ActiveStatus, Title = "Penicillin" },
                new() { RecordType = PatientConstants.MedicalProfile.AllergyType, Status = "Resolved", Title = "Latex" }
            };
            var waiting = new Appointment
            {
                Id = Id,
                PatientId = _patient.Id,
                Patient = _patient,
                DoctorId = DoctorId,
                AppointmentType = AppointmentConstants.WalkInType,
                AppointmentDate = Today,
                Status = AppointmentConstants.CheckedInStatus,
                CheckInAt = DateTimeOffset.UtcNow,
                Priority = PriorityConstants.High,
                PriorityReason = "Dang dau nhieu",
                QueueEntries = new List<QueueEntry>
                {
                    new() { QueueType = QueueConstants.ExaminationType, Status = QueueConstants.Waiting, SkipCount = 2, CreatedAt = DateTimeOffset.UtcNow }
                }
            };
            _appointmentRepoMock.Setup(r => r.GetWaitingAppointmentsAsync(It.IsAny<DateOnly>(), null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<Appointment> { waiting });

            var result = await _service.GetWaitingListAsync(null, null);

            result.Should().ContainSingle();
            result[0].PriorityReason.Should().Be("Dang dau nhieu");
            result[0].PatientPhoneNumber.Should().Be(_patient.PhoneNumber);
            result[0].PatientAllergies.Should().Equal("Penicillin");
            result[0].SkipCount.Should().Be(2);
        }
    }

    // OZ-Q-01 GetQueue: the priority reason is for staff only (BE-Q8)
    [Trait("Tab", "OZ-Q-01")]
    public class QueuePriorityReasonTests
    {
        private readonly Mock<IQueueRepository> _queueRepo = new();
        private readonly QueueService _service;

        public QueuePriorityReasonTests()
        {
            _service = new QueueService(_queueRepo.Object, new Mock<ILogger<QueueService>>().Object);
            _queueRepo.Setup(r => r.GetActiveEntriesAsync(It.IsAny<string?>(), It.IsAny<int?>(), null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<QueueEntry>
                {
                    new()
                    {
                        Id = 1, AppointmentId = 1, QueueType = QueueConstants.ImagingType, QueueNumber = 1, Status = QueueConstants.Waiting, Priority = 1,
                        Appointment = new Appointment { Id = 1, PriorityReason = "Phu nu mang thai", Patient = new Patient { FullName = "Nguyen Thi B" } }
                    }
                });
        }

        // UTCID04 (N): staff see why the patient goes first
        [Fact]
        public async Task GetQueueEntriesAsync_ShouldShowReason_ForStaff()
        {
            var result = await _service.GetQueueEntriesAsync(QueueConstants.ImagingType, null, includePatientDetails: true);

            result[0].PriorityReason.Should().Be("Phu nu mang thai");
        }

        // UTCID05 (N): the public board shows only that someone is prioritized, never why
        [Fact]
        public async Task GetQueueEntriesAsync_ShouldHideReason_ForPublicBoard()
        {
            var result = await _service.GetQueueEntriesAsync(QueueConstants.ImagingType, null, includePatientDetails: false);

            result[0].Priority.Should().Be(1);
            result[0].PriorityReason.Should().BeNull();
        }
    }
}

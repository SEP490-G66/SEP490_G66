using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // OZ-APPT-ReferMinorSurgery: "Chỉ định chuyển phòng · tiểu phẫu" — the doctor hands the visit to the minor surgery room
    [Trait("Tab", "OZ-APPT-REFER")]
    public class ReferMinorSurgeryTests : AppointmentQueueTestBase
    {
        private const long Id = 77;
        private const int SurgeonId = 5;
        private readonly Appointment _appointment;
        private readonly Examination _examination;
        private readonly Room _surgeryRoom = new() { Id = 2, RoomName = "Phong tieu phau", RoomType = RoomTypeConstants.MinorSurgery };

        public ReferMinorSurgeryTests()
        {
            _examination = new Examination { Id = 50, AppointmentId = Id, DoctorId = DoctorId, ExaminationStatus = ExaminationConstants.InProgress };
            _appointment = new Appointment
            {
                Id = Id,
                DoctorId = DoctorId,
                Doctor = new StaffProfile { Id = DoctorId, FullName = "BS. Le Thu Ha" },
                PatientId = 3,
                Patient = new Patient { Id = 3, FullName = "Bui Anh Khoa" },
                AppointmentDate = Today,
                Status = AppointmentConstants.InServiceStatus,
                Examination = _examination
            };
            _appointmentRepoMock.Setup(r => r.GetByIdWithExaminationAsync(Id, It.IsAny<CancellationToken>())).ReturnsAsync(_appointment);
            Shift(SurgeonId, _surgeryRoom, started: true);
            Shift(DoctorId, new Room { Id = 3, RoomName = "Phong kham 2", RoomType = RoomTypeConstants.GeneralTreatment }, started: true);
        }

        private void Shift(int doctorId, Room room, bool started) =>
            _appointmentRepoMock.Setup(r => r.GetDoctorShiftsInRangeAsync(Today, Today, doctorId)).ReturnsAsync(new List<StaffSchedule>
            {
                new()
                {
                    Id = doctorId, StaffProfileId = doctorId, ScheduleDate = Today, ShiftStart = TimeOnly.MinValue, ShiftEnd = TimeOnly.MaxValue,
                    ActualStartTime = started ? new TimeOnly(7, 55) : null, Room = room, RoomId = room.Id,
                    StaffProfile = new StaffProfile { Id = doctorId, FullName = "BS. Ngo Van Duc" }
                }
            });

        private static ReferMinorSurgeryRequest Request(int surgeonId = SurgeonId) => new() { SurgeryDoctorId = surgeonId, Note = "Nho rang 38" };

        // UTCID01 (N): the visit and the patient go to the surgery doctor, waiting there with a note of where they come from
        [Fact]
        public async Task ReferToMinorSurgeryAsync_ShouldHandVisitToSurgeryDoctor()
        {
            string? note = null;
            _queueServiceMock
                .Setup(q => q.TransferAsync(Id, QueueConstants.ExaminationType, _surgeryRoom.Id, SurgeonId, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .Callback<long, string, int?, int, string?, CancellationToken>((_, _, _, _, n, _) => note = n)
                .ReturnsAsync(new QueueEntry { Id = 1, AppointmentId = Id, QueueNumber = 8 });

            var result = await _service.ReferToMinorSurgeryAsync(Id, Request(), DoctorUserId);

            _appointment.DoctorId.Should().Be(SurgeonId);
            _examination.DoctorId.Should().Be(SurgeonId);
            _appointment.Status.Should().Be(AppointmentConstants.CheckedInStatus);
            note.Should().Be("Chuyển từ Phong kham 2 · BS. Le Thu Ha · Nho rang 38");
            result.RoomName.Should().Be("Phong tieu phau");
            result.QueueNumber.Should().Be(8);
        }

        // UTCID02 (A): only the doctor of the visit can refer the patient
        [Fact]
        public async Task ReferToMinorSurgeryAsync_ShouldThrow_WhenNotTheDoctorOfTheVisit()
        {
            _appointment.DoctorId = 11;

            var act = () => _service.ReferToMinorSurgeryAsync(Id, Request(), DoctorUserId);

            (await act.Should().ThrowAsync<ForbiddenException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.NotAssignedDoctor);
        }

        // UTCID03 (A): a patient not being examined (still waiting) is not referred from here
        [Fact]
        public async Task ReferToMinorSurgeryAsync_ShouldThrow_WhenNotInExamination()
        {
            _appointment.Status = AppointmentConstants.CheckedInStatus;

            var act = () => _service.ReferToMinorSurgeryAsync(Id, Request(), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ReferOnlyInExamination);
        }

        // UTCID04 (A): a patient waiting for an X-ray is referred after the film is done
        [Fact]
        public async Task ReferToMinorSurgeryAsync_ShouldThrow_WhenWaitingForImaging()
        {
            _queueServiceMock.Setup(q => q.GetActiveEntryAsync(Id, QueueConstants.ImagingType, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new QueueEntry { Id = 2, AppointmentId = Id, QueueType = QueueConstants.ImagingType });

            var act = () => _service.ReferToMinorSurgeryAsync(Id, Request(), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ReferWhileImaging);
        }

        // UTCID05 (A): the chosen doctor works in an examination room today, not the minor surgery room
        [Fact]
        public async Task ReferToMinorSurgeryAsync_ShouldThrow_WhenDoctorHasNoSurgeryShift()
        {
            Shift(SurgeonId, new Room { Id = 1, RoomName = "Phong kham", RoomType = RoomTypeConstants.GeneralTreatment }, started: true);

            var act = () => _service.ReferToMinorSurgeryAsync(Id, Request(), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ReferNoSurgeryShift);
        }

        // UTCID06 (A): the surgery doctor has not started the shift
        [Fact]
        public async Task ReferToMinorSurgeryAsync_ShouldThrow_WhenSurgeonNotOnDuty()
        {
            _queueServiceMock.Setup(q => q.IsDoctorOffDutyAsync(SurgeonId, It.IsAny<CancellationToken>())).ReturnsAsync(true);

            var act = () => _service.ReferToMinorSurgeryAsync(Id, Request(), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ReferSurgeonNotOnDuty);
        }

        // UTCID07 (B): referring to oneself
        [Fact]
        public async Task ReferToMinorSurgeryAsync_ShouldThrow_WhenSameDoctor()
        {
            var act = () => _service.ReferToMinorSurgeryAsync(Id, Request(DoctorId), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ReferSameDoctor);
        }
    }
}

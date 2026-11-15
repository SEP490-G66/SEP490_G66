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
    // OZ-APPT-17 ReassignDoctor
    [Trait("Tab", "OZ-APPT-17")]
    public class ReassignDoctorTests : AppointmentActionTestBase
    {
        private const int NewDoctorId = 9;

        public ReassignDoctorTests()
        {
            var room = new Room { Id = 2, RoomName = "Phong kham 2", RoomType = RoomTypeConstants.GeneralTreatment };
            _appointmentRepoMock.Setup(r => r.GetDoctorShiftsAsync(Today, NewDoctorId)).ReturnsAsync(new List<StaffSchedule>
            {
                new() { Id = 2, StaffProfileId = NewDoctorId, ScheduleDate = Today, ShiftStart = TimeOnly.MinValue, ShiftEnd = TimeOnly.MaxValue,
                    Room = room, RoomId = room.Id, StaffProfile = new StaffProfile { Id = NewDoctorId, FullName = "BS. Tran Van C" } }
            });
            _appointmentRepoMock.Setup(r => r.GetDoctorShiftsAsync(Today, 11)).ReturnsAsync(new List<StaffSchedule>());
            _appointmentRepoMock.Setup(r => r.HasEndedShiftAsync(11, Today)).ReturnsAsync(false);
        }

        private static ReassignDoctorRequest To(int doctorId) => new() { DoctorId = doctorId };

        // UTCID01 (N): a waiting patient moves to another doctor who has a shift now, into that doctor's room
        [Fact]
        public async Task ReassignDoctorAsync_ShouldMovePatientToNewDoctorRoom()
        {
            var appointment = Existing(AppointmentConstants.CheckedInStatus, Today);

            var result = await _service.ReassignDoctorAsync(Id, To(NewDoctorId));

            appointment.DoctorId.Should().Be(NewDoctorId);
            result.DoctorName.Should().Be("BS. Tran Van C");
            result.RoomName.Should().Be("Phong kham 2");
        }

        // UTCID02 (A): only a patient who is checked in and waiting
        [Fact]
        public async Task ReassignDoctorAsync_ShouldThrow_WhenNotWaiting()
        {
            Existing(AppointmentConstants.ConfirmedStatus, Today);

            var act = () => _service.ReassignDoctorAsync(Id, To(NewDoctorId));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ReassignOnlyWaiting);
        }

        // UTCID03 (A): a patient already seen stays with that doctor
        [Fact]
        public async Task ReassignDoctorAsync_ShouldThrow_WhenAlreadyExamined()
        {
            Existing(AppointmentConstants.CheckedInStatus, Today, examination: new Examination { Id = 50 });

            var act = () => _service.ReassignDoctorAsync(Id, To(NewDoctorId));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ReassignAlreadyExamined);
        }

        // UTCID04 (B): moving to the same doctor
        [Fact]
        public async Task ReassignDoctorAsync_ShouldThrow_WhenSameDoctor()
        {
            Existing(AppointmentConstants.CheckedInStatus, Today);

            var act = () => _service.ReassignDoctorAsync(Id, To(DoctorId));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ReassignSameDoctor);
        }

        // UTCID05 (A): the new doctor has no shift today
        [Fact]
        public async Task ReassignDoctorAsync_ShouldThrow_WhenNewDoctorHasNoShift()
        {
            Existing(AppointmentConstants.CheckedInStatus, Today);

            var act = () => _service.ReassignDoctorAsync(Id, To(11));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.DoctorNoSuitableShiftToday);
        }
    }

    // OZ-Q-01 GetQueue
    [Trait("Tab", "OZ-Q-01")]
    public class GetQueueTests
    {
        private readonly Mock<IQueueRepository> _queueRepo = new();
        private readonly QueueService _service;

        public GetQueueTests()
        {
            _service = new QueueService(_queueRepo.Object, new Mock<ILogger<QueueService>>().Object);
        }

        private void Entries(params QueueEntry[] entries) =>
            _queueRepo.Setup(r => r.GetActiveEntriesAsync(It.IsAny<string?>(), It.IsAny<int?>(), null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(entries.ToList());

        private static QueueEntry Entry(long id, string name) => new()
        {
            Id = id,
            AppointmentId = id,
            QueueType = QueueConstants.ImagingType,
            QueueNumber = (int)id,
            Status = QueueConstants.Waiting,
            Appointment = new Appointment { Id = id, Patient = new Patient { FullName = name, PatientCode = "BN" + id } }
        };

        // UTCID01 (N): staff see the full name and patient code
        [Fact]
        public async Task GetQueueEntriesAsync_ShouldShowFullDetails_ForStaff()
        {
            Entries(Entry(1, "Nguyen Van An"));

            var result = await _service.GetQueueEntriesAsync(QueueConstants.ImagingType, null, includePatientDetails: true);

            result.Should().ContainSingle();
            result[0].PatientName.Should().Be("Nguyen Van An");
            result[0].PatientCode.Should().Be("BN1");
        }

        // UTCID02 (N): the public board hides the full name and the code
        [Fact]
        public async Task GetQueueEntriesAsync_ShouldMaskPatient_ForPublicBoard()
        {
            Entries(Entry(1, "Nguyen Van An"));

            var result = await _service.GetQueueEntriesAsync(QueueConstants.ImagingType, null, includePatientDetails: false);

            result[0].PatientName.Should().NotBe("Nguyen Van An");
            result[0].PatientCode.Should().BeEmpty();
        }

        // UTCID03 (B): nobody is waiting
        [Fact]
        public async Task GetQueueEntriesAsync_ShouldReturnEmpty_WhenNobodyWaiting()
        {
            Entries();

            var result = await _service.GetQueueEntriesAsync(QueueConstants.ImagingType, null);

            result.Should().BeEmpty();
        }
    }
}

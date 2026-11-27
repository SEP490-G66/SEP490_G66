using FluentAssertions;
using Moq;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.UnitTest.Services.AppointmentChangeRequests
{
    public class AppointmentChangeRequestServiceTests
    {
        private const string PatientUserId = "patient-user";
        private const string StaffUserId = "receptionist-user";
        private const int PatientId = 7;

        private readonly Mock<IAppointmentChangeRequestRepository> _repository = new();
        private readonly Mock<IPatientRepository> _patientRepository = new();
        private readonly Mock<INotificationService> _notifications = new();
        private readonly AppointmentChangeRequestService _service;
        private readonly Patient _patient = new() { Id = PatientId, UserId = PatientUserId, FullName = "Nguyễn Văn A" };

        public AppointmentChangeRequestServiceTests()
        {
            _service = new AppointmentChangeRequestService(_repository.Object, _patientRepository.Object, _notifications.Object);
            _patientRepository.Setup(r => r.GetByUserIdAsync(PatientUserId)).ReturnsAsync(_patient);
        }

        private Appointment Appointment(long id = 50, string? createdBy = "receptionist", string status = AppointmentConstants.ConfirmedStatus, long? stageId = null, long? parentId = 40) => new()
        {
            Id = id,
            PatientId = PatientId,
            Patient = _patient,
            Status = status,
            CreatedByUserId = createdBy,
            TreatmentPlanStageId = stageId,
            ParentAppointmentId = parentId,
            AppointmentDate = new DateOnly(2026, 12, 10),
            TimeSlotStart = new TimeOnly(14, 0)
        };

        private static TreatmentPlanStage Stage(long id = 9, int patientId = PatientId, string status = TreatmentPlanConstants.StageStatus.Scheduled)
        {
            var plan = new TreatmentPlan { Id = 3, PatientId = patientId, PlanName = "Điều trị tủy và bọc sứ răng 46" };
            var stages = new[]
            {
                new TreatmentPlanStage { Id = 7, StageNumber = 1, StageStatus = TreatmentPlanConstants.StageStatus.Completed, TreatmentPlan = plan },
                new TreatmentPlanStage { Id = 8, StageNumber = 2, StageStatus = TreatmentPlanConstants.StageStatus.Completed, TreatmentPlan = plan },
                new TreatmentPlanStage { Id = id, StageNumber = 3, StageName = "Bọc mão sứ răng 46", StageStatus = status, TreatmentPlan = plan, ScheduledDate = new DateOnly(2026, 12, 3) }
            };
            foreach (var stage in stages) plan.Stages.Add(stage);
            return stages[2];
        }

        private static CreateAppointmentChangeRequest Request(long? appointmentId = 50, long? stageId = null, string type = AppointmentChangeRequestConstants.Type.Reschedule) => new()
        {
            AppointmentId = appointmentId,
            TreatmentPlanStageId = stageId,
            Type = type,
            Reason = " Bận việc ",
            PreferredTimes = new List<string> { "07/12 · Sáng", " ", "08/12 · Chiều" },
            Note = " Gọi sau 17h "
        };

        [Fact]
        public async Task CreateAsync_ShouldSaveARequestForAVisitTheClinicArranged_AndTellTheFrontDesk()
        {
            _repository.Setup(r => r.GetAppointmentAsync(50, It.IsAny<CancellationToken>())).ReturnsAsync(Appointment());
            AppointmentChangeRequest? saved = null;
            _repository.Setup(r => r.Add(It.IsAny<AppointmentChangeRequest>())).Callback<AppointmentChangeRequest>(r => saved = r);

            var result = await _service.CreateAsync(PatientUserId, Request());

            saved!.Status.Should().Be(AppointmentChangeRequestConstants.Status.Pending);
            saved.Reason.Should().Be("Bận việc");
            saved.Note.Should().Be("Gọi sau 17h");
            saved.PreferredTimes.Should().Be("07/12 · Sáng\n08/12 · Chiều");
            result.PreferredTimes.Should().Equal("07/12 · Sáng", "08/12 · Chiều");
            result.IsFollowUp.Should().BeTrue();
            _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
            _notifications.Verify(n => n.NotifyRolesAsync(It.Is<IReadOnlyCollection<string>>(roles => roles.Contains(RoleConstants.ReceptionistRole)),
                It.Is<NotificationContent>(c => c.Title == NotificationConstants.Text.ChangeRequestedTitle), null, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task CreateAsync_ShouldRefuseAnAppointmentThePatientBookedThemselves()
        {
            _repository.Setup(r => r.GetAppointmentAsync(50, It.IsAny<CancellationToken>())).ReturnsAsync(Appointment(createdBy: PatientUserId, parentId: null));

            var act = () => _service.CreateAsync(PatientUserId, Request());

            (await act.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.AppointmentChangeRequestMessage.BookedByPatient);
            _repository.Verify(r => r.Add(It.IsAny<AppointmentChangeRequest>()), Times.Never);
        }

        [Fact]
        public async Task CreateAsync_ShouldAcceptASessionWithNoAppointment_AndDropPreferredTimesWhenCancelling()
        {
            _repository.Setup(r => r.GetStageAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(Stage());
            AppointmentChangeRequest? saved = null;
            _repository.Setup(r => r.Add(It.IsAny<AppointmentChangeRequest>())).Callback<AppointmentChangeRequest>(r => saved = r);

            var result = await _service.CreateAsync(PatientUserId, Request(null, 9, AppointmentChangeRequestConstants.Type.Cancel));

            saved!.TreatmentPlanStageId.Should().Be(9);
            saved.PreferredTimes.Should().BeNull();
            result.StageNumber.Should().Be(3);
            result.TotalStages.Should().Be(3);
            result.VisitTitle.Should().Be("Bọc mão sứ răng 46");
            result.VisitDate.Should().Be(new DateOnly(2026, 12, 3));
        }

        [Fact]
        public async Task CreateAsync_ShouldRefuseASecondOpenRequestForTheSameVisit()
        {
            _repository.Setup(r => r.GetAppointmentAsync(50, It.IsAny<CancellationToken>())).ReturnsAsync(Appointment());
            _repository.Setup(r => r.HasPendingAsync(50, null, It.IsAny<CancellationToken>())).ReturnsAsync(true);

            var act = () => _service.CreateAsync(PatientUserId, Request());

            (await act.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.AppointmentChangeRequestMessage.AlreadyRequested);
        }

        [Fact]
        public async Task CreateAsync_ShouldRefuseAnotherPatientsVisitOrAClosedOne()
        {
            _repository.Setup(r => r.GetStageAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(Stage(patientId: 99));
            _repository.Setup(r => r.GetAppointmentAsync(51, It.IsAny<CancellationToken>())).ReturnsAsync(Appointment(51, status: AppointmentConstants.CompletedStatus));

            var other = () => _service.CreateAsync(PatientUserId, Request(null, 9));
            var closed = () => _service.CreateAsync(PatientUserId, Request(51));

            await other.Should().ThrowAsync<NotFoundException>();
            (await closed.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.AppointmentChangeRequestMessage.VisitNotOpen);
        }

        [Theory]
        [InlineData(null, null, "Reschedule", "Bận", ErrorConstants.AppointmentChangeRequestMessage.TargetRequired)]
        [InlineData(50L, 9L, "Reschedule", "Bận", ErrorConstants.AppointmentChangeRequestMessage.TargetRequired)]
        [InlineData(50L, null, "Move", "Bận", ErrorConstants.AppointmentChangeRequestMessage.TypeInvalid)]
        [InlineData(50L, null, "Cancel", "  ", ErrorConstants.AppointmentChangeRequestMessage.ReasonRequired)]
        public async Task CreateAsync_ShouldCheckTheForm(long? appointmentId, long? stageId, string type, string reason, string message)
        {
            var act = () => _service.CreateAsync(PatientUserId, new CreateAppointmentChangeRequest { AppointmentId = appointmentId, TreatmentPlanStageId = stageId, Type = type, Reason = reason });

            (await act.Should().ThrowAsync<BadRequestException>()).WithMessage(message);
        }

        [Fact]
        public async Task CreateAsync_ShouldRefuseMoreThanThreePreferredTimes()
        {
            var request = Request();
            request.PreferredTimes = new List<string> { "a", "b", "c", "d" };

            var act = () => _service.CreateAsync(PatientUserId, request);

            (await act.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.AppointmentChangeRequestMessage.PreferredTimesInvalid);
        }

        [Fact]
        public async Task WithdrawAsync_ShouldCloseOnlyTheirOwnPendingRequest()
        {
            var mine = new AppointmentChangeRequest { Id = 1, PatientId = PatientId, Patient = _patient, Status = AppointmentChangeRequestConstants.Status.Pending, RequestType = "Cancel" };
            var handled = new AppointmentChangeRequest { Id = 2, PatientId = PatientId, Patient = _patient, Status = AppointmentChangeRequestConstants.Status.Kept, RequestType = "Cancel" };
            _repository.Setup(r => r.GetTrackedAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(mine);
            _repository.Setup(r => r.GetTrackedAsync(2, It.IsAny<CancellationToken>())).ReturnsAsync(handled);

            var result = await _service.WithdrawAsync(PatientUserId, 1);
            var someoneElse = () => _service.WithdrawAsync("other-user", 1);
            var tooLate = () => _service.WithdrawAsync(PatientUserId, 2);

            result.Status.Should().Be(AppointmentChangeRequestConstants.Status.Withdrawn);
            await someoneElse.Should().ThrowAsync<NotFoundException>();
            (await tooLate.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.AppointmentChangeRequestMessage.NotPending);
        }

        [Fact]
        public async Task ResolveAsync_ShouldRecordWhatTheFrontDeskDid_AndTellThePatient()
        {
            var request = new AppointmentChangeRequest { Id = 4, PatientId = PatientId, Patient = _patient, Status = AppointmentChangeRequestConstants.Status.Pending, RequestType = "Reschedule", TreatmentPlanStage = Stage() };
            _repository.Setup(r => r.GetTrackedAsync(4, It.IsAny<CancellationToken>())).ReturnsAsync(request);

            var result = await _service.ResolveAsync(StaffUserId, 4, new ResolveAppointmentChangeRequest { Outcome = "Rescheduled", Note = " Đã đổi sang 07/12 09:00 " });

            result.Status.Should().Be(AppointmentChangeRequestConstants.Status.Rescheduled);
            request.HandledByUserId.Should().Be(StaffUserId);
            request.HandlerNote.Should().Be("Đã đổi sang 07/12 09:00");
            _notifications.Verify(n => n.NotifyPatientAsync(PatientId,
                It.Is<NotificationContent>(c => c.Title == NotificationConstants.Text.ChangeRequestHandledTitle && c.Message.Contains("đã đổi lịch")), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ResolveAsync_ShouldRefuseAnUnknownOutcome()
        {
            var act = () => _service.ResolveAsync(StaffUserId, 4, new ResolveAppointmentChangeRequest { Outcome = "Withdrawn" });

            (await act.Should().ThrowAsync<BadRequestException>()).WithMessage(ErrorConstants.AppointmentChangeRequestMessage.OutcomeInvalid);
        }

        [Theory]
        [InlineData("patient-user", null, null, true)]
        [InlineData("receptionist", null, null, false)]
        [InlineData(null, null, null, true)]
        [InlineData(null, 9L, null, false)]
        [InlineData(null, null, 40L, false)]
        public void IsBookedByPatient_ShouldFollowWhoArrangedIt(string? createdBy, long? stageId, long? parentId, bool expected)
        {
            var appointment = new Appointment { Patient = new Patient { UserId = "patient-user" }, CreatedByUserId = createdBy, TreatmentPlanStageId = stageId, ParentAppointmentId = parentId };

            AppointmentOwnershipHelper.IsBookedByPatient(appointment).Should().Be(expected);
        }
    }
}

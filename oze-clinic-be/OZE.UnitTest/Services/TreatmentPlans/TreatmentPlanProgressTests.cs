using FluentAssertions;
using Moq;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.TreatmentPlans
{
    // Plan 30 of patient 3 made by doctor 5 ("doctor-user"): stage 301 then stage 302
    public abstract class TreatmentPlanTestBase
    {
        protected const string DoctorUserId = "doctor-user";
        protected const long PlanId = 30;
        protected readonly Mock<ITreatmentPlanRepository> _planRepo = new();
        protected readonly Mock<IStaffRepository> _staffRepo = new();
        protected readonly Mock<IMedicalRecordRepository> _medicalRecordRepo = new();
        protected readonly Mock<IServiceRepository> _serviceRepo = new();
        protected readonly TreatmentPlanService _service;
        protected readonly TreatmentPlan _plan;
        protected readonly TreatmentPlanStage _stage1;
        protected readonly TreatmentPlanStage _stage2;
        protected static readonly DateOnly Today = DateOnly.FromDateTime(ClinicClock.Now);

        protected TreatmentPlanTestBase()
        {
            _service = new TreatmentPlanService(_planRepo.Object, _staffRepo.Object, _medicalRecordRepo.Object, _serviceRepo.Object);
            _staffRepo.Setup(r => r.GetByUserIdAsync(DoctorUserId)).ReturnsAsync(new StaffProfile { Id = 5, UserId = DoctorUserId });
            _stage1 = new TreatmentPlanStage { Id = 301, StageNumber = 1, StageName = "Lay tuy", EstimatedCost = 1000000, StageStatus = TreatmentPlanConstants.StageStatus.Scheduled };
            _stage2 = new TreatmentPlanStage { Id = 302, StageNumber = 2, StageName = "Boc su", EstimatedCost = 2000000, StageStatus = TreatmentPlanConstants.StageStatus.Scheduled };
            _plan = new TreatmentPlan { Id = PlanId, PatientId = 3, CreatedByDoctorId = 5, PlanName = "Dieu tri tuy rang 36", Status = TreatmentPlanConstants.Approved };
            _plan.Stages.Add(_stage1);
            _plan.Stages.Add(_stage2);
            _planRepo.Setup(r => r.GetByIdWithStagesAsync(PlanId, It.IsAny<CancellationToken>())).ReturnsAsync(_plan);
            _planRepo.Setup(r => r.GetTrackedByIdWithStagesAsync(PlanId, It.IsAny<CancellationToken>())).ReturnsAsync(_plan);
        }

        protected void InProgress(TreatmentPlanStage stage)
        {
            _plan.Status = TreatmentPlanConstants.InProgress;
            stage.StageStatus = TreatmentPlanConstants.StageStatus.InProgress;
        }
    }

    // OZ-TP-01 GetTpProgress
    [Trait("Tab", "OZ-TP-01")]
    public class GetTpProgressTests : TreatmentPlanTestBase
    {
        // UTCID01 (N): one of two stages done gives 50% with the next stage shown
        [Fact]
        public async Task GetProgressAsync_ShouldReturnProgress()
        {
            _stage1.StageStatus = TreatmentPlanConstants.StageStatus.Completed;
            _stage1.ActualCost = 1200000;

            var result = await _service.GetProgressAsync(PlanId, DoctorUserId);

            result.CompletedStages.Should().Be(1);
            result.ProgressPercent.Should().Be(50m);
            result.CompletedCost.Should().Be(1200000);
            result.NextStage!.Id.Should().Be(302);
        }

        // UTCID02 (B): cancelled stages are not counted
        [Fact]
        public async Task GetProgressAsync_ShouldIgnoreCancelledStages()
        {
            _stage1.StageStatus = TreatmentPlanConstants.StageStatus.Completed;
            _stage2.StageStatus = TreatmentPlanConstants.StageStatus.Cancelled;

            var result = await _service.GetProgressAsync(PlanId, DoctorUserId);

            result.ProgressPercent.Should().Be(100m);
            result.NextStage.Should().BeNull();
        }

        // UTCID03 (A): the plan does not exist
        [Fact]
        public async Task GetProgressAsync_ShouldThrow_WhenPlanNotFound()
        {
            var act = () => _service.GetProgressAsync(99, DoctorUserId);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.PlanNotFound);
        }

        // UTCID04 (A): the user has no doctor profile
        [Fact]
        public async Task GetProgressAsync_ShouldThrow_WhenDoctorNotFound()
        {
            var act = () => _service.GetProgressAsync(PlanId, "unknown-user");

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.DoctorScheduleMessage.DoctorNotFound);
        }

        // UTCID05 (A): a doctor who did not make the plan and never treated the patient
        [Fact]
        public async Task GetProgressAsync_ShouldThrow_WhenNoAccess()
        {
            _plan.CreatedByDoctorId = 8;

            var act = () => _service.GetProgressAsync(PlanId, DoctorUserId);

            (await act.Should().ThrowAsync<ForbiddenException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.NoAccess);
        }
    }

    // OZ-TP-02 StartTpStage
    [Trait("Tab", "OZ-TP-02")]
    public class StartTpStageTests : TreatmentPlanTestBase
    {
        // UTCID01 (N): the first stage of an approved plan starts and the plan is in progress
        [Fact]
        public async Task StartStageAsync_ShouldStartFirstStage()
        {
            var result = await _service.StartStageAsync(PlanId, 301, DoctorUserId);

            _stage1.StageStatus.Should().Be(TreatmentPlanConstants.StageStatus.InProgress);
            _plan.Status.Should().Be(TreatmentPlanConstants.InProgress);
            result.NextStage!.Id.Should().Be(301);
        }

        // UTCID02 (B): a stage after a cancelled one can start
        [Fact]
        public async Task StartStageAsync_ShouldStart_WhenEarlierStageCancelled()
        {
            _stage1.StageStatus = TreatmentPlanConstants.StageStatus.Cancelled;

            await _service.StartStageAsync(PlanId, 302, DoctorUserId);

            _stage2.StageStatus.Should().Be(TreatmentPlanConstants.StageStatus.InProgress);
        }

        // UTCID03 (A): the plan is not approved yet
        [Fact]
        public async Task StartStageAsync_ShouldThrow_WhenPlanNotApproved()
        {
            _plan.Status = TreatmentPlanConstants.Draft;

            var act = () => _service.StartStageAsync(PlanId, 301, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.PlanNotApproved);
        }

        // UTCID04 (A): the stage is already done
        [Fact]
        public async Task StartStageAsync_ShouldThrow_WhenStageNotScheduled()
        {
            _stage1.StageStatus = TreatmentPlanConstants.StageStatus.Completed;

            var act = () => _service.StartStageAsync(PlanId, 301, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.StageNotScheduled);
        }

        // UTCID05 (A): stage 2 before stage 1 is done
        [Fact]
        public async Task StartStageAsync_ShouldThrow_WhenEarlierStageOpen()
        {
            var act = () => _service.StartStageAsync(PlanId, 302, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.EarlierStageNotCompleted);
        }

        // UTCID06 (A): the stage is not in this plan
        [Fact]
        public async Task StartStageAsync_ShouldThrow_WhenStageNotFound()
        {
            var act = () => _service.StartStageAsync(PlanId, 999, DoctorUserId);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.StageNotFound);
        }
    }

    // OZ-TP-03 UpdateTpStage
    [Trait("Tab", "OZ-TP-03")]
    public class UpdateTpStageTests : TreatmentPlanTestBase
    {
        public UpdateTpStageTests() => InProgress(_stage1);

        // UTCID01 (N): a different actual cost is saved with its note
        [Fact]
        public async Task UpdateStageAsync_ShouldSaveCostAndNote()
        {
            await _service.UpdateStageAsync(PlanId, 301, new UpdateTreatmentStageRequest { ActualCost = 1200000, Notes = " Them 1 ong tuy " }, DoctorUserId);

            _stage1.ActualCost.Should().Be(1200000);
            _stage1.Notes.Should().Be("Them 1 ong tuy");
        }

        // UTCID02 (N): the date of the next stage is booked
        [Fact]
        public async Task UpdateStageAsync_ShouldScheduleNextStage()
        {
            await _service.UpdateStageAsync(PlanId, 301, new UpdateTreatmentStageRequest { NextStageScheduledDate = Today.AddDays(7) }, DoctorUserId);

            _stage2.ScheduledDate.Should().Be(Today.AddDays(7));
        }

        // UTCID03 (A): the stage has not started
        [Fact]
        public async Task UpdateStageAsync_ShouldThrow_WhenStageNotInProgress()
        {
            var act = () => _service.UpdateStageAsync(PlanId, 302, new UpdateTreatmentStageRequest { Notes = "x" }, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.StageNotInProgress);
        }

        // UTCID04 (B): a negative actual cost
        [Fact]
        public async Task UpdateStageAsync_ShouldThrow_WhenCostNegative()
        {
            var act = () => _service.UpdateStageAsync(PlanId, 301, new UpdateTreatmentStageRequest { ActualCost = -1, Notes = "x" }, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.InvalidActualCost);
        }

        // UTCID05 (A): a different cost without a note
        [Fact]
        public async Task UpdateStageAsync_ShouldThrow_WhenCostDiffersWithoutNote()
        {
            var act = () => _service.UpdateStageAsync(PlanId, 301, new UpdateTreatmentStageRequest { ActualCost = 1200000 }, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.NotesRequiredWhenCostDiffers);
        }

        // UTCID06 (B): the next stage date is yesterday
        [Fact]
        public async Task UpdateStageAsync_ShouldThrow_WhenNextDateInPast()
        {
            var act = () => _service.UpdateStageAsync(PlanId, 301, new UpdateTreatmentStageRequest { NextStageScheduledDate = Today.AddDays(-1) }, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.ScheduledDateInvalid);
        }

        // UTCID07 (A): there is no later stage to book
        [Fact]
        public async Task UpdateStageAsync_ShouldThrow_WhenNoNextStage()
        {
            _stage2.StageStatus = TreatmentPlanConstants.StageStatus.Cancelled;

            var act = () => _service.UpdateStageAsync(PlanId, 301, new UpdateTreatmentStageRequest { NextStageScheduledDate = Today.AddDays(7) }, DoctorUserId);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.NextStageNotFound);
        }
    }

    // OZ-TP-04 CompleteTpStage
    [Trait("Tab", "OZ-TP-04")]
    public class CompleteTpStageTests : TreatmentPlanTestBase
    {
        // UTCID01 (N): the stage is done by this doctor, the plan goes on
        [Fact]
        public async Task CompleteStageAsync_ShouldCompleteStage()
        {
            InProgress(_stage1);

            var result = await _service.CompleteStageAsync(PlanId, 301, null, DoctorUserId);

            _stage1.StageStatus.Should().Be(TreatmentPlanConstants.StageStatus.Completed);
            _stage1.PerformedByDoctorId.Should().Be(5);
            _stage1.ActualDate.Should().Be(Today);
            _plan.Status.Should().Be(TreatmentPlanConstants.InProgress);
            result.ProgressPercent.Should().Be(50m);
        }

        // UTCID02 (N): finishing the last stage completes the plan
        [Fact]
        public async Task CompleteStageAsync_ShouldCompletePlan_WhenLastStage()
        {
            _stage1.StageStatus = TreatmentPlanConstants.StageStatus.Completed;
            InProgress(_stage2);

            await _service.CompleteStageAsync(PlanId, 302, new CompleteTreatmentStageRequest { ActualCost = 2500000, Notes = "Doi loai su" }, DoctorUserId);

            _plan.Status.Should().Be(TreatmentPlanConstants.Completed);
            _stage2.ActualCost.Should().Be(2500000);
        }

        // UTCID03 (A): the plan is not in progress
        [Fact]
        public async Task CompleteStageAsync_ShouldThrow_WhenPlanNotInProgress()
        {
            var act = () => _service.CompleteStageAsync(PlanId, 301, null, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.PlanNotInProgress);
        }

        // UTCID04 (A): the stage has not started
        [Fact]
        public async Task CompleteStageAsync_ShouldThrow_WhenStageNotInProgress()
        {
            InProgress(_stage1);

            var act = () => _service.CompleteStageAsync(PlanId, 302, null, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.StageNotInProgress);
        }

        // UTCID05 (B): a negative actual cost
        [Fact]
        public async Task CompleteStageAsync_ShouldThrow_WhenCostNegative()
        {
            InProgress(_stage1);

            var act = () => _service.CompleteStageAsync(PlanId, 301, new CompleteTreatmentStageRequest { ActualCost = -1 }, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.InvalidActualCost);
        }

        // UTCID06 (A): a different cost without a note
        [Fact]
        public async Task CompleteStageAsync_ShouldThrow_WhenCostDiffersWithoutNote()
        {
            InProgress(_stage1);

            var act = () => _service.CompleteStageAsync(PlanId, 301, new CompleteTreatmentStageRequest { ActualCost = 1200000, Notes = "  " }, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.NotesRequiredWhenCostDiffers);
        }
    }

    // OZ-TP-05 CreateTreatmentPlan
    [Trait("Tab", "OZ-TP-05")]
    public class CreateTreatmentPlanTests : TreatmentPlanTestBase
    {
        private const long ExaminationId = 200;
        private readonly Examination _exam = new() { Id = ExaminationId, DoctorId = 5, PatientId = 3, ExaminationStatus = ExaminationConstants.InProgress };
        private TreatmentPlan? _saved;

        public CreateTreatmentPlanTests()
        {
            _planRepo.Setup(r => r.GetExaminationAsync(ExaminationId, It.IsAny<CancellationToken>())).ReturnsAsync(_exam);
            _serviceRepo.Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<Service>
            {
                new() { Id = 4, ServiceName = "Cao voi", ReferencePrice = 300000, IsActive = true },
                new() { Id = 5, ServiceName = "Tram rang", ReferencePrice = 500000, IsActive = true },
                new() { Id = 6, ServiceName = "Tay trang", ReferencePrice = 1500000, IsActive = false }
            });
            _planRepo.Setup(r => r.AddAsync(It.IsAny<TreatmentPlan>(), It.IsAny<CancellationToken>()))
                .Callback<TreatmentPlan, CancellationToken>((p, _) => _saved = p);
            _planRepo.Setup(r => r.GetByIdWithStagesAsync(0, It.IsAny<CancellationToken>())).ReturnsAsync(() => _saved);
        }

        private static CreateTreatmentPlanRequest Plan(params CreateTreatmentPlanStageRequest[] stages) => new()
        {
            PlanName = " Dieu tri nha chu ",
            Stages = stages.ToList()
        };

        private static CreateTreatmentPlanStageRequest Stage(int serviceId, decimal? cost = null, DateOnly? date = null) => new()
        {
            ServiceId = serviceId,
            EstimatedCost = cost,
            ScheduledDate = date
        };

        // UTCID01 (N): a draft plan with two stages; a cost left out takes the price list
        [Fact]
        public async Task CreateAsync_ShouldCreateDraftPlan()
        {
            var result = await _service.CreateAsync(ExaminationId, Plan(Stage(4), Stage(5, 450000, Today.AddDays(7))), DoctorUserId);

            result.Status.Should().Be(TreatmentPlanConstants.Draft);
            result.PlanName.Should().Be("Dieu tri nha chu");
            result.TotalStages.Should().Be(2);
            result.EstimatedTotalCost.Should().Be(750000);
            result.Stages[0].StageName.Should().Be("Cao voi");
            result.Stages[0].EstimatedCost.Should().Be(300000);
        }

        // UTCID02 (A): the examination does not exist
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenExaminationNotFound()
        {
            var act = () => _service.CreateAsync(999, Plan(Stage(4)), DoctorUserId);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.MedicalRecordMessage.ExaminationNotFound);
        }

        // UTCID03 (A): another doctor's examination
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenNotExaminingDoctor()
        {
            _exam.DoctorId = 8;

            var act = () => _service.CreateAsync(ExaminationId, Plan(Stage(4)), DoctorUserId);

            (await act.Should().ThrowAsync<ForbiddenException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.NotExaminingDoctor);
        }

        // UTCID04 (A): the examination is locked
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenExaminationLocked()
        {
            _exam.ExaminationStatus = ExaminationConstants.Locked;

            var act = () => _service.CreateAsync(ExaminationId, Plan(Stage(4)), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AlreadyLocked);
        }

        // UTCID05 (A): the examination already has an open plan
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenOpenPlanExists()
        {
            _planRepo.Setup(r => r.HasOpenPlanAsync(ExaminationId, It.IsAny<CancellationToken>())).ReturnsAsync(true);

            var act = () => _service.CreateAsync(ExaminationId, Plan(Stage(4)), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.OpenPlanExists);
        }

        // UTCID06 (B): no stage
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenNoStage()
        {
            var act = () => _service.CreateAsync(ExaminationId, Plan(), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.StagesRequired);
        }

        // UTCID07 (A): a service that does not exist
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenServiceNotFound()
        {
            var act = () => _service.CreateAsync(ExaminationId, Plan(Stage(77)), DoctorUserId);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ServiceNotFound);
        }

        // UTCID08 (A): a service no longer offered
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenServiceInactive()
        {
            var act = () => _service.CreateAsync(ExaminationId, Plan(Stage(6)), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ServiceInactive);
        }

        // UTCID09 (B): a negative estimated cost
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenCostNegative()
        {
            var act = () => _service.CreateAsync(ExaminationId, Plan(Stage(4, -1)), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.InvalidEstimatedCost);
        }

        // UTCID10 (B): a later stage dated before the earlier one
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenDatesGoBack()
        {
            var act = () => _service.CreateAsync(ExaminationId, Plan(Stage(4, null, Today.AddDays(7)), Stage(5, null, Today.AddDays(6))), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.ScheduledDateInvalid);
        }
    }
}

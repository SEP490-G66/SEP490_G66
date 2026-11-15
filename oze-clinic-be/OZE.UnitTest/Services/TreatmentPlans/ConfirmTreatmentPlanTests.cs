using FluentAssertions;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using Xunit;

namespace OZE.UnitTest.Services.TreatmentPlans
{
    // OZ-TP-06 ConfirmTreatmentPlan (propose to the patient, then approve)
    [Trait("Tab", "OZ-TP-06")]
    public class ConfirmTreatmentPlanTests : TreatmentPlanTestBase
    {
        public ConfirmTreatmentPlanTests() => _plan.Status = TreatmentPlanConstants.Draft;

        // UTCID01 (N): the doctor proposes a draft plan to the patient
        [Fact]
        public async Task ProposeAsync_ShouldProposeDraft()
        {
            var result = await _service.ProposeAsync(PlanId, DoctorUserId);

            result.Status.Should().Be(TreatmentPlanConstants.Proposed);
        }

        // UTCID02 (N): the patient agrees and the staff approve the proposed plan
        [Fact]
        public async Task ApproveAsync_ShouldApproveProposed()
        {
            _plan.Status = TreatmentPlanConstants.Proposed;

            var result = await _service.ApproveAsync(PlanId, "receptionist-user", canViewAll: true);

            result.Status.Should().Be(TreatmentPlanConstants.Approved);
            _plan.ApprovedAt.Should().NotBeNull();
        }

        // UTCID03 (A): only a draft can be proposed
        [Fact]
        public async Task ProposeAsync_ShouldThrow_WhenNotDraft()
        {
            _plan.Status = TreatmentPlanConstants.Approved;

            var act = () => _service.ProposeAsync(PlanId, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.OnlyDraftCanBeProposed);
        }

        // UTCID04 (B): a draft with no stage cannot be proposed
        [Fact]
        public async Task ProposeAsync_ShouldThrow_WhenNoStage()
        {
            _plan.Stages.Clear();

            var act = () => _service.ProposeAsync(PlanId, DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.StagesRequired);
        }

        // UTCID05 (A): only a proposed plan can be approved
        [Fact]
        public async Task ApproveAsync_ShouldThrow_WhenNotProposed()
        {
            var act = () => _service.ApproveAsync(PlanId, "receptionist-user", canViewAll: true);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.OnlyProposedCanBeApproved);
        }

        // UTCID06 (A): the plan does not exist
        [Fact]
        public async Task ProposeAsync_ShouldThrow_WhenPlanNotFound()
        {
            var act = () => _service.ProposeAsync(99, DoctorUserId);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.PlanNotFound);
        }

        // UTCID07 (A): a doctor with no access to the patient
        [Fact]
        public async Task ProposeAsync_ShouldThrow_WhenNoAccess()
        {
            _plan.CreatedByDoctorId = 8;

            var act = () => _service.ProposeAsync(PlanId, DoctorUserId);

            (await act.Should().ThrowAsync<ForbiddenException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.NoAccess);
        }
    }
}

using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.TreatmentPlans
{
    // OZ-TP-07 VersionTreatmentPlan — CreateNewVersionAsync
    [Trait("Tab", "OZ-TP-07")]
    public class VersionTreatmentPlanTests : TreatmentPlanTestBase
    {
        private const int ServiceId = 4;
        private TreatmentPlan? _added;

        public VersionTreatmentPlanTests()
        {
            _plan.PlanVersion = 1;
            _plan.Status = TreatmentPlanConstants.Approved;
            _serviceRepo.Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<Service>
                {
                    new() { Id = ServiceId, ServiceName = "Cao voi", ReferencePrice = 300000m, IsActive = true }
                });
            _planRepo.Setup(r => r.AddAsync(It.IsAny<TreatmentPlan>(), It.IsAny<CancellationToken>()))
                .Callback<TreatmentPlan, CancellationToken>((p, _) =>
                {
                    p.Id = 31;
                    _added = p;
                })
                .Returns(Task.CompletedTask);
            _planRepo.Setup(r => r.GetByIdWithStagesAsync(31, It.IsAny<CancellationToken>()))
                .ReturnsAsync(() => _added);
            _planRepo.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        }

        private static UpdateTreatmentPlanRequest VersionRequest() => new()
        {
            PlanName = " Dieu tri nha chu v2 ",
            Description = "  cap nhat ",
            Stages = new List<UpdateTreatmentPlanStageRequest>
            {
                new() { ServiceId = ServiceId, EstimatedCost = 350000m }
            }
        };

        // UTCID01 (N): approved plan → old superseded, new Proposed with version+1
        [Fact]
        public async Task CreateNewVersionAsync_ShouldCreateProposedPlan_WhenApproved()
        {
            var result = await _service.CreateNewVersionAsync(PlanId, VersionRequest(), DoctorUserId);

            _plan.Status.Should().Be(TreatmentPlanConstants.Superseded);
            result.Status.Should().Be(TreatmentPlanConstants.Proposed);
            result.PlanName.Should().Be("Dieu tri nha chu v2");
            _added.Should().NotBeNull();
            _added!.PlanVersion.Should().Be(2);
            _added.Stages.Should().ContainSingle();
            _added.Stages.First().EstimatedCost.Should().Be(350000m);
            _planRepo.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (N): draft plan can also get a new version
        [Fact]
        public async Task CreateNewVersionAsync_ShouldSucceed_WhenDraft()
        {
            _plan.Status = TreatmentPlanConstants.Draft;

            var result = await _service.CreateNewVersionAsync(PlanId, VersionRequest(), DoctorUserId);

            _plan.Status.Should().Be(TreatmentPlanConstants.Superseded);
            result.Status.Should().Be(TreatmentPlanConstants.Proposed);
            _added!.PlanVersion.Should().Be(2);
        }

        // UTCID03 (A): plan not found
        [Fact]
        public async Task CreateNewVersionAsync_ShouldThrow_WhenPlanNotFound()
        {
            var act = () => _service.CreateNewVersionAsync(99, VersionRequest(), DoctorUserId);

            (await act.Should().ThrowAsync<NotFoundException>())
                .Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.PlanNotFound);
        }

        // UTCID04 (A): completed plan cannot get a new version
        [Fact]
        public async Task CreateNewVersionAsync_ShouldThrow_WhenCompleted()
        {
            _plan.Status = TreatmentPlanConstants.Completed;

            var act = () => _service.CreateNewVersionAsync(PlanId, VersionRequest(), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>())
                .Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.CannotCreateNewVersion);
            _planRepo.Verify(r => r.AddAsync(It.IsAny<TreatmentPlan>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID05 (A): doctor without access
        [Fact]
        public async Task CreateNewVersionAsync_ShouldThrow_WhenNoAccess()
        {
            _plan.CreatedByDoctorId = 9;
            _medicalRecordRepo.Setup(r => r.HasDoctorAccessAsync(5, _plan.PatientId)).ReturnsAsync(false);

            var act = () => _service.CreateNewVersionAsync(PlanId, VersionRequest(), DoctorUserId);

            (await act.Should().ThrowAsync<ForbiddenException>())
                .Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.NoAccess);
        }
    }
}

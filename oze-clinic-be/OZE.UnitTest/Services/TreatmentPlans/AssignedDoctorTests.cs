using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.TreatmentPlans
{
    // OZ-TP-07 AssignedDoctor: each session has the doctor who is to do it (the planning doctor by default)
    [Trait("Tab", "OZ-TP-07")]
    public class AssignedDoctorTests : TreatmentPlanTestBase
    {
        private const int ServiceId = 12;
        private const int SurgeonId = 7;

        public AssignedDoctorTests()
        {
            _plan.Status = TreatmentPlanConstants.Draft;
            _plan.CreatedByDoctor = new StaffProfile { Id = 5, FullName = "BS. Le Thu Ha" };
            _stage1.ServiceId = ServiceId;
            _stage2.ServiceId = ServiceId;
            _planRepo.Setup(r => r.IsInvoicedAsync(PlanId, It.IsAny<CancellationToken>())).ReturnsAsync(false);
            _serviceRepo.Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<Service> { new() { Id = ServiceId, ServiceName = "Nho rang khon", IsActive = true, ReferencePrice = 500000, RequiredRoomType = RoomTypeConstants.MinorSurgery } });
        }

        private static UpdateTreatmentPlanRequest Request(int? firstDoctorId, int? secondDoctorId) => new()
        {
            PlanName = "Dieu tri",
            Stages = new List<UpdateTreatmentPlanStageRequest>
            {
                new() { Id = 301, ServiceId = ServiceId, AssignedDoctorId = firstDoctorId },
                new() { Id = 302, ServiceId = ServiceId, AssignedDoctorId = secondDoctorId }
            }
        };

        // UTCID01 (N): a session with no doctor chosen is done by the planning doctor
        [Fact]
        public async Task UpdateAsync_ShouldAssignPlanningDoctor_WhenNoneChosen()
        {
            var result = await _service.UpdateAsync(PlanId, Request(null, null), DoctorUserId);

            _stage1.AssignedDoctorId.Should().Be(5);
            _stage2.AssignedDoctorId.Should().Be(5);
            result.Stages.Should().OnlyContain(s => s.AssignedDoctorId == 5 && s.AssignedDoctorName == "BS. Le Thu Ha");
        }

        // UTCID02 (N): one session is given to another active doctor
        [Fact]
        public async Task UpdateAsync_ShouldKeepChosenDoctor_WhenDoctorIsActive()
        {
            _planRepo.Setup(r => r.GetActiveDoctorIdsAsync(It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<int> { SurgeonId });

            await _service.UpdateAsync(PlanId, Request(null, SurgeonId), DoctorUserId);

            _stage1.AssignedDoctorId.Should().Be(5);
            _stage2.AssignedDoctorId.Should().Be(SurgeonId);
        }

        // UTCID03 (A): the chosen doctor is not an active doctor
        [Fact]
        public async Task UpdateAsync_ShouldThrow_WhenChosenDoctorNotActive()
        {
            _planRepo.Setup(r => r.GetActiveDoctorIdsAsync(It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<int>());

            var act = () => _service.UpdateAsync(PlanId, Request(SurgeonId, null), DoctorUserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.TreatmentPlanMessage.AssignedDoctorInvalid);
        }

        // UTCID04 (B): a session saved before a doctor could be chosen shows the planning doctor
        [Fact]
        public async Task GetDetailAsync_ShouldFallBackToPlanningDoctor_WhenSessionHasNoDoctor()
        {
            var result = await _service.GetDetailAsync(PlanId, "receptionist-user", canViewAll: true);

            result.Stages.Should().OnlyContain(s => s.AssignedDoctorId == 5 && s.AssignedDoctorName == "BS. Le Thu Ha");
        }

        // UTCID05 (N): doctors are suggested by the room type the service needs
        [Fact]
        public async Task GetDoctorOptionsAsync_ShouldUseServiceRoomType()
        {
            _planRepo.Setup(r => r.GetDoctorOptionsAsync(It.IsAny<string>(), It.IsAny<DateOnly>(), It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<PlanDoctorOptionResponse>());

            await _service.GetDoctorOptionsAsync(ServiceId);

            _planRepo.Verify(r => r.GetDoctorOptionsAsync(RoomTypeConstants.MinorSurgery, It.IsAny<DateOnly>(), It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID06 (B): no service given, general treatment rooms are used
        [Fact]
        public async Task GetDoctorOptionsAsync_ShouldUseGeneralRooms_WhenNoService()
        {
            _planRepo.Setup(r => r.GetDoctorOptionsAsync(It.IsAny<string>(), It.IsAny<DateOnly>(), It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<PlanDoctorOptionResponse>());

            await _service.GetDoctorOptionsAsync(null);

            _planRepo.Verify(r => r.GetDoctorOptionsAsync(RoomTypeConstants.GeneralTreatment, It.IsAny<DateOnly>(), It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID07 (A): an unknown service
        [Fact]
        public async Task GetDoctorOptionsAsync_ShouldThrow_WhenServiceNotFound()
        {
            _serviceRepo.Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<Service>());

            var act = () => _service.GetDoctorOptionsAsync(999);

            await act.Should().ThrowAsync<NotFoundException>();
        }
    }
}

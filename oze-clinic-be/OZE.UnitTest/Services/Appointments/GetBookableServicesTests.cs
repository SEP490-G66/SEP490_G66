using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // OZ-APPT-01 GetBookableServices
    [Trait("Tab", "OZ-APPT-01")]
    public class GetBookableServicesTests : AppointmentFollowUpTestBase
    {
        // UTCID01 (N): open services with their variants; the general exam is marked mandatory
        [Fact]
        public async Task GetBookableServicesAsync_ShouldReturnServicesAndMarkGeneralExam()
        {
            var braces = new Service { Id = 7, ServiceCode = "NIENG", ServiceName = "Nieng rang", ReferencePrice = 1000, IsActive = true };
            braces.Variants = new List<ServiceVariant> { new() { Id = 71, ServiceId = 7, VariantName = "Mac cai su", ReferencePrice = 2000, IsActive = true } };
            _appointmentRepoMock.Setup(r => r.GetBookableServicesAsync()).ReturnsAsync(new List<Service> { _generalExamService, braces });

            var result = await _service.GetBookableServicesAsync();

            result.Should().HaveCount(2);
            result.Single(x => x.ServiceId == _generalExamService.Id).IsMandatory.Should().BeTrue();
            var nieng = result.Single(x => x.ServiceId == 7);
            nieng.IsMandatory.Should().BeFalse();
            nieng.Variants.Should().ContainSingle(v => v.VariantId == 71 && v.ReferencePrice == 2000);
        }

        // UTCID02 (B): no open service
        [Fact]
        public async Task GetBookableServicesAsync_ShouldReturnEmpty_WhenNoService()
        {
            _appointmentRepoMock.Setup(r => r.GetBookableServicesAsync()).ReturnsAsync(new List<Service>());

            var result = await _service.GetBookableServicesAsync();

            result.Should().BeEmpty();
        }

        // UTCID03 (A): the general exam code is not configured
        [Fact]
        public async Task GetBookableServicesAsync_ShouldThrow_WhenGeneralExamConfigMissing()
        {
            _appointmentRepoMock.Setup(r => r.GetConfigValueAsync(ConfigKeyConstants.GeneralExamServiceCode)).ReturnsAsync((string?)null);

            var act = () => _service.GetBookableServicesAsync();

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should()
                .Be(string.Format(ErrorConstants.AppointmentMessage.ConfigMissing, ConfigKeyConstants.GeneralExamServiceCode));
        }
    }
}

using FluentAssertions;
using Moq;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.ClinicServices
{
    // The manager's list gets the variants with the page (no call per service), and the next free code in one call
    public class ServiceListVariantsTests : ClinicServiceTestBase
    {
        private void SetupPage(ServiceQueryParameters parameters, params Service[] services) =>
            _serviceRepositoryMock
                .Setup(r => r.GetAllAsync(parameters, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PagedResult<Service>(services.ToList(), services.Length, 1, 10));

        [Fact]
        public async Task GetServicesAsync_ShouldAttachVariantsInDisplayOrder_WhenAsked()
        {
            var parameters = new ServiceQueryParameters { PageNumber = 1, PageSize = 10, IncludeVariants = true };
            var service = new Service
            {
                Id = 1,
                ServiceCode = "DV001",
                ServiceName = "Niềng răng",
                Variants = new List<ServiceVariant>
                {
                    new() { Id = 12, ServiceId = 1, VariantName = "Mắc cài sứ", DisplayOrder = 2, IsActive = false },
                    new() { Id = 11, ServiceId = 1, VariantName = "Mắc cài kim loại", DisplayOrder = 1, IsActive = true }
                }
            };
            SetupPage(parameters, service, new Service { Id = 2, ServiceCode = "DV002", ServiceName = "Trám răng" });

            var result = await _service.GetServicesAsync(parameters);

            result.Data!.Items[0].Variants!.Select(v => v.Id).Should().Equal(11, 12);
            result.Data.Items[1].Variants.Should().NotBeNull().And.BeEmpty();
        }

        [Fact]
        public async Task GetServicesAsync_ShouldLeaveVariantsOut_ByDefault()
        {
            var parameters = new ServiceQueryParameters { PageNumber = 1, PageSize = 10 };
            SetupPage(parameters, new Service { Id = 1, ServiceCode = "DV001", ServiceName = "Niềng răng", Variants = new List<ServiceVariant> { new() { Id = 11 } } });

            var result = await _service.GetServicesAsync(parameters);

            result.Data!.Items[0].Variants.Should().BeNull();
        }

        [Fact]
        public async Task GetNextServiceCodeAsync_ShouldFollowTheHighestDvCode()
        {
            _serviceRepositoryMock
                .Setup(r => r.GetServiceCodesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<string> { "DV001", "dv012", "KHAM-TQ", "DV7", "DVX" });

            var result = await _service.GetNextServiceCodeAsync();

            result.Data.Should().Be("DV013");
        }

        [Fact]
        public async Task GetNextServiceCodeAsync_ShouldStartAtDv001()
        {
            _serviceRepositoryMock
                .Setup(r => r.GetServiceCodesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<string> { "KHAM-TQ" });

            var result = await _service.GetNextServiceCodeAsync();

            result.Data.Should().Be("DV001");
        }
    }
}

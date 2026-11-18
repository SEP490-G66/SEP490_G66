using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using Xunit;

namespace OZE.UnitTest.IntegrationTests.ServiceCatalog
{
    public class GetServiceQueryIntegrationTests : ServiceCatalogIntegrationTestBase
    {
        [Fact]
        public async Task SCIT15_GetServices_WithDefaultPagination_ShouldReturnPagedResult()
        {
            // Arrange: Seed 15 services
            for (int i = 1; i <= 15; i++)
            {
                await SeedServiceAsync(code: $"SRV{i:D3}", name: $"Dịch vụ {i:D2}", price: i * 100000m);
            }

            var query = new ServiceQueryParameters
            {
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var actionResult = await Controller.GetServicesAsync(query, CancellationToken.None);

            // Assert
            var okResult = actionResult.Result as OkObjectResult;
            okResult.Should().NotBeNull();
            okResult!.StatusCode.Should().Be(200);

            var response = okResult.Value as ApiResponse<PagedResult<ServiceDto>>;
            response.Should().NotBeNull();
            response!.Success.Should().BeTrue();
            response.Data!.Items.Should().HaveCount(10);
            response.Data.TotalCount.Should().Be(15);
            response.Data.PageNumber.Should().Be(1);
            response.Data.PageSize.Should().Be(10);
            response.Data.TotalPages.Should().Be(2);
            response.Data.HasNextPage.Should().BeTrue();
            response.Data.HasPreviousPage.Should().BeFalse();
        }

        [Theory]
        [InlineData("composite", 1)] // Matches by Name
        [InlineData("XRAY", 1)]      // Matches by Code
        [InlineData("KhôngTồnTại", 0)]
        public async Task SCIT16_17_SearchServices_ByKeyword_ShouldFilterByCodeOrName(string keyword, int expectedCount)
        {
            // Arrange
            await SeedServiceAsync(code: "TRN01", name: "Trám răng composite", price: 300000m);
            await SeedServiceAsync(code: "XRAY01", name: "Chụp phim Panorama", price: 200000m);
            await SeedServiceAsync(code: "CAORANG", name: "Lấy cao răng", price: 150000m);

            var query = new ServiceQueryParameters { SearchKeyword = keyword };

            // Act
            var actionResult = await Controller.GetServicesAsync(query, CancellationToken.None);

            // Assert
            var okResult = actionResult.Result as OkObjectResult;
            var response = okResult!.Value as ApiResponse<PagedResult<ServiceDto>>;
            response!.Data!.Items.Should().HaveCount(expectedCount);
        }

        [Fact]
        public async Task SCIT18_19_FilterServices_ByStatus_ShouldReturnMatchingServices()
        {
            // Arrange
            await SeedServiceAsync(code: "ACT01", name: "Dịch vụ đang bật 1", isActive: true);
            await SeedServiceAsync(code: "ACT02", name: "Dịch vụ đang bật 2", isActive: true);
            await SeedServiceAsync(code: "INA01", name: "Dịch vụ đã tắt", isActive: false);

            // Act: Filter Active
            var activeQuery = new ServiceQueryParameters { IsActive = true };
            var activeResult = await Controller.GetServicesAsync(activeQuery, CancellationToken.None);
            var activeResponse = (activeResult.Result as OkObjectResult)!.Value as ApiResponse<PagedResult<ServiceDto>>;
            activeResponse!.Data!.Items.Should().HaveCount(2);
            activeResponse.Data.Items.Should().OnlyContain(s => s.IsActive);

            // Act: Filter Inactive
            var inactiveQuery = new ServiceQueryParameters { IsActive = false };
            var inactiveResult = await Controller.GetServicesAsync(inactiveQuery, CancellationToken.None);
            var inactiveResponse = (inactiveResult.Result as OkObjectResult)!.Value as ApiResponse<PagedResult<ServiceDto>>;
            inactiveResponse!.Data!.Items.Should().HaveCount(1);
            inactiveResponse.Data.Items.Should().OnlyContain(s => !s.IsActive);
        }

        [Fact]
        public async Task SCIT20_FilterServices_ByRequiredRoomType_ShouldReturnOnlySpecifiedRoom()
        {
            // Arrange
            await SeedServiceAsync(code: "GEN01", name: "Dịch vụ khám chung", requiredRoomType: "GeneralTreatment");
            await SeedServiceAsync(code: "SUR01", name: "Dịch vụ tiểu phẫu", requiredRoomType: "MinorSurgery");
            await SeedServiceAsync(code: "XR01", name: "Dịch vụ chụp X-quang", requiredRoomType: "XRay");

            var query = new ServiceQueryParameters { RequiredRoomType = "GeneralTreatment" };

            // Act
            var actionResult = await Controller.GetServicesAsync(query, CancellationToken.None);

            // Assert
            var response = ((actionResult.Result as OkObjectResult)!.Value as ApiResponse<PagedResult<ServiceDto>>)!;
            response.Data!.Items.Should().HaveCount(1);
            response.Data.Items.First().ServiceCode.Should().Be("GEN01");
        }

        [Fact]
        public async Task SCIT21_FilterServices_ByPriceRange_ShouldReturnServicesWithinMinAndMax()
        {
            // Arrange
            await SeedServiceAsync(code: "P100", name: "Dịch vụ 100k", price: 100000m);
            await SeedServiceAsync(code: "P300", name: "Dịch vụ 300k", price: 300000m);
            await SeedServiceAsync(code: "P500", name: "Dịch vụ 500k", price: 500000m);
            await SeedServiceAsync(code: "P800", name: "Dịch vụ 800k", price: 800000m);

            var query = new ServiceQueryParameters
            {
                MinPrice = 200000m,
                MaxPrice = 600000m
            };

            // Act
            var actionResult = await Controller.GetServicesAsync(query, CancellationToken.None);

            // Assert
            var response = ((actionResult.Result as OkObjectResult)!.Value as ApiResponse<PagedResult<ServiceDto>>)!;
            response.Data!.Items.Should().HaveCount(2);
            response.Data.Items.Should().OnlyContain(s => s.ReferencePrice >= 200000m && s.ReferencePrice <= 600000m);
        }

        [Fact]
        public async Task SCIT22_23_SortServices_ByPrice_AscendingAndDescending()
        {
            // Arrange
            await SeedServiceAsync(code: "P300", name: "Dịch vụ 300k", price: 300000m);
            await SeedServiceAsync(code: "P100", name: "Dịch vụ 100k", price: 100000m);
            await SeedServiceAsync(code: "P500", name: "Dịch vụ 500k", price: 500000m);

            // Act: Sort ascending
            var ascQuery = new ServiceQueryParameters { SortBy = "price", SortDescending = false };
            var ascResult = await Controller.GetServicesAsync(ascQuery, CancellationToken.None);
            var ascResponse = ((ascResult.Result as OkObjectResult)!.Value as ApiResponse<PagedResult<ServiceDto>>)!;
            ascResponse.Data!.Items.Select(s => s.ReferencePrice).Should().BeInAscendingOrder();

            // Act: Sort descending
            var descQuery = new ServiceQueryParameters { SortBy = "price", SortDescending = true };
            var descResult = await Controller.GetServicesAsync(descQuery, CancellationToken.None);
            var descResponse = ((descResult.Result as OkObjectResult)!.Value as ApiResponse<PagedResult<ServiceDto>>)!;
            descResponse.Data!.Items.Select(s => s.ReferencePrice).Should().BeInDescendingOrder();
        }

        [Fact]
        public async Task SCIT25_26_Pagination_PageNumberAndPageSize()
        {
            // Arrange
            for (int i = 1; i <= 25; i++)
            {
                await SeedServiceAsync(code: $"PAG{i:D3}", name: $"Dịch vụ {i:D2}");
            }

            // Act: Page 2 with PageSize 10
            var p2Query = new ServiceQueryParameters { PageNumber = 2, PageSize = 10 };
            var p2Result = await Controller.GetServicesAsync(p2Query, CancellationToken.None);
            var p2Response = ((p2Result.Result as OkObjectResult)!.Value as ApiResponse<PagedResult<ServiceDto>>)!;
            p2Response.Data!.Items.Should().HaveCount(10);
            p2Response.Data.PageNumber.Should().Be(2);

            // Act: Page 1 with PageSize 20
            var size20Query = new ServiceQueryParameters { PageNumber = 1, PageSize = 20 };
            var size20Result = await Controller.GetServicesAsync(size20Query, CancellationToken.None);
            var size20Response = ((size20Result.Result as OkObjectResult)!.Value as ApiResponse<PagedResult<ServiceDto>>)!;
            size20Response.Data!.Items.Should().HaveCount(20);
        }

        [Fact]
        public async Task SCIT27_28_GetActiveServices_ShouldCacheResults_AndInvalidateOnMutation()
        {
            // Arrange
            await SeedServiceAsync(code: "A01", name: "Dịch vụ B bật", isActive: true);
            await SeedServiceAsync(code: "A02", name: "Dịch vụ A bật", isActive: true);
            await SeedServiceAsync(code: "A03", name: "Dịch vụ tắt", isActive: false);

            // Act 1: Call GetActiveServicesAsync
            var result1 = await Controller.GetActiveServicesAsync(CancellationToken.None);
            var response1 = (result1.Result as OkObjectResult)!.Value as ApiResponse<IReadOnlyList<ServiceDto>>;
            response1!.Data.Should().HaveCount(2);
            response1.Data!.Select(s => s.ServiceName).Should().BeInAscendingOrder(); // Sorted by name

            // Act 2: Verify in cache
            var cachedBytes = await Cache.GetAsync("ClinicServices_ActiveList");
            cachedBytes.Should().NotBeNull();

            // Act 3: Add new service through controller (which purges cache)
            await Controller.CreateServiceAsync(new CreateServiceRequest
            {
                ServiceCode = "A04",
                ServiceName = "Dịch vụ C mới"
            }, CancellationToken.None);

            // Assert: Cache was invalidated
            var cachedAfterAdd = await Cache.GetAsync("ClinicServices_ActiveList");
            cachedAfterAdd.Should().BeNull();

            // Act 4: Call again to verify fresh list including newly created service
            var result2 = await Controller.GetActiveServicesAsync(CancellationToken.None);
            var response2 = (result2.Result as OkObjectResult)!.Value as ApiResponse<IReadOnlyList<ServiceDto>>;
            response2!.Data.Should().HaveCount(3);
        }

        [Fact]
        public async Task SCIT29_30_GetServiceById_WhenExistsAndWhenNotFound()
        {
            // Arrange
            var seeded = await SeedServiceAsync(code: "ID01", name: "Dịch vụ tìm theo ID");

            // Act: Exists
            var okResult = await Controller.GetServiceByIdAsync(seeded.Id, CancellationToken.None);
            var okObj = okResult.Result as OkObjectResult;
            okObj.Should().NotBeNull();
            var okResponse = okObj!.Value as ApiResponse<ServiceDto>;
            okResponse!.Data!.ServiceCode.Should().Be("ID01");

            // Act: Not found
            var notFoundResult = await Controller.GetServiceByIdAsync(99999, CancellationToken.None);
            var notFoundObj = notFoundResult.Result as NotFoundObjectResult;
            notFoundObj.Should().NotBeNull();
            var notFoundResponse = notFoundObj!.Value as ApiResponse<ServiceDto>;
            notFoundResponse!.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceNotFound);
        }

        [Fact]
        public async Task SCIT31_32_GetServiceByCode_WhenExistsAndWhenNotFound()
        {
            // Arrange
            await SeedServiceAsync(code: "CODE01", name: "Dịch vụ tìm theo Code");

            // Act: Exists (case-insensitive test)
            var okResult = await Controller.GetServiceByCodeAsync("code01", CancellationToken.None);
            var okObj = okResult.Result as OkObjectResult;
            okObj.Should().NotBeNull();
            var okResponse = okObj!.Value as ApiResponse<ServiceDto>;
            okResponse!.Data!.ServiceCode.Should().Be("CODE01");

            // Act: Not found
            var notFoundResult = await Controller.GetServiceByCodeAsync("NONEXISTENT", CancellationToken.None);
            var notFoundObj = notFoundResult.Result as NotFoundObjectResult;
            notFoundObj.Should().NotBeNull();
            var notFoundResponse = notFoundObj!.Value as ApiResponse<ServiceDto>;
            notFoundResponse!.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceNotFound);
        }
    }
}

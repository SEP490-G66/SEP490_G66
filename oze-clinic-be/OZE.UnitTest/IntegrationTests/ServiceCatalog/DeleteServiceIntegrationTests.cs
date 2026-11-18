using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OZE.Common.Constants;
using OZE.Common.Models.Base;
using Xunit;

namespace OZE.UnitTest.IntegrationTests.ServiceCatalog
{
    public class DeleteServiceIntegrationTests : ServiceCatalogIntegrationTestBase
    {
        [Fact]
        public async Task SCIT46_DeleteService_WhenNotInUse_ShouldHardDeleteAndPurgeCache()
        {
            // Arrange: Seed an unused service
            var service = await SeedServiceAsync(code: "DEL01", name: "Dịch vụ thử nghiệm xóa");

            // Prime cache with active services
            await Controller.GetActiveServicesAsync(CancellationToken.None);
            (await Cache.GetAsync("ClinicServices_ActiveList")).Should().NotBeNull();

            // Act
            var actionResult = await Controller.DeleteServiceAsync(service.Id, CancellationToken.None);

            // Assert: Controller response
            var okResult = actionResult.Result as OkObjectResult;
            okResult.Should().NotBeNull();
            var response = okResult!.Value as ApiResponse<bool>;
            response!.Success.Should().BeTrue();
            response.Data.Should().BeTrue();
            response.Message.Should().Be("Service deleted successfully");

            // Assert: Database state
            var entity = await DbContext.Services.FindAsync(service.Id);
            entity.Should().BeNull();

            // Assert: Cache was purged
            var cached = await Cache.GetAsync("ClinicServices_ActiveList");
            cached.Should().BeNull();
        }

        [Fact]
        public async Task SCIT47_DeleteService_WhenInUseByInvoices_ShouldFailWith400()
        {
            // Arrange
            var service = await SeedServiceAsync(code: "INV01", name: "Dịch vụ đã có hóa đơn");
            await AttachServiceToInvoiceAsync(service.Id);

            // Act
            var actionResult = await Controller.DeleteServiceAsync(service.Id, CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            var response = badRequest!.Value as ApiResponse<bool>;
            response!.Success.Should().BeFalse();
            response.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceInUse);

            // Entity should still exist in DB
            var entity = await DbContext.Services.FindAsync(service.Id);
            entity.Should().NotBeNull();
        }

        [Fact]
        public async Task SCIT47_2_DeleteService_WhenInUseByTreatmentPlanStages_ShouldFailWith400()
        {
            // Arrange
            var service = await SeedServiceAsync(code: "TP01", name: "Dịch vụ trong phác đồ");
            await AttachServiceToTreatmentPlanStageAsync(service.Id);

            // Act
            var actionResult = await Controller.DeleteServiceAsync(service.Id, CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            var response = badRequest!.Value as ApiResponse<bool>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceInUse);
        }

        [Fact]
        public async Task SCIT48_DeleteService_WhenInUseByAppointments_ShouldFailWith400()
        {
            // Arrange
            var service = await SeedServiceAsync(code: "APT01", name: "Dịch vụ trong lịch hẹn");
            await AttachServiceToAppointmentAsync(service.Id);

            // Act
            var actionResult = await Controller.DeleteServiceAsync(service.Id, CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            var response = badRequest!.Value as ApiResponse<bool>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceInUse);
        }

        [Fact]
        public async Task SCIT49_DeleteService_WhenNotFound_ShouldReturn404()
        {
            // Act
            var actionResult = await Controller.DeleteServiceAsync(99999, CancellationToken.None);

            // Assert
            var notFound = actionResult.Result as NotFoundObjectResult;
            notFound.Should().NotBeNull();
            var response = notFound!.Value as ApiResponse<bool>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceNotFound);
        }
    }
}

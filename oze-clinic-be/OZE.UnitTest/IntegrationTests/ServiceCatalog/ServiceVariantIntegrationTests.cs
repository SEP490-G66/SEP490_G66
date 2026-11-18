using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using Xunit;

namespace OZE.UnitTest.IntegrationTests.ServiceCatalog
{
    public class ServiceVariantIntegrationTests : ServiceCatalogIntegrationTestBase
    {
        [Fact]
        public async Task SCIT50_CreateVariant_WithValidData_ShouldPersistAndLinkToService()
        {
            // Arrange
            var service = await SeedServiceAsync(code: "TRN01", name: "Trám răng");

            var request = new SaveServiceVariantRequest
            {
                VariantCode = "trn01_xo1",
                VariantName = "Trám xoang 1",
                Description = "Mặt nhai",
                ReferencePrice = 350000m,
                EstimatedMinutes = 30,
                DisplayOrder = 1,
                IsActive = true
            };

            // Act
            var actionResult = await Controller.CreateVariantAsync(service.Id, request, CancellationToken.None);

            // Assert: Controller response
            var objResult = actionResult.Result as ObjectResult;
            objResult.Should().NotBeNull();
            objResult!.StatusCode.Should().Be(201);

            var response = objResult.Value as ApiResponse<ServiceVariantDto>;
            response!.Success.Should().BeTrue();
            response.Data!.VariantCode.Should().Be("TRN01_XO1");
            response.Data.ServiceId.Should().Be(service.Id);

            // Assert: Database state
            var entity = await DbContext.ServiceVariants.FirstOrDefaultAsync(v => v.VariantCode == "TRN01_XO1");
            entity.Should().NotBeNull();
            entity!.VariantName.Should().Be("Trám xoang 1");
            entity.ReferencePrice.Should().Be(350000m);
            entity.DisplayOrder.Should().Be(1);
        }

        [Fact]
        public async Task SCIT51_CreateVariant_WhenServiceNotFound_ShouldReturn404()
        {
            // Arrange
            var request = new SaveServiceVariantRequest
            {
                VariantCode = "VAR01",
                VariantName = "Biến thể"
            };

            // Act
            var actionResult = await Controller.CreateVariantAsync(99999, request, CancellationToken.None);

            // Assert
            var notFound = actionResult.Result as NotFoundObjectResult;
            notFound.Should().NotBeNull();
            var response = notFound!.Value as ApiResponse<ServiceVariantDto>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceNotFound);
        }

        [Fact]
        public async Task SCIT54_CreateVariant_WithDuplicateCode_SystemWide_ShouldReturn400()
        {
            // Arrange
            var service1 = await SeedServiceAsync(code: "SRV01", name: "Dịch vụ 1");
            var service2 = await SeedServiceAsync(code: "SRV02", name: "Dịch vụ 2");
            await SeedVariantAsync(service1.Id, variantCode: "VAR_DUP");

            var request = new SaveServiceVariantRequest
            {
                VariantCode = "var_dup", // duplicate code
                VariantName = "Biến thể của dịch vụ 2"
            };

            // Act
            var actionResult = await Controller.CreateVariantAsync(service2.Id, request, CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            var response = badRequest!.Value as ApiResponse<ServiceVariantDto>;
            response!.Message.Should().Be(ErrorConstants.ServiceVariantMessage.VariantCodeExist);
        }

        [Fact]
        public async Task SCIT55_56_CreateVariant_WithInvalidPriceOrEstimatedMinutes_ShouldReturn400()
        {
            // Arrange
            var service = await SeedServiceAsync(code: "SRV01", name: "Dịch vụ");

            // Negative price
            var badPriceRequest = new SaveServiceVariantRequest
            {
                VariantCode = "VAR_P",
                VariantName = "Biến thể giá âm",
                ReferencePrice = -100m
            };
            var priceResult = await Controller.CreateVariantAsync(service.Id, badPriceRequest, CancellationToken.None);
            var badPriceObj = priceResult.Result as BadRequestObjectResult;
            badPriceObj.Should().NotBeNull();
            ((ApiResponse<ServiceVariantDto>)badPriceObj!.Value!).Message.Should().Be(ErrorConstants.ServiceVariantMessage.InvalidPrice);

            // Non-positive estimated minutes
            var badMinutesRequest = new SaveServiceVariantRequest
            {
                VariantCode = "VAR_M",
                VariantName = "Biến thể thời lượng 0",
                EstimatedMinutes = 0
            };
            var minResult = await Controller.CreateVariantAsync(service.Id, badMinutesRequest, CancellationToken.None);
            var badMinObj = minResult.Result as BadRequestObjectResult;
            badMinObj.Should().NotBeNull();
            ((ApiResponse<ServiceVariantDto>)badMinObj!.Value!).Message.Should().Be(ErrorConstants.ServiceVariantMessage.InvalidEstimatedMinutes);
        }

        [Fact]
        public async Task SCIT57_58_GetVariants_ShouldReturnOrderedByDisplayOrder()
        {
            // Arrange
            var service = await SeedServiceAsync(code: "SRV01", name: "Dịch vụ");
            await SeedVariantAsync(service.Id, variantCode: "V3", variantName: "Biến thể 3", displayOrder: 3);
            await SeedVariantAsync(service.Id, variantCode: "V1", variantName: "Biến thể 1", displayOrder: 1);
            await SeedVariantAsync(service.Id, variantCode: "V2", variantName: "Biến thể 2", displayOrder: 2);

            // Act: Service exists
            var actionResult = await Controller.GetVariantsAsync(service.Id, CancellationToken.None);
            var okResult = actionResult.Result as OkObjectResult;
            okResult.Should().NotBeNull();
            var response = okResult!.Value as ApiResponse<IReadOnlyList<ServiceVariantDto>>;
            response!.Data.Should().HaveCount(3);
            response.Data!.Select(v => v.DisplayOrder).Should().BeInAscendingOrder();

            // Act: Service not found
            var notFoundResult = await Controller.GetVariantsAsync(99999, CancellationToken.None);
            var notFound = notFoundResult.Result as NotFoundObjectResult;
            notFound.Should().NotBeNull();
        }

        [Fact]
        public async Task SCIT59_60_UpdateVariant_WhenValidAndWhenNotFound()
        {
            // Arrange
            var service = await SeedServiceAsync(code: "SRV01", name: "Dịch vụ");
            var variant = await SeedVariantAsync(service.Id, variantCode: "V1", variantName: "Tên cũ", price: 100000m);

            var updateRequest = new SaveServiceVariantRequest
            {
                VariantCode = "V1_NEW",
                VariantName = "Tên mới",
                ReferencePrice = 200000m,
                EstimatedMinutes = 40,
                DisplayOrder = 2
            };

            // Act: Valid update
            var actionResult = await Controller.UpdateVariantAsync(service.Id, variant.Id, updateRequest, CancellationToken.None);
            var okResult = actionResult.Result as OkObjectResult;
            okResult.Should().NotBeNull();

            var entity = await DbContext.ServiceVariants.FindAsync(variant.Id);
            entity!.VariantCode.Should().Be("V1_NEW");
            entity.VariantName.Should().Be("Tên mới");
            entity.ReferencePrice.Should().Be(200000m);

            // Act: Variant not found
            var notFoundResult = await Controller.UpdateVariantAsync(service.Id, 99999, updateRequest, CancellationToken.None);
            var notFound = notFoundResult.Result as NotFoundObjectResult;
            notFound.Should().NotBeNull();
            ((ApiResponse<ServiceVariantDto>)notFound!.Value!).Message.Should().Be(ErrorConstants.ServiceVariantMessage.VariantNotFound);
        }

        [Fact]
        public async Task SCIT61_62_ToggleVariantStatus_WhenNoAppointmentsAndWhenOpenAppointmentsExist()
        {
            // Arrange
            var service = await SeedServiceAsync(code: "SRV01", name: "Dịch vụ");
            var variantFree = await SeedVariantAsync(service.Id, variantCode: "V_FREE", isActive: true);
            var variantBusy = await SeedVariantAsync(service.Id, variantCode: "V_BUSY", isActive: true);

            // Attach open appointment to variantBusy
            await AttachServiceToAppointmentAsync(
                serviceId: service.Id,
                variantId: variantBusy.Id,
                appointmentDate: DateOnly.FromDateTime(DateTime.UtcNow),
                status: AppointmentConstants.ConfirmedStatus);

            // Act: Toggle variantFree to false -> should succeed
            var freeResult = await Controller.ToggleVariantStatusAsync(
                service.Id,
                variantFree.Id,
                new ToggleServiceStatusRequest { IsActive = false },
                CancellationToken.None);
            (freeResult.Result as OkObjectResult).Should().NotBeNull();

            // Act: Toggle variantBusy to false -> should fail with 400
            var busyResult = await Controller.ToggleVariantStatusAsync(
                service.Id,
                variantBusy.Id,
                new ToggleServiceStatusRequest { IsActive = false },
                CancellationToken.None);
            var badRequest = busyResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            ((ApiResponse<ServiceVariantDto>)badRequest!.Value!).Message.Should().Be(ErrorConstants.ServiceVariantMessage.HasOpenAppointments);
        }

        [Fact]
        public async Task SCIT63_64_DeleteVariant_WhenUnusedAndWhenInUse()
        {
            // Arrange
            var service = await SeedServiceAsync(code: "SRV01", name: "Dịch vụ");
            var variantUnused = await SeedVariantAsync(service.Id, variantCode: "V_UNUSED");
            var variantUsed = await SeedVariantAsync(service.Id, variantCode: "V_USED");

            // Attach past appointment to variantUsed
            await AttachServiceToAppointmentAsync(
                serviceId: service.Id,
                variantId: variantUsed.Id,
                appointmentDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
                status: AppointmentConstants.CompletedStatus);

            // Act 1: Delete unused variant -> Should succeed
            var deleteUnusedResult = await Controller.DeleteVariantAsync(service.Id, variantUnused.Id, CancellationToken.None);
            var okResult = deleteUnusedResult.Result as OkObjectResult;
            okResult.Should().NotBeNull();
            (await DbContext.ServiceVariants.FindAsync(variantUnused.Id)).Should().BeNull();

            // Act 2: Delete used variant -> Should fail with 400
            var deleteUsedResult = await Controller.DeleteVariantAsync(service.Id, variantUsed.Id, CancellationToken.None);
            var badRequest = deleteUsedResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            ((ApiResponse<bool>)badRequest!.Value!).Message.Should().Be(ErrorConstants.ServiceVariantMessage.VariantInUse);
            (await DbContext.ServiceVariants.FindAsync(variantUsed.Id)).Should().NotBeNull();
        }
    }
}

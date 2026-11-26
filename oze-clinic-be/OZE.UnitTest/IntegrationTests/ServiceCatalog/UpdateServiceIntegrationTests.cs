using OZE.Application.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using Xunit;

namespace OZE.UnitTest.IntegrationTests.ServiceCatalog
{
    public class UpdateServiceIntegrationTests : ServiceCatalogIntegrationTestBase
    {
        [Fact]
        public async Task SCIT33_UpdateService_WithValidData_ShouldPersistAndRefreshUpdatedAt()
        {
            // Arrange
            var seeded = await SeedServiceAsync(code: "TRN01", name: "Trám răng cũ", price: 300000m);

            var updateRequest = new UpdateServiceRequest
            {
                ServiceCode = "trn01_v2",
                ServiceName = "Trám răng composite cao cấp",
                ReferencePrice = 450000m,
                EstimatedMinutes = 45,
                RequiredRoomType = "MinorSurgery",
                IsActive = true
            };

            // Act
            var actionResult = await Controller.UpdateServiceAsync(seeded.Id, updateRequest, CancellationToken.None);

            // Assert: Controller response
            var okResult = actionResult.Result as OkObjectResult;
            okResult.Should().NotBeNull();
            var response = okResult!.Value as ApiResponse<ServiceDto>;
            response!.Success.Should().BeTrue();
            response.Message.Should().Be("Service updated successfully");

            // Assert: Database state
            var updatedEntity = await DbContext.Services.FindAsync(seeded.Id);
            updatedEntity.Should().NotBeNull();
            updatedEntity!.ServiceCode.Should().Be("TRN01_V2");
            updatedEntity.ServiceName.Should().Be("Trám răng composite cao cấp");
            updatedEntity.ReferencePrice.Should().Be(450000m);
            updatedEntity.EstimatedMinutes.Should().Be(45);
            updatedEntity.RequiredRoomType.Should().Be("MinorSurgery");
            updatedEntity.UpdatedAt.Should().NotBeNull();
        }

        [Fact]
        public async Task SCIT34_UpdateService_WhenIsActiveIsNull_ShouldRetainCurrentStatus()
        {
            // Arrange: Seed an active service
            var seeded = await SeedServiceAsync(code: "TRN01", name: "Trám răng", isActive: true);

            var updateRequest = new UpdateServiceRequest
            {
                ServiceCode = "TRN01",
                ServiceName = "Trám răng sửa tên",
                IsActive = null // Omit IsActive
            };

            // Act
            await Controller.UpdateServiceAsync(seeded.Id, updateRequest, CancellationToken.None);

            // Assert: IsActive should remain true
            var entity = await DbContext.Services.FindAsync(seeded.Id);
            entity!.IsActive.Should().BeTrue();
        }

        [Fact]
        public async Task SCIT35_UpdateService_WhenNotFound_ShouldReturn404()
        {
            // Arrange
            var updateRequest = new UpdateServiceRequest
            {
                ServiceCode = "TRN01",
                ServiceName = "Trám răng"
            };

            // Act
            var actionResult = await Controller.UpdateServiceAsync(99999, updateRequest, CancellationToken.None);

            // Assert
            var notFound = actionResult.Result as NotFoundObjectResult;
            notFound.Should().NotBeNull();
            var response = notFound!.Value as ApiResponse<ServiceDto>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceNotFound);
        }

        [Fact]
        public async Task SCIT36_UpdateService_WithDuplicateCode_ShouldReturn400()
        {
            // Arrange
            var service1 = await SeedServiceAsync(code: "SRV01", name: "Dịch vụ 1");
            var service2 = await SeedServiceAsync(code: "SRV02", name: "Dịch vụ 2");

            var updateRequest = new UpdateServiceRequest
            {
                ServiceCode = "srv01", // duplicate with service1
                ServiceName = "Dịch vụ 2 sửa"
            };

            // Act
            var actionResult = await Controller.UpdateServiceAsync(service2.Id, updateRequest, CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            var response = badRequest!.Value as ApiResponse<ServiceDto>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceCodeExist);
        }

        [Fact]
        public async Task SCIT37_UpdateService_WithDuplicateName_ShouldReturn400()
        {
            // Arrange
            var service1 = await SeedServiceAsync(code: "SRV01", name: "Tẩy trắng răng");
            var service2 = await SeedServiceAsync(code: "SRV02", name: "Lấy cao răng");

            var updateRequest = new UpdateServiceRequest
            {
                ServiceCode = "SRV02",
                ServiceName = "tẩy trắng RĂNG" // duplicate with service1
            };

            // Act
            var actionResult = await Controller.UpdateServiceAsync(service2.Id, updateRequest, CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            var response = badRequest!.Value as ApiResponse<ServiceDto>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceNameExist);
        }

        [Fact]
        public async Task SCIT40_UpdateService_DeactivatingWithOpenAppointments_ShouldReturn400()
        {
            // Arrange
            var service = await SeedServiceAsync(code: "SRV01", name: "Khám tổng quát", isActive: true);

            // Attach open appointment today
            await AttachServiceToAppointmentAsync(
                serviceId: service.Id,
                appointmentDate: DateOnly.FromDateTime(ClinicClock.Today),
                status: AppointmentConstants.ConfirmedStatus);

            var updateRequest = new UpdateServiceRequest
            {
                ServiceCode = "SRV01",
                ServiceName = "Khám tổng quát",
                IsActive = false // Trying to deactivate
            };

            // Act
            var actionResult = await Controller.UpdateServiceAsync(service.Id, updateRequest, CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            var response = badRequest!.Value as ApiResponse<ServiceDto>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.HasOpenAppointments);

            // DB status should remain active
            var entity = await DbContext.Services.FindAsync(service.Id);
            entity!.IsActive.Should().BeTrue();
        }

        [Fact]
        public async Task SCIT41_42_DeactivateAndActivateService_WithoutAppointments_ShouldSucceed()
        {
            // Arrange: Seed active service
            var service = await SeedServiceAsync(code: "SRV01", name: "Nhổ răng khôn", isActive: true);

            // Act: Deactivate
            var deactResult = await Controller.DeactivateServiceAsync(service.Id, CancellationToken.None);
            var deactObj = deactResult.Result as OkObjectResult;
            deactObj.Should().NotBeNull();
            var deactEntity = await DbContext.Services.FindAsync(service.Id);
            deactEntity!.IsActive.Should().BeFalse();

            // Act: Activate
            var actResult = await Controller.ActivateServiceAsync(service.Id, CancellationToken.None);
            var actObj = actResult.Result as OkObjectResult;
            actObj.Should().NotBeNull();
            var actEntity = await DbContext.Services.FindAsync(service.Id);
            actEntity!.IsActive.Should().BeTrue();
        }

        [Fact]
        public async Task SCIT43_ToggleStatus_DeactivatingWithOpenAppointments_ShouldReturn400()
        {
            // Arrange
            var service = await SeedServiceAsync(code: "SRV01", name: "Chỉnh nha", isActive: true);

            await AttachServiceToAppointmentAsync(
                serviceId: service.Id,
                appointmentDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                status: AppointmentConstants.PendingStatus);

            // Act: Try to toggle status to false
            var actionResult = await Controller.ToggleStatusAsync(
                service.Id,
                new ToggleServiceStatusRequest { IsActive = false },
                CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            var response = badRequest!.Value as ApiResponse<ServiceDto>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.HasOpenAppointments);
        }

        [Fact]
        public async Task SCIT44_ToggleStatus_WithSameStatus_ShouldShortCircuit()
        {
            // Arrange: Already active service
            var service = await SeedServiceAsync(code: "SRV01", name: "Cạo vôi răng", isActive: true);

            // Act: Toggle to active again
            var actionResult = await Controller.ToggleStatusAsync(
                service.Id,
                new ToggleServiceStatusRequest { IsActive = true },
                CancellationToken.None);

            // Assert
            var okResult = actionResult.Result as OkObjectResult;
            okResult.Should().NotBeNull();
            var response = okResult!.Value as ApiResponse<ServiceDto>;
            response!.Success.Should().BeTrue();
            response.Message.Should().Be("Service activated successfully");
        }

        [Fact]
        public async Task SCIT45_ToggleStatus_NonExistentService_ShouldReturn404()
        {
            // Act
            var actionResult = await Controller.ToggleStatusAsync(
                99999,
                new ToggleServiceStatusRequest { IsActive = true },
                CancellationToken.None);

            // Assert
            var notFound = actionResult.Result as NotFoundObjectResult;
            notFound.Should().NotBeNull();
            var response = notFound!.Value as ApiResponse<ServiceDto>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceNotFound);
        }
    }
}

using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using Xunit;

namespace OZE.UnitTest.IntegrationTests.ServiceCatalog
{
    public class CreateServiceIntegrationTests : ServiceCatalogIntegrationTestBase
    {
        [Fact]
        public async Task SCIT01_CreateService_WithAllValidFields_ShouldSucceedAndPersistInDb()
        {
            // Arrange
            var request = new CreateServiceRequest
            {
                ServiceCode = "trn01",
                ServiceName = "Trám răng composite",
                Description = "Trám răng thẩm mỹ bằng composite",
                ReferencePrice = 350000m,
                EstimatedMinutes = 30,
                RecallIntervalMonths = 6,
                RequiredRoomType = "generaltreatment",
                IsActive = true
            };

            // Act
            var actionResult = await Controller.CreateServiceAsync(request, CancellationToken.None);

            // Assert: Controller response
            var createdResult = actionResult.Result as CreatedAtActionResult;
            createdResult.Should().NotBeNull();
            createdResult!.StatusCode.Should().Be(201);

            var response = createdResult.Value as ApiResponse<ServiceDto>;
            response.Should().NotBeNull();
            response!.Success.Should().BeTrue();
            response.Message.Should().Be("Service created successfully");
            response.Data.Should().NotBeNull();
            response.Data!.ServiceCode.Should().Be("TRN01");
            response.Data.RequiredRoomType.Should().Be("GeneralTreatment");

            // Assert: Database persistence
            var entity = await DbContext.Services.FirstOrDefaultAsync(s => s.ServiceCode == "TRN01");
            entity.Should().NotBeNull();
            entity!.ServiceName.Should().Be("Trám răng composite");
            entity.ReferencePrice.Should().Be(350000m);
            entity.EstimatedMinutes.Should().Be(30);
            entity.RecallIntervalMonths.Should().Be(6);
            entity.RequiredRoomType.Should().Be("GeneralTreatment");
            entity.IsActive.Should().BeTrue();
        }

        [Fact]
        public async Task SCIT02_CreateService_WithMandatoryFieldsOnly_ShouldSetDefaultsAndPersist()
        {
            // Arrange
            var request = new CreateServiceRequest
            {
                ServiceCode = "TRN02",
                ServiceName = "Nhổ răng số 8"
            };

            // Act
            var actionResult = await Controller.CreateServiceAsync(request, CancellationToken.None);

            // Assert
            var createdResult = actionResult.Result as CreatedAtActionResult;
            createdResult.Should().NotBeNull();
            createdResult!.StatusCode.Should().Be(201);

            var entity = await DbContext.Services.FirstOrDefaultAsync(s => s.ServiceCode == "TRN02");
            entity.Should().NotBeNull();
            entity!.ReferencePrice.Should().Be(0);
            entity.IsActive.Should().BeTrue();
            entity.EstimatedMinutes.Should().BeNull();
            entity.RequiredRoomType.Should().BeNull();
        }

        [Theory]
        [InlineData("MinorSurgery", "MinorSurgery")]
        [InlineData("minorsurgery", "MinorSurgery")]
        [InlineData("XRay", "XRay")]
        [InlineData("xray", "XRay")]
        public async Task SCIT03_04_CreateService_WithValidRoomTypes_ShouldNormalizeAndPersist(string inputRoomType, string expectedRoomType)
        {
            // Arrange
            var request = new CreateServiceRequest
            {
                ServiceCode = $"ROOM_{Guid.NewGuid():N}"[..10],
                ServiceName = $"Dịch vụ {inputRoomType}",
                RequiredRoomType = inputRoomType,
                ReferencePrice = 500000m
            };

            // Act
            var actionResult = await Controller.CreateServiceAsync(request, CancellationToken.None);

            // Assert
            var createdResult = actionResult.Result as CreatedAtActionResult;
            createdResult.Should().NotBeNull();
            createdResult!.StatusCode.Should().Be(201);

            var entity = await DbContext.Services.FirstOrDefaultAsync(s => s.ServiceCode == request.ServiceCode.ToUpperInvariant());
            entity.Should().NotBeNull();
            entity!.RequiredRoomType.Should().Be(expectedRoomType);
        }

        [Fact]
        public async Task SCIT08_CreateService_WithDuplicateCode_CaseInsensitive_ShouldFailWith400()
        {
            // Arrange: Seed an existing service
            await SeedServiceAsync(code: "TRN01", name: "Trám răng đã có");

            var request = new CreateServiceRequest
            {
                ServiceCode = "trn01", // duplicate in lowercase
                ServiceName = "Trám răng mới",
                ReferencePrice = 200000m
            };

            // Act
            var actionResult = await Controller.CreateServiceAsync(request, CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            badRequest!.StatusCode.Should().Be(400);

            var response = badRequest.Value as ApiResponse<ServiceDto>;
            response.Should().NotBeNull();
            response!.Success.Should().BeFalse();
            response.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceCodeExist);
        }

        [Fact]
        public async Task SCIT10_CreateService_WithDuplicateName_CaseInsensitive_ShouldFailWith400()
        {
            // Arrange: Seed an existing service
            await SeedServiceAsync(code: "EXIST01", name: "Trám răng composite");

            var request = new CreateServiceRequest
            {
                ServiceCode = "DIFF01",
                ServiceName = "  trám răng COMPOSITE  ", // duplicate with leading/trailing spaces and different casing
                ReferencePrice = 200000m
            };

            // Act
            var actionResult = await Controller.CreateServiceAsync(request, CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            badRequest!.StatusCode.Should().Be(400);

            var response = badRequest.Value as ApiResponse<ServiceDto>;
            response.Should().NotBeNull();
            response!.Success.Should().BeFalse();
            response.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceNameExist);
        }

        [Fact]
        public async Task SCIT11_CreateService_WithNegativeReferencePrice_ShouldFailWith400()
        {
            // Arrange
            var request = new CreateServiceRequest
            {
                ServiceCode = "NEG01",
                ServiceName = "Dịch vụ giá âm",
                ReferencePrice = -1000m
            };

            // Act
            var actionResult = await Controller.CreateServiceAsync(request, CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();

            var response = badRequest!.Value as ApiResponse<ServiceDto>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.InvalidPrice);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-5)]
        public async Task SCIT12_CreateService_WithNonPositiveEstimatedMinutes_ShouldFailWith400(int minutes)
        {
            // Arrange
            var request = new CreateServiceRequest
            {
                ServiceCode = "MIN01",
                ServiceName = "Dịch vụ thời lượng sai",
                EstimatedMinutes = minutes
            };

            // Act
            var actionResult = await Controller.CreateServiceAsync(request, CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();

            var response = badRequest!.Value as ApiResponse<ServiceDto>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.InvalidEstimatedMinutes);
        }

        [Fact]
        public async Task SCIT13_CreateService_WithInvalidRoomType_ShouldFailWith400()
        {
            // Arrange
            var request = new CreateServiceRequest
            {
                ServiceCode = "ROOM01",
                ServiceName = "Dịch vụ phòng sai",
                RequiredRoomType = "EmergencyRoom"
            };

            // Act
            var actionResult = await Controller.CreateServiceAsync(request, CancellationToken.None);

            // Assert
            var badRequest = actionResult.Result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();

            var response = badRequest!.Value as ApiResponse<ServiceDto>;
            response!.Message.Should().Be(ErrorConstants.ServiceMessage.InvalidRoomType);
        }
    }
}

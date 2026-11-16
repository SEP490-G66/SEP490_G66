using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Roles
{
    // OZ-ROLE-03 CreateRole
    [Trait("Tab", "OZ-ROLE-03")]
    public class CreateRoleTests : RoleTestBase
    {
        // UTCID01 (N): Create role successfully with name and description; UserCount is 0
        [Fact]
        public async Task CreateRoleAsync_ShouldCreateRole_WhenRequestIsValid()
        {
            // Arrange
            var request = new CreateRoleRequest
            {
                Name = "Nurse",
                Description = "Phu ta nha khoa"
            };

            _roleManagerMock
                .Setup(m => m.RoleExistsAsync("Nurse"))
                .ReturnsAsync(false);
            _roleManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<ApplicationRole>()))
                .Callback<ApplicationRole>(role => role.Id = "new-role-id")
                .ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await _service.CreateRoleAsync(request);

            // Assert
            result.Id.Should().Be("new-role-id");
            result.Name.Should().Be("Nurse");
            result.Description.Should().Be("Phu ta nha khoa");
            result.IsActive.Should().BeTrue();
            result.UserCount.Should().Be(0);
            result.CreatedAt.Should().BeAfter(DateTimeOffset.UtcNow.AddMinutes(-1));

            _roleManagerMock.Verify(
                m => m.CreateAsync(It.Is<ApplicationRole>(r =>
                    r.Name == "Nurse"
                    && r.Description == "Phu ta nha khoa"
                    && r.IsActive)),
                Times.Once);
        }

        // UTCID02 (N): Blank Description is stored as null
        [Fact]
        public async Task CreateRoleAsync_ShouldStoreNullDescription_WhenDescriptionIsBlank()
        {
            // Arrange
            var request = new CreateRoleRequest
            {
                Name = "Receptionist",
                Description = "   "
            };

            _roleManagerMock
                .Setup(m => m.RoleExistsAsync("Receptionist"))
                .ReturnsAsync(false);
            _roleManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<ApplicationRole>()))
                .Callback<ApplicationRole>(role => role.Id = "role-reception")
                .ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await _service.CreateRoleAsync(request);

            // Assert
            result.Description.Should().BeNull();
            result.IsActive.Should().BeTrue();
            result.UserCount.Should().Be(0);
            _roleManagerMock.Verify(
                m => m.CreateAsync(It.Is<ApplicationRole>(r => r.Description == null)),
                Times.Once);
        }

        // UTCID03 (B): Name and Description with surrounding whitespace are trimmed
        [Fact]
        public async Task CreateRoleAsync_ShouldTrimNameAndDescription_WhenValuesHaveSurroundingWhitespace()
        {
            // Arrange
            var request = new CreateRoleRequest
            {
                Name = "  Technician  ",
                Description = "  Ky thuat vien  "
            };

            _roleManagerMock
                .Setup(m => m.RoleExistsAsync("Technician"))
                .ReturnsAsync(false);
            _roleManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<ApplicationRole>()))
                .Callback<ApplicationRole>(role => role.Id = "role-tech")
                .ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await _service.CreateRoleAsync(request);

            // Assert
            result.Name.Should().Be("Technician");
            result.Description.Should().Be("Ky thuat vien");
            _roleManagerMock.Verify(m => m.RoleExistsAsync("Technician"), Times.Once);
            _roleManagerMock.Verify(
                m => m.CreateAsync(It.Is<ApplicationRole>(r =>
                    r.Name == "Technician" && r.Description == "Ky thuat vien")),
                Times.Once);
        }

        // UTCID04 (A): Duplicate role name throws BadRequestException
        [Fact]
        public async Task CreateRoleAsync_ShouldThrowBadRequest_WhenRoleNameAlreadyExists()
        {
            // Arrange
            var request = new CreateRoleRequest
            {
                Name = "Doctor",
                Description = "Bac si"
            };

            _roleManagerMock
                .Setup(m => m.RoleExistsAsync("Doctor"))
                .ReturnsAsync(true);

            // Act
            var act = () => _service.CreateRoleAsync(request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.RoleMessage.RoleExist);
            _roleManagerMock.Verify(m => m.CreateAsync(It.IsAny<ApplicationRole>()), Times.Never);
        }

        // UTCID05 (A): Identity CreateAsync failure throws BadRequestException with CreateFailed fallback
        [Fact]
        public async Task CreateRoleAsync_ShouldThrowBadRequest_WhenIdentityCreateFails()
        {
            // Arrange
            var request = new CreateRoleRequest
            {
                Name = "Assistant",
                Description = null
            };

            _roleManagerMock
                .Setup(m => m.RoleExistsAsync("Assistant"))
                .ReturnsAsync(false);
            _roleManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<ApplicationRole>()))
                .ReturnsAsync(IdentityResult.Failed());

            // Act
            var act = () => _service.CreateRoleAsync(request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.RoleMessage.CreateFailed);
        }
    }
}

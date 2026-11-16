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
    // OZ-ROLE-04 UpdateRole
    [Trait("Tab", "OZ-ROLE-04")]
    public class UpdateRoleTests : RoleTestBase
    {
        // UTCID01 (N): Update description successfully and return role from repository
        [Fact]
        public async Task UpdateRoleAsync_ShouldUpdateDescription_WhenRoleExists()
        {
            // Arrange
            var existing = CreateExistingRole(description: "Bac si");
            var request = new UpdateRoleRequest { Description = "Bac si nha khoa" };
            var refreshed = CreateSampleRoleResponse(description: "Bac si nha khoa");
            refreshed.UpdatedAt = DateTimeOffset.Parse("2026-11-16T07:00:00Z");

            _roleManagerMock
                .Setup(m => m.FindByIdAsync(ValidRoleId))
                .ReturnsAsync(existing);
            _roleManagerMock
                .Setup(m => m.UpdateAsync(It.IsAny<ApplicationRole>()))
                .ReturnsAsync(IdentityResult.Success);
            _roleRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoleId))
                .ReturnsAsync(refreshed);

            // Act
            var result = await _service.UpdateRoleAsync(ValidRoleId, request);

            // Assert
            result.Id.Should().Be(ValidRoleId);
            result.Name.Should().Be(ValidRoleName);
            result.Description.Should().Be("Bac si nha khoa");
            result.UpdatedAt.Should().Be(refreshed.UpdatedAt);

            _roleManagerMock.Verify(
                m => m.UpdateAsync(It.Is<ApplicationRole>(r =>
                    r.Id == ValidRoleId
                    && r.Description == "Bac si nha khoa"
                    && r.UpdatedAt != null)),
                Times.Once);
            _roleRepositoryMock.Verify(r => r.GetByIdAsync(ValidRoleId), Times.Once);
        }

        // UTCID02 (N): Blank Description is stored as null
        [Fact]
        public async Task UpdateRoleAsync_ShouldStoreNullDescription_WhenDescriptionIsBlank()
        {
            // Arrange
            var existing = CreateExistingRole(description: "Bac si");
            var request = new UpdateRoleRequest { Description = "   " };
            var refreshed = CreateSampleRoleResponse(description: null);
            refreshed.UpdatedAt = DateTimeOffset.Parse("2026-11-16T07:05:00Z");

            _roleManagerMock
                .Setup(m => m.FindByIdAsync(ValidRoleId))
                .ReturnsAsync(existing);
            _roleManagerMock
                .Setup(m => m.UpdateAsync(It.IsAny<ApplicationRole>()))
                .ReturnsAsync(IdentityResult.Success);
            _roleRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoleId))
                .ReturnsAsync(refreshed);

            // Act
            var result = await _service.UpdateRoleAsync(ValidRoleId, request);

            // Assert
            result.Description.Should().BeNull();
            _roleManagerMock.Verify(
                m => m.UpdateAsync(It.Is<ApplicationRole>(r => r.Description == null)),
                Times.Once);
        }

        // UTCID03 (B): Description with surrounding whitespace is trimmed
        [Fact]
        public async Task UpdateRoleAsync_ShouldTrimDescription_WhenValueHasSurroundingWhitespace()
        {
            // Arrange
            var existing = CreateExistingRole(description: "Bac si");
            var request = new UpdateRoleRequest { Description = "  Mo ta moi  " };
            var refreshed = CreateSampleRoleResponse(description: "Mo ta moi");
            refreshed.UpdatedAt = DateTimeOffset.Parse("2026-11-16T07:10:00Z");

            _roleManagerMock
                .Setup(m => m.FindByIdAsync(ValidRoleId))
                .ReturnsAsync(existing);
            _roleManagerMock
                .Setup(m => m.UpdateAsync(It.IsAny<ApplicationRole>()))
                .ReturnsAsync(IdentityResult.Success);
            _roleRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoleId))
                .ReturnsAsync(refreshed);

            // Act
            var result = await _service.UpdateRoleAsync(ValidRoleId, request);

            // Assert
            result.Description.Should().Be("Mo ta moi");
            _roleManagerMock.Verify(
                m => m.UpdateAsync(It.Is<ApplicationRole>(r => r.Description == "Mo ta moi")),
                Times.Once);
        }

        // UTCID04 (A): Missing role throws NotFoundException
        [Fact]
        public async Task UpdateRoleAsync_ShouldThrowNotFound_WhenRoleDoesNotExist()
        {
            // Arrange
            const string missingId = "missing-role-id";
            var request = new UpdateRoleRequest { Description = "Anything" };

            _roleManagerMock
                .Setup(m => m.FindByIdAsync(missingId))
                .ReturnsAsync((ApplicationRole?)null);

            // Act
            var act = () => _service.UpdateRoleAsync(missingId, request);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.RoleMessage.RoleNotFound);
            _roleManagerMock.Verify(m => m.UpdateAsync(It.IsAny<ApplicationRole>()), Times.Never);
            _roleRepositoryMock.Verify(r => r.GetByIdAsync(It.IsAny<string>()), Times.Never);
        }

        // UTCID05 (A): Identity UpdateAsync failure throws BadRequestException with UpdateFailed fallback
        [Fact]
        public async Task UpdateRoleAsync_ShouldThrowBadRequest_WhenIdentityUpdateFails()
        {
            // Arrange
            var existing = CreateExistingRole(description: "Bac si");
            var request = new UpdateRoleRequest { Description = "Mo ta" };

            _roleManagerMock
                .Setup(m => m.FindByIdAsync(ValidRoleId))
                .ReturnsAsync(existing);
            _roleManagerMock
                .Setup(m => m.UpdateAsync(It.IsAny<ApplicationRole>()))
                .ReturnsAsync(IdentityResult.Failed());

            // Act
            var act = () => _service.UpdateRoleAsync(ValidRoleId, request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.RoleMessage.UpdateFailed);
            _roleRepositoryMock.Verify(r => r.GetByIdAsync(It.IsAny<string>()), Times.Never);
        }

        private static ApplicationRole CreateExistingRole(string? description)
        {
            return new ApplicationRole(ValidRoleName)
            {
                Id = ValidRoleId,
                Description = description,
                IsActive = true,
                CreatedAt = DateTimeOffset.Parse("2026-11-01T00:00:00Z"),
                UpdatedAt = null
            };
        }
    }
}

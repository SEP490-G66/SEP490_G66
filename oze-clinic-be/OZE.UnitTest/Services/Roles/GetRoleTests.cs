using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using Xunit;

namespace OZE.UnitTest.Services.Roles
{
    // OZ-ROLE-02 GetRole
    [Trait("Tab", "OZ-ROLE-02")]
    public class GetRoleTests : RoleTestBase
    {
        // UTCID01 (N): Return role when it exists
        [Fact]
        public async Task GetRoleAsync_ShouldReturnRole_WhenRoleExists()
        {
            // Arrange
            var role = CreateSampleRoleResponse();
            _roleRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoleId))
                .ReturnsAsync(role);

            // Act
            var result = await _service.GetRoleAsync(ValidRoleId);

            // Assert
            result.Should().NotBeNull();
            result.Id.Should().Be(ValidRoleId);
            result.Name.Should().Be(ValidRoleName);
            result.Description.Should().Be("Bac si");
            result.IsActive.Should().BeTrue();
            result.UserCount.Should().Be(2);
            result.CreatedAt.Should().Be(role.CreatedAt);
            result.UpdatedAt.Should().BeNull();
            _roleRepositoryMock.Verify(r => r.GetByIdAsync(ValidRoleId), Times.Once);
        }

        // UTCID02 (N): Map null Description and inactive role fields
        [Fact]
        public async Task GetRoleAsync_ShouldMapOptionalFields_WhenDescriptionIsNullAndRoleInactive()
        {
            // Arrange
            var role = CreateSampleRoleResponse(
                id: "role-2",
                name: "Nurse",
                description: null,
                isActive: false,
                userCount: 0);
            role.UpdatedAt = DateTimeOffset.Parse("2026-11-10T08:00:00Z");

            _roleRepositoryMock
                .Setup(r => r.GetByIdAsync("role-2"))
                .ReturnsAsync(role);

            // Act
            var result = await _service.GetRoleAsync("role-2");

            // Assert
            result.Id.Should().Be("role-2");
            result.Name.Should().Be("Nurse");
            result.Description.Should().BeNull();
            result.IsActive.Should().BeFalse();
            result.UserCount.Should().Be(0);
            result.UpdatedAt.Should().Be(role.UpdatedAt);
        }

        // UTCID03 (B): Empty string id yields NotFound when repository returns null
        [Fact]
        public async Task GetRoleAsync_ShouldThrowNotFound_WhenIdIsEmptyStringBoundary()
        {
            // Arrange
            const string emptyId = "";
            _roleRepositoryMock
                .Setup(r => r.GetByIdAsync(emptyId))
                .ReturnsAsync((RoleResponse?)null);

            // Act
            var act = () => _service.GetRoleAsync(emptyId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.RoleMessage.RoleNotFound);
            _roleRepositoryMock.Verify(r => r.GetByIdAsync(emptyId), Times.Once);
        }

        // UTCID04 (A): Throw NotFoundException when role does not exist
        [Fact]
        public async Task GetRoleAsync_ShouldThrowNotFound_WhenRoleDoesNotExist()
        {
            // Arrange
            const string missingId = "missing-role-id";
            _roleRepositoryMock
                .Setup(r => r.GetByIdAsync(missingId))
                .ReturnsAsync((RoleResponse?)null);

            // Act
            var act = () => _service.GetRoleAsync(missingId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.RoleMessage.RoleNotFound);
            _roleRepositoryMock.Verify(r => r.GetByIdAsync(missingId), Times.Once);
        }
    }
}

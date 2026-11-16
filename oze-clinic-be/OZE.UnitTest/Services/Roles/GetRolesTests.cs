using FluentAssertions;
using Moq;
using OZE.Common.Models;
using Xunit;

namespace OZE.UnitTest.Services.Roles
{
    // OZ-ROLE-01 GetRoles
    [Trait("Tab", "OZ-ROLE-01")]
    public class GetRolesTests : RoleTestBase
    {
        // UTCID01 (N): Return role list from repository when no filters are applied
        [Fact]
        public async Task GetRolesAsync_ShouldReturnRoles_WhenRepositoryReturnsRoles()
        {
            // Arrange
            var query = new RoleQueryRequest();
            var roles = new List<RoleResponse>
            {
                CreateSampleRoleResponse(),
                CreateSampleRoleResponse("role-2", "Nurse", "Phu ta", true, 1)
            };

            _roleRepositoryMock
                .Setup(r => r.GetAllAsync(query))
                .ReturnsAsync(roles);

            // Act
            var result = await _service.GetRolesAsync(query);

            // Assert
            result.Should().HaveCount(2);
            result[0].Id.Should().Be(ValidRoleId);
            result[0].Name.Should().Be(ValidRoleName);
            result[0].Description.Should().Be("Bac si");
            result[0].IsActive.Should().BeTrue();
            result[0].UserCount.Should().Be(2);
            result[1].Name.Should().Be("Nurse");
            result[1].UserCount.Should().Be(1);
            _roleRepositoryMock.Verify(r => r.GetAllAsync(query), Times.Once);
        }

        // UTCID02 (N): Forward Keyword and IsActive filters to repository
        [Fact]
        public async Task GetRolesAsync_ShouldPassQueryFiltersToRepository_WhenFiltersProvided()
        {
            // Arrange
            var query = new RoleQueryRequest
            {
                Keyword = "Doc",
                IsActive = true
            };
            var roles = new List<RoleResponse> { CreateSampleRoleResponse() };

            _roleRepositoryMock
                .Setup(r => r.GetAllAsync(query))
                .ReturnsAsync(roles);

            // Act
            var result = await _service.GetRolesAsync(query);

            // Assert
            result.Should().HaveCount(1);
            result[0].Name.Should().Be(ValidRoleName);
            _roleRepositoryMock.Verify(
                r => r.GetAllAsync(
                    It.Is<RoleQueryRequest>(q => q.Keyword == "Doc" && q.IsActive == true)),
                Times.Once);
        }

        // UTCID03 (N): Return empty list when repository returns no roles
        [Fact]
        public async Task GetRolesAsync_ShouldReturnEmptyList_WhenRepositoryReturnsNoRoles()
        {
            // Arrange
            var query = new RoleQueryRequest { Keyword = "KhongTonTai" };

            _roleRepositoryMock
                .Setup(r => r.GetAllAsync(query))
                .ReturnsAsync(new List<RoleResponse>());

            // Act
            var result = await _service.GetRolesAsync(query);

            // Assert
            result.Should().NotBeNull();
            result.Should().BeEmpty();
            _roleRepositoryMock.Verify(r => r.GetAllAsync(query), Times.Once);
        }

        // UTCID04 (B): Null/empty Keyword and null IsActive are forwarded unchanged
        [Fact]
        public async Task GetRolesAsync_ShouldForwardEmptyFilters_WhenKeywordAndIsActiveAreNullOrWhitespace()
        {
            // Arrange
            var query = new RoleQueryRequest
            {
                Keyword = "   ",
                IsActive = null
            };
            var roles = new List<RoleResponse> { CreateSampleRoleResponse() };

            _roleRepositoryMock
                .Setup(r => r.GetAllAsync(query))
                .ReturnsAsync(roles);

            // Act
            var result = await _service.GetRolesAsync(query);

            // Assert
            result.Should().HaveCount(1);
            _roleRepositoryMock.Verify(
                r => r.GetAllAsync(
                    It.Is<RoleQueryRequest>(q => q.Keyword == "   " && q.IsActive == null)),
                Times.Once);
        }
    }
}

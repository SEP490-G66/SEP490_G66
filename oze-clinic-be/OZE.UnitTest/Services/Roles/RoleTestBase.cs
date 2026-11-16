using Microsoft.AspNetCore.Identity;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.UnitTest.Services.Roles
{
    // Shared mocks, setup and sample data for Roles service tests. Holds no tests itself.
    public abstract class RoleTestBase
    {
        protected readonly Mock<RoleManager<ApplicationRole>> _roleManagerMock;
        protected readonly Mock<IRoleRepository> _roleRepositoryMock;
        protected readonly RoleService _service;

        protected const string ValidRoleId = "role-1";
        protected const string ValidRoleName = "Doctor";

        protected RoleTestBase()
        {
            _roleManagerMock = new Mock<RoleManager<ApplicationRole>>(
                Mock.Of<IRoleStore<ApplicationRole>>(),
                null!,
                null!,
                null!,
                null!);
            _roleRepositoryMock = new Mock<IRoleRepository>();

            _service = new RoleService(_roleManagerMock.Object, _roleRepositoryMock.Object);
        }

        protected static RoleResponse CreateSampleRoleResponse(
            string id = ValidRoleId,
            string name = ValidRoleName,
            string? description = "Bac si",
            bool isActive = true,
            int userCount = 2)
        {
            return new RoleResponse
            {
                Id = id,
                Name = name,
                Description = description,
                IsActive = isActive,
                UserCount = userCount,
                CreatedAt = DateTimeOffset.Parse("2026-11-01T00:00:00Z"),
                UpdatedAt = null
            };
        }
    }
}

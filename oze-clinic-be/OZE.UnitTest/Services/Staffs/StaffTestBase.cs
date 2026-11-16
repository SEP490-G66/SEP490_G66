using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.UnitTest.Services.Staffs
{
    // Shared mocks, setup and sample data for Staffs service tests. Holds no tests itself.
    public abstract class StaffTestBase
    {
        protected readonly Mock<UserManager<ApplicationUser>> _userManagerMock;
        protected readonly Mock<IStaffRepository> _staffRepositoryMock;
        protected readonly Mock<IRegistrationRepository> _registrationRepositoryMock;
        protected readonly Mock<IUserRefreshTokenRepository> _refreshTokenRepositoryMock;
        protected readonly Mock<IEmailSender> _emailSenderMock;
        protected readonly StaffService _service;

        protected const string ValidUserId = "staff-user-1";
        protected const string ValidFullName = "Nguyen Van A";

        protected StaffTestBase()
        {
            _userManagerMock = new Mock<UserManager<ApplicationUser>>(
                Mock.Of<IUserStore<ApplicationUser>>(),
                null!, null!, null!, null!, null!, null!, null!, null!);
            _staffRepositoryMock = new Mock<IStaffRepository>();
            _registrationRepositoryMock = new Mock<IRegistrationRepository>();
            _refreshTokenRepositoryMock = new Mock<IUserRefreshTokenRepository>();
            _emailSenderMock = new Mock<IEmailSender>();

            _service = new StaffService(
                _userManagerMock.Object,
                _staffRepositoryMock.Object,
                _registrationRepositoryMock.Object,
                _refreshTokenRepositoryMock.Object,
                _emailSenderMock.Object,
                Mock.Of<ILogger<StaffService>>());
        }

        protected static StaffResponse CreateSampleStaffResponse(
            string userId = ValidUserId,
            string fullName = ValidFullName,
            string? email = "doctor@oze.vn",
            string? phoneNumber = "+84912345678",
            string? role = RoleConstants.DoctorRole,
            string? specialization = "Nha khoa tong quat",
            string? licenseNumber = "BS-001",
            bool isActive = true)
        {
            return new StaffResponse
            {
                UserId = userId,
                FullName = fullName,
                Email = email,
                PhoneNumber = phoneNumber,
                DateOfBirth = DateOnly.Parse("1990-01-15"),
                Gender = "Male",
                Role = role,
                Specialization = specialization,
                LicenseNumber = licenseNumber,
                HireDate = DateOnly.Parse("2024-01-01"),
                IsActive = isActive,
                UpdatedAt = null
            };
        }

        protected static ApplicationUser CreateSampleUser(
            string userId = ValidUserId,
            string? email = "doctor@oze.vn",
            string? phoneNumber = "+84912345678")
        {
            return new ApplicationUser
            {
                Id = userId,
                UserName = email,
                Email = email,
                PhoneNumber = phoneNumber
            };
        }

        protected static StaffProfile CreateSampleStaffProfile(
            string userId = ValidUserId,
            string fullName = ValidFullName,
            string? phoneNumber = "+84912345678",
            string? specialization = "Nha khoa tong quat",
            string? licenseNumber = "BS-001",
            bool isActive = true)
        {
            return new StaffProfile
            {
                Id = 1,
                UserId = userId,
                FullName = fullName,
                PhoneNumber = phoneNumber,
                DateOfBirth = DateOnly.Parse("1990-01-15"),
                Gender = "Male",
                Specialization = specialization,
                LicenseNumber = licenseNumber,
                HireDate = DateOnly.Parse("2024-01-01"),
                IsActive = isActive,
                CreatedAt = DateTimeOffset.Parse("2024-01-01T00:00:00Z"),
                UpdatedAt = null
            };
        }
    }
}

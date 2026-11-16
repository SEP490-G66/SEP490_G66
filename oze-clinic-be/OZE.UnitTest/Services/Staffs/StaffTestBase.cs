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
        protected const string ManagerUserId = "manager-user-1";
        protected const string ValidFullName = "Nguyen Van A";
        protected const string ValidStaffEmail = "doctor@oze.vn";
        protected const string ValidLocalPhone = "0912345678";
        protected const string ValidE164Phone = "+84912345678";

        protected StaffTestBase()
        {
            _userManagerMock = new Mock<UserManager<ApplicationUser>>(
                Mock.Of<IUserStore<ApplicationUser>>(),
                null!, null!, null!, null!, null!, null!, null!, null!);
            _staffRepositoryMock = new Mock<IStaffRepository>();
            _registrationRepositoryMock = new Mock<IRegistrationRepository>();
            _refreshTokenRepositoryMock = new Mock<IUserRefreshTokenRepository>();
            _emailSenderMock = new Mock<IEmailSender>();

            // The transaction just runs the work it is given, whatever its result type
            _registrationRepositoryMock
                .Setup(r => r.ExecuteInTransactionAsync(It.IsAny<Func<Task<It.IsAnyType>>>(), It.IsAny<Func<It.IsAnyType, bool>>()))
                .Returns(new InvocationFunc(invocation => ((Delegate)invocation.Arguments[0]).DynamicInvoke()!));

            _service = new StaffService(
                _userManagerMock.Object,
                _staffRepositoryMock.Object,
                _registrationRepositoryMock.Object,
                _refreshTokenRepositoryMock.Object,
                _emailSenderMock.Object,
                Mock.Of<ILogger<StaffService>>());
        }

        protected void SetupCreateUniquenessPasses()
        {
            _userManagerMock
                .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
                .ReturnsAsync((ApplicationUser?)null);
            _registrationRepositoryMock
                .Setup(r => r.FindUserByPhoneAsync(It.IsAny<IReadOnlyCollection<string>>()))
                .ReturnsAsync((ApplicationUser?)null);
            _staffRepositoryMock
                .Setup(r => r.IsLicenseNumberInUseAsync(It.IsAny<string>(), 0))
                .ReturnsAsync(false);
        }

        protected void SetupCreateAccountSucceeds()
        {
            _userManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Success);
            _userManagerMock
                .Setup(m => m.AddToRoleAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Success);
            _emailSenderMock
                .Setup(e => e.SendTemporaryPasswordAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);
        }

        protected (ApplicationUser User, StaffProfile Staff) SetupExistingStaff(
            string userId = ValidUserId,
            string role = RoleConstants.DoctorRole,
            string? email = ValidStaffEmail,
            string? phoneNumber = ValidE164Phone,
            string fullName = ValidFullName,
            string? specialization = "Nha khoa tong quat",
            string? licenseNumber = "BS-001")
        {
            var user = CreateSampleUser(userId, email, phoneNumber);
            user.EmailConfirmed = true;
            user.PhoneNumberConfirmed = true;
            var staff = CreateSampleStaffProfile(
                userId,
                fullName,
                phoneNumber,
                specialization,
                licenseNumber);

            _userManagerMock
                .Setup(m => m.FindByIdAsync(userId))
                .ReturnsAsync(user);
            _staffRepositoryMock
                .Setup(r => r.GetByUserIdAsync(userId))
                .ReturnsAsync(staff);
            _userManagerMock
                .Setup(m => m.GetRolesAsync(user))
                .ReturnsAsync(new List<string> { role });

            return (user, staff);
        }

        protected void SetupUpdateUniquenessPasses(int staffId = 1)
        {
            _userManagerMock
                .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
                .ReturnsAsync((ApplicationUser?)null);
            _registrationRepositoryMock
                .Setup(r => r.FindUserByPhoneAsync(It.IsAny<IReadOnlyCollection<string>>()))
                .ReturnsAsync((ApplicationUser?)null);
            _staffRepositoryMock
                .Setup(r => r.IsLicenseNumberInUseAsync(It.IsAny<string>(), staffId))
                .ReturnsAsync(false);
        }

        protected void SetupUpdateSaveSucceeds()
        {
            _userManagerMock
                .Setup(m => m.UpdateAsync(It.IsAny<ApplicationUser>()))
                .ReturnsAsync(IdentityResult.Success);
            _userManagerMock
                .Setup(m => m.RemoveFromRoleAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Success);
            _userManagerMock
                .Setup(m => m.AddToRoleAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Success);
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

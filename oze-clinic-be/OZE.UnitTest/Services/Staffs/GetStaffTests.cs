using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Staffs
{
    // OZ-STAFF-02 GetStaff
    [Trait("Tab", "OZ-STAFF-02")]
    public class GetStaffTests : StaffTestBase
    {
        // UTCID01 (N): Return mapped staff when user and staff profile exist
        [Fact]
        public async Task GetStaffAsync_ShouldReturnStaff_WhenUserAndProfileExist()
        {
            // Arrange
            var user = CreateSampleUser();
            var staff = CreateSampleStaffProfile();

            _userManagerMock
                .Setup(m => m.FindByIdAsync(ValidUserId))
                .ReturnsAsync(user);
            _staffRepositoryMock
                .Setup(r => r.GetByUserIdAsync(ValidUserId))
                .ReturnsAsync(staff);
            _userManagerMock
                .Setup(m => m.GetRolesAsync(user))
                .ReturnsAsync(new List<string> { RoleConstants.DoctorRole });

            // Act
            var result = await _service.GetStaffAsync(ValidUserId);

            // Assert
            result.UserId.Should().Be(ValidUserId);
            result.FullName.Should().Be(ValidFullName);
            result.Email.Should().Be("doctor@oze.vn");
            result.PhoneNumber.Should().Be("+84912345678");
            result.DateOfBirth.Should().Be(DateOnly.Parse("1990-01-15"));
            result.Gender.Should().Be("Male");
            result.Role.Should().Be(RoleConstants.DoctorRole);
            result.Specialization.Should().Be("Nha khoa tong quat");
            result.LicenseNumber.Should().Be("BS-001");
            result.HireDate.Should().Be(DateOnly.Parse("2024-01-01"));
            result.IsActive.Should().BeTrue();
            result.UpdatedAt.Should().BeNull();
            _staffRepositoryMock.Verify(r => r.GetByUserIdAsync(ValidUserId), Times.Once);
            _userManagerMock.Verify(m => m.GetRolesAsync(user), Times.Once);
        }

        // UTCID02 (N): Map null optional fields and fall back to staff phone when user phone is null
        [Fact]
        public async Task GetStaffAsync_ShouldMapOptionalFields_WhenReceptionistInactiveAndUserPhoneNull()
        {
            // Arrange
            var user = CreateSampleUser(
                userId: "staff-user-2",
                email: "reception@oze.vn",
                phoneNumber: null);
            var staff = CreateSampleStaffProfile(
                userId: "staff-user-2",
                fullName: "Tran Thi B",
                phoneNumber: "+84987654321",
                specialization: null,
                licenseNumber: null,
                isActive: false);
            staff.UpdatedAt = DateTimeOffset.Parse("2026-11-10T08:00:00Z");

            _userManagerMock
                .Setup(m => m.FindByIdAsync("staff-user-2"))
                .ReturnsAsync(user);
            _staffRepositoryMock
                .Setup(r => r.GetByUserIdAsync("staff-user-2"))
                .ReturnsAsync(staff);
            _userManagerMock
                .Setup(m => m.GetRolesAsync(user))
                .ReturnsAsync(new List<string> { RoleConstants.ReceptionistRole });

            // Act
            var result = await _service.GetStaffAsync("staff-user-2");

            // Assert
            result.UserId.Should().Be("staff-user-2");
            result.FullName.Should().Be("Tran Thi B");
            result.Email.Should().Be("reception@oze.vn");
            result.PhoneNumber.Should().Be("+84987654321");
            result.Role.Should().Be(RoleConstants.ReceptionistRole);
            result.Specialization.Should().BeNull();
            result.LicenseNumber.Should().BeNull();
            result.IsActive.Should().BeFalse();
            result.UpdatedAt.Should().Be(staff.UpdatedAt);
        }

        // UTCID03 (B): Empty string userId yields NotFound when user is not found
        [Fact]
        public async Task GetStaffAsync_ShouldThrowNotFound_WhenUserIdIsEmptyStringBoundary()
        {
            // Arrange
            const string emptyId = "";
            _userManagerMock
                .Setup(m => m.FindByIdAsync(emptyId))
                .ReturnsAsync((ApplicationUser?)null);

            // Act
            var act = () => _service.GetStaffAsync(emptyId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.StaffNotFound);
            _staffRepositoryMock.Verify(r => r.GetByUserIdAsync(It.IsAny<string>()), Times.Never);
        }

        // UTCID04 (A): Throw NotFoundException when staff profile does not exist
        [Fact]
        public async Task GetStaffAsync_ShouldThrowNotFound_WhenStaffProfileDoesNotExist()
        {
            // Arrange
            const string missingId = "missing-staff-id";
            var user = CreateSampleUser(userId: missingId);

            _userManagerMock
                .Setup(m => m.FindByIdAsync(missingId))
                .ReturnsAsync(user);
            _staffRepositoryMock
                .Setup(r => r.GetByUserIdAsync(missingId))
                .ReturnsAsync((StaffProfile?)null);

            // Act
            var act = () => _service.GetStaffAsync(missingId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.StaffNotFound);
            _userManagerMock.Verify(m => m.GetRolesAsync(It.IsAny<ApplicationUser>()), Times.Never);
        }

        // UTCID05 (A): Throw NotFoundException when account has Patient role
        [Fact]
        public async Task GetStaffAsync_ShouldThrowNotFound_WhenUserHasPatientRole()
        {
            // Arrange
            var user = CreateSampleUser(userId: "patient-user-1", email: "patient@oze.vn");
            var staff = CreateSampleStaffProfile(userId: "patient-user-1", fullName: "Patient X");

            _userManagerMock
                .Setup(m => m.FindByIdAsync("patient-user-1"))
                .ReturnsAsync(user);
            _staffRepositoryMock
                .Setup(r => r.GetByUserIdAsync("patient-user-1"))
                .ReturnsAsync(staff);
            _userManagerMock
                .Setup(m => m.GetRolesAsync(user))
                .ReturnsAsync(new List<string> { RoleConstants.PatientRole });

            // Act
            var act = () => _service.GetStaffAsync("patient-user-1");

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.StaffNotFound);
        }
    }
}

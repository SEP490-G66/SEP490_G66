using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Staffs
{
    // OZ-STAFF-06 ActivateStaff
    [Trait("Tab", "OZ-STAFF-06")]
    public class ActivateStaffTests : StaffTestBase
    {
        // UTCID01 (N): Activate inactive Doctor successfully; clear lockout and AccessFailedCount
        [Fact]
        public async Task ActivateStaffAsync_ShouldActivateStaff_WhenStaffIsInactive()
        {
            // Arrange
            var (user, staff) = SetupExistingStaff(role: RoleConstants.DoctorRole);
            staff.IsActive = false;
            user.LockoutEnabled = true;
            user.LockoutEnd = DateTimeOffset.MaxValue;
            user.AccessFailedCount = 3;
            _userManagerMock
                .Setup(m => m.UpdateAsync(user))
                .ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await _service.ActivateStaffAsync(ValidUserId);

            // Assert
            result.UserId.Should().Be(ValidUserId);
            result.IsActive.Should().BeTrue();
            result.Role.Should().Be(RoleConstants.DoctorRole);
            result.UpdatedAt.Should().NotBeNull();
            staff.IsActive.Should().BeTrue();
            user.LockoutEnd.Should().BeNull();
            user.AccessFailedCount.Should().Be(0);
            _userManagerMock.Verify(m => m.UpdateAsync(user), Times.Once);
        }

        // UTCID02 (N): Activate inactive Receptionist successfully
        [Fact]
        public async Task ActivateStaffAsync_ShouldActivateReceptionist_WhenStaffIsInactive()
        {
            // Arrange
            var (user, staff) = SetupExistingStaff(
                role: RoleConstants.ReceptionistRole,
                email: "reception@oze.vn",
                specialization: null,
                licenseNumber: null);
            staff.IsActive = false;
            user.LockoutEnd = DateTimeOffset.MaxValue;
            _userManagerMock
                .Setup(m => m.UpdateAsync(user))
                .ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await _service.ActivateStaffAsync(ValidUserId);

            // Assert
            result.IsActive.Should().BeTrue();
            result.Role.Should().Be(RoleConstants.ReceptionistRole);
            result.Specialization.Should().BeNull();
            result.LicenseNumber.Should().BeNull();
            staff.IsActive.Should().BeTrue();
            user.LockoutEnd.Should().BeNull();
        }

        // UTCID03 (B): Empty string userId yields NotFound when user is not found
        [Fact]
        public async Task ActivateStaffAsync_ShouldThrowNotFound_WhenUserIdIsEmptyStringBoundary()
        {
            // Arrange
            const string emptyId = "";
            _userManagerMock
                .Setup(m => m.FindByIdAsync(emptyId))
                .ReturnsAsync((ApplicationUser?)null);

            // Act
            var act = () => _service.ActivateStaffAsync(emptyId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.StaffNotFound);
            _userManagerMock.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        }

        // UTCID04 (A): Unknown userId yields StaffNotFound
        [Fact]
        public async Task ActivateStaffAsync_ShouldThrowNotFound_WhenUserDoesNotExist()
        {
            // Arrange
            const string missingId = "missing-user";
            _userManagerMock
                .Setup(m => m.FindByIdAsync(missingId))
                .ReturnsAsync((ApplicationUser?)null);

            // Act
            var act = () => _service.ActivateStaffAsync(missingId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.StaffNotFound);
        }

        // UTCID05 (A): User without staff profile yields StaffNotFound
        [Fact]
        public async Task ActivateStaffAsync_ShouldThrowNotFound_WhenStaffProfileMissing()
        {
            // Arrange
            var user = CreateSampleUser();
            _userManagerMock
                .Setup(m => m.FindByIdAsync(ValidUserId))
                .ReturnsAsync(user);
            _staffRepositoryMock
                .Setup(r => r.GetByUserIdAsync(ValidUserId))
                .ReturnsAsync((StaffProfile?)null);

            // Act
            var act = () => _service.ActivateStaffAsync(ValidUserId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.StaffNotFound);
            _userManagerMock.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        }

        // UTCID06 (A): Patient role is not treated as staff
        [Fact]
        public async Task ActivateStaffAsync_ShouldThrowNotFound_WhenUserIsPatient()
        {
            // Arrange
            var user = CreateSampleUser();
            var staff = CreateSampleStaffProfile(isActive: false);
            _userManagerMock
                .Setup(m => m.FindByIdAsync(ValidUserId))
                .ReturnsAsync(user);
            _staffRepositoryMock
                .Setup(r => r.GetByUserIdAsync(ValidUserId))
                .ReturnsAsync(staff);
            _userManagerMock
                .Setup(m => m.GetRolesAsync(user))
                .ReturnsAsync(new List<string> { RoleConstants.PatientRole });

            // Act
            var act = () => _service.ActivateStaffAsync(ValidUserId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.StaffNotFound);
            _userManagerMock.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        }

        // UTCID07 (A): Already active staff throws BadRequestException
        [Fact]
        public async Task ActivateStaffAsync_ShouldThrowBadRequest_WhenStaffAlreadyActive()
        {
            // Arrange
            SetupExistingStaff(role: RoleConstants.DoctorRole);

            // Act
            var act = () => _service.ActivateStaffAsync(ValidUserId);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.AlreadyActive);
            _userManagerMock.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        }

        // UTCID08 (A): Identity UpdateAsync failure throws BadRequestException with UpdateFailed fallback
        [Fact]
        public async Task ActivateStaffAsync_ShouldThrowBadRequest_WhenIdentityUpdateFails()
        {
            // Arrange
            var (user, staff) = SetupExistingStaff(role: RoleConstants.DoctorRole);
            staff.IsActive = false;
            _userManagerMock
                .Setup(m => m.UpdateAsync(user))
                .ReturnsAsync(IdentityResult.Failed());

            // Act
            var act = () => _service.ActivateStaffAsync(ValidUserId);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.UpdateFailed);
        }
    }
}

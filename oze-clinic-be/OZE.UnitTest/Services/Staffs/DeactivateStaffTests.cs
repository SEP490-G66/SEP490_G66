using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Staffs
{
    // OZ-STAFF-05 DeactivateStaff
    [Trait("Tab", "OZ-STAFF-05")]
    public class DeactivateStaffTests : StaffTestBase
    {
        // UTCID01 (N): Deactivate active Doctor successfully; lock account and revoke tokens
        [Fact]
        public async Task DeactivateStaffAsync_ShouldDeactivateStaff_WhenStaffIsActive()
        {
            // Arrange
            var (user, staff) = SetupExistingStaff(role: RoleConstants.DoctorRole);
            _staffRepositoryMock
                .Setup(r => r.HasUpcomingWorkAsync(1, It.IsAny<DateOnly>(), It.IsAny<TimeOnly>()))
                .ReturnsAsync(false);
            _refreshTokenRepositoryMock
                .Setup(r => r.RevokeUserTokensAsync(ValidUserId))
                .Returns(Task.CompletedTask);
            _userManagerMock
                .Setup(m => m.UpdateAsync(user))
                .ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await _service.DeactivateStaffAsync(ValidUserId, ManagerUserId);

            // Assert
            result.UserId.Should().Be(ValidUserId);
            result.IsActive.Should().BeFalse();
            result.Role.Should().Be(RoleConstants.DoctorRole);
            result.UpdatedAt.Should().NotBeNull();
            staff.IsActive.Should().BeFalse();
            user.LockoutEnabled.Should().BeTrue();
            user.LockoutEnd.Should().Be(DateTimeOffset.MaxValue);
            user.SecurityStamp.Should().NotBeNullOrEmpty();

            _refreshTokenRepositoryMock.Verify(r => r.RevokeUserTokensAsync(ValidUserId), Times.Once);
            _userManagerMock.Verify(m => m.UpdateAsync(user), Times.Once);
        }

        // UTCID02 (N): Deactivate ClinicManager when more than one active manager remains
        [Fact]
        public async Task DeactivateStaffAsync_ShouldDeactivateManager_WhenAnotherManagerRemains()
        {
            // Arrange
            var (user, _) = SetupExistingStaff(
                role: RoleConstants.ClinicManagerRole,
                email: "manager2@oze.vn",
                specialization: null,
                licenseNumber: null);
            _staffRepositoryMock
                .Setup(r => r.HasUpcomingWorkAsync(1, It.IsAny<DateOnly>(), It.IsAny<TimeOnly>()))
                .ReturnsAsync(false);
            _staffRepositoryMock
                .Setup(r => r.CountActiveStaffInRoleAsync(RoleConstants.ClinicManagerRole))
                .ReturnsAsync(2);
            _refreshTokenRepositoryMock
                .Setup(r => r.RevokeUserTokensAsync(ValidUserId))
                .Returns(Task.CompletedTask);
            _userManagerMock
                .Setup(m => m.UpdateAsync(user))
                .ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await _service.DeactivateStaffAsync(ValidUserId, ManagerUserId);

            // Assert
            result.IsActive.Should().BeFalse();
            result.Role.Should().Be(RoleConstants.ClinicManagerRole);
            _staffRepositoryMock.Verify(
                r => r.CountActiveStaffInRoleAsync(RoleConstants.ClinicManagerRole),
                Times.Once);
        }

        // UTCID03 (B): Empty string userId yields NotFound when user is not found
        [Fact]
        public async Task DeactivateStaffAsync_ShouldThrowNotFound_WhenUserIdIsEmptyStringBoundary()
        {
            // Arrange
            const string emptyId = "";
            _userManagerMock
                .Setup(m => m.FindByIdAsync(emptyId))
                .ReturnsAsync((ApplicationUser?)null);

            // Act
            var act = () => _service.DeactivateStaffAsync(emptyId, ManagerUserId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.StaffNotFound);
            _refreshTokenRepositoryMock.Verify(r => r.RevokeUserTokensAsync(It.IsAny<string>()), Times.Never);
        }

        // UTCID04 (A): Manager cannot deactivate themselves
        [Fact]
        public async Task DeactivateStaffAsync_ShouldThrowBadRequest_WhenManagerDeactivatesSelf()
        {
            // Arrange
            SetupExistingStaff(userId: ManagerUserId, role: RoleConstants.ClinicManagerRole);

            // Act
            var act = () => _service.DeactivateStaffAsync(ManagerUserId, ManagerUserId);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.CannotDeactivateSelf);
            _refreshTokenRepositoryMock.Verify(r => r.RevokeUserTokensAsync(It.IsAny<string>()), Times.Never);
        }

        // UTCID05 (A): Already inactive staff throws BadRequestException
        [Fact]
        public async Task DeactivateStaffAsync_ShouldThrowBadRequest_WhenStaffAlreadyInactive()
        {
            // Arrange
            var (_, staff) = SetupExistingStaff(role: RoleConstants.DoctorRole);
            staff.IsActive = false;

            // Act
            var act = () => _service.DeactivateStaffAsync(ValidUserId, ManagerUserId);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.AlreadyInactive);
            _refreshTokenRepositoryMock.Verify(r => r.RevokeUserTokensAsync(It.IsAny<string>()), Times.Never);
        }

        // UTCID06 (A): Upcoming work blocks deactivation
        [Fact]
        public async Task DeactivateStaffAsync_ShouldThrowBadRequest_WhenStaffHasUpcomingWork()
        {
            // Arrange
            SetupExistingStaff(role: RoleConstants.DoctorRole);
            _staffRepositoryMock
                .Setup(r => r.HasUpcomingWorkAsync(1, It.IsAny<DateOnly>(), It.IsAny<TimeOnly>()))
                .ReturnsAsync(true);

            // Act
            var act = () => _service.DeactivateStaffAsync(ValidUserId, ManagerUserId);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.HasUpcomingWork);
            _refreshTokenRepositoryMock.Verify(r => r.RevokeUserTokensAsync(It.IsAny<string>()), Times.Never);
        }

        // UTCID07 (A): Last ClinicManager cannot be deactivated
        [Fact]
        public async Task DeactivateStaffAsync_ShouldThrowBadRequest_WhenDeactivatingLastManager()
        {
            // Arrange
            SetupExistingStaff(
                role: RoleConstants.ClinicManagerRole,
                specialization: null,
                licenseNumber: null);
            _staffRepositoryMock
                .Setup(r => r.HasUpcomingWorkAsync(1, It.IsAny<DateOnly>(), It.IsAny<TimeOnly>()))
                .ReturnsAsync(false);
            _staffRepositoryMock
                .Setup(r => r.CountActiveStaffInRoleAsync(RoleConstants.ClinicManagerRole))
                .ReturnsAsync(1);

            // Act
            var act = () => _service.DeactivateStaffAsync(ValidUserId, ManagerUserId);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.LastManager);
            _refreshTokenRepositoryMock.Verify(r => r.RevokeUserTokensAsync(It.IsAny<string>()), Times.Never);
        }

        // UTCID08 (A): Identity UpdateAsync failure throws BadRequestException with UpdateFailed fallback
        [Fact]
        public async Task DeactivateStaffAsync_ShouldThrowBadRequest_WhenIdentityUpdateFails()
        {
            // Arrange
            var (user, _) = SetupExistingStaff(role: RoleConstants.DoctorRole);
            _staffRepositoryMock
                .Setup(r => r.HasUpcomingWorkAsync(1, It.IsAny<DateOnly>(), It.IsAny<TimeOnly>()))
                .ReturnsAsync(false);
            _refreshTokenRepositoryMock
                .Setup(r => r.RevokeUserTokensAsync(ValidUserId))
                .Returns(Task.CompletedTask);
            _userManagerMock
                .Setup(m => m.UpdateAsync(user))
                .ReturnsAsync(IdentityResult.Failed());

            // Act
            var act = () => _service.DeactivateStaffAsync(ValidUserId, ManagerUserId);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.UpdateFailed);
        }
    }
}

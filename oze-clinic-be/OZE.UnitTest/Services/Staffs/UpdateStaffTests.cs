using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Staffs
{
    // OZ-STAFF-04 UpdateStaff
    [Trait("Tab", "OZ-STAFF-04")]
    public class UpdateStaffTests : StaffTestBase
    {
        // UTCID01 (N): Update Doctor profile successfully without changing role
        [Fact]
        public async Task UpdateStaffAsync_ShouldUpdateProfile_WhenRequestIsValid()
        {
            // Arrange
            SetupExistingStaff();
            SetupUpdateUniquenessPasses();
            SetupUpdateSaveSucceeds();

            var request = new UpdateStaffRequest
            {
                FullName = "Nguyen Van B",
                Email = ValidStaffEmail,
                PhoneNumber = ValidLocalPhone,
                Role = RoleConstants.DoctorRole,
                Specialization = "Chinh nha",
                LicenseNumber = "BS-002"
            };

            // Act
            var result = await _service.UpdateStaffAsync(ValidUserId, request, ManagerUserId);

            // Assert
            result.UserId.Should().Be(ValidUserId);
            result.FullName.Should().Be("Nguyen Van B");
            result.Email.Should().Be(ValidStaffEmail);
            result.PhoneNumber.Should().Be(ValidE164Phone);
            result.Role.Should().Be(RoleConstants.DoctorRole);
            result.Specialization.Should().Be("Chinh nha");
            result.LicenseNumber.Should().Be("BS-002");
            result.UpdatedAt.Should().NotBeNull();

            _userManagerMock.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Once);
            _userManagerMock.Verify(m => m.RemoveFromRoleAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()), Times.Never);
            _userManagerMock.Verify(m => m.AddToRoleAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()), Times.Never);
            _staffRepositoryMock.Verify(
                r => r.HasUpcomingWorkAsync(It.IsAny<int>(), It.IsAny<DateOnly>(), It.IsAny<TimeOnly>()),
                Times.Never);
        }

        // UTCID02 (N): Change role to Receptionist clears doctor fields and swaps roles
        [Fact]
        public async Task UpdateStaffAsync_ShouldChangeRoleAndClearDoctorFields_WhenRoleBecomesReceptionist()
        {
            // Arrange
            SetupExistingStaff(role: RoleConstants.DoctorRole);
            SetupUpdateUniquenessPasses();
            SetupUpdateSaveSucceeds();
            _staffRepositoryMock
                .Setup(r => r.HasUpcomingWorkAsync(1, It.IsAny<DateOnly>(), It.IsAny<TimeOnly>()))
                .ReturnsAsync(false);

            var request = new UpdateStaffRequest
            {
                FullName = ValidFullName,
                Email = ValidStaffEmail,
                PhoneNumber = ValidLocalPhone,
                Role = RoleConstants.ReceptionistRole,
                Specialization = "Ignored",
                LicenseNumber = "Ignored"
            };

            // Act
            var result = await _service.UpdateStaffAsync(ValidUserId, request, ManagerUserId);

            // Assert
            result.Role.Should().Be(RoleConstants.ReceptionistRole);
            result.Specialization.Should().BeNull();
            result.LicenseNumber.Should().BeNull();
            _userManagerMock.Verify(m => m.RemoveFromRoleAsync(It.IsAny<ApplicationUser>(), RoleConstants.DoctorRole), Times.Once);
            _userManagerMock.Verify(m => m.AddToRoleAsync(It.IsAny<ApplicationUser>(), RoleConstants.ReceptionistRole), Times.Once);
        }

        // UTCID03 (B): FullName, Email, Specialization and LicenseNumber are trimmed
        [Fact]
        public async Task UpdateStaffAsync_ShouldTrimTextFields_WhenValuesHaveSurroundingWhitespace()
        {
            // Arrange
            SetupExistingStaff();
            SetupUpdateUniquenessPasses();
            SetupUpdateSaveSucceeds();

            var request = new UpdateStaffRequest
            {
                FullName = "  Nguyen Van A  ",
                Email = "  doctor@oze.vn  ",
                PhoneNumber = ValidLocalPhone,
                Role = RoleConstants.DoctorRole,
                Specialization = "  Nha khoa tong quat  ",
                LicenseNumber = "  BS-001  "
            };

            // Act
            var result = await _service.UpdateStaffAsync(ValidUserId, request, ManagerUserId);

            // Assert
            result.FullName.Should().Be(ValidFullName);
            result.Email.Should().Be(ValidStaffEmail);
            result.Specialization.Should().Be("Nha khoa tong quat");
            result.LicenseNumber.Should().Be("BS-001");
            _userManagerMock.Verify(m => m.FindByEmailAsync(ValidStaffEmail), Times.Once);
        }

        // UTCID04 (A): Missing staff throws NotFoundException
        [Fact]
        public async Task UpdateStaffAsync_ShouldThrowNotFound_WhenStaffDoesNotExist()
        {
            // Arrange
            const string missingId = "missing-staff-id";
            _userManagerMock
                .Setup(m => m.FindByIdAsync(missingId))
                .ReturnsAsync((ApplicationUser?)null);

            var request = ValidDoctorUpdateRequest();

            // Act
            var act = () => _service.UpdateStaffAsync(missingId, request, ManagerUserId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.StaffNotFound);
            _userManagerMock.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        }

        // UTCID05 (A): Invalid phone throws BadRequestException
        [Fact]
        public async Task UpdateStaffAsync_ShouldThrowBadRequest_WhenPhoneIsInvalid()
        {
            // Arrange
            SetupExistingStaff();
            var request = ValidDoctorUpdateRequest();
            request.PhoneNumber = "abc";

            // Act
            var act = () => _service.UpdateStaffAsync(ValidUserId, request, ManagerUserId);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.AuthMessage.InvalidPhone);
            _userManagerMock.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        }

        // UTCID06 (A): Manager cannot change their own role
        [Fact]
        public async Task UpdateStaffAsync_ShouldThrowBadRequest_WhenManagerChangesOwnRole()
        {
            // Arrange
            SetupExistingStaff(userId: ManagerUserId, role: RoleConstants.ClinicManagerRole);
            var request = new UpdateStaffRequest
            {
                FullName = ValidFullName,
                Email = "manager@oze.vn",
                PhoneNumber = ValidLocalPhone,
                Role = RoleConstants.DoctorRole,
                Specialization = "Nha khoa",
                LicenseNumber = "BS-009"
            };

            // Act
            var act = () => _service.UpdateStaffAsync(ManagerUserId, request, ManagerUserId);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.CannotChangeOwnRole);
            _userManagerMock.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        }

        // UTCID07 (A): Role change blocked when staff has upcoming work
        [Fact]
        public async Task UpdateStaffAsync_ShouldThrowBadRequest_WhenRoleChangeHasUpcomingWork()
        {
            // Arrange
            SetupExistingStaff(role: RoleConstants.DoctorRole);
            _staffRepositoryMock
                .Setup(r => r.HasUpcomingWorkAsync(1, It.IsAny<DateOnly>(), It.IsAny<TimeOnly>()))
                .ReturnsAsync(true);

            var request = new UpdateStaffRequest
            {
                FullName = ValidFullName,
                Email = ValidStaffEmail,
                PhoneNumber = ValidLocalPhone,
                Role = RoleConstants.ReceptionistRole
            };

            // Act
            var act = () => _service.UpdateStaffAsync(ValidUserId, request, ManagerUserId);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.HasUpcomingWork);
            _userManagerMock.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        }

        // UTCID08 (A): Identity UpdateAsync failure throws BadRequestException with UpdateFailed fallback
        [Fact]
        public async Task UpdateStaffAsync_ShouldThrowBadRequest_WhenIdentityUpdateFails()
        {
            // Arrange
            SetupExistingStaff();
            SetupUpdateUniquenessPasses();
            _userManagerMock
                .Setup(m => m.UpdateAsync(It.IsAny<ApplicationUser>()))
                .ReturnsAsync(IdentityResult.Failed());

            var request = ValidDoctorUpdateRequest();

            // Act
            var act = () => _service.UpdateStaffAsync(ValidUserId, request, ManagerUserId);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.UpdateFailed);
        }

        private static UpdateStaffRequest ValidDoctorUpdateRequest()
        {
            return new UpdateStaffRequest
            {
                FullName = ValidFullName,
                Email = ValidStaffEmail,
                PhoneNumber = ValidLocalPhone,
                Role = RoleConstants.DoctorRole,
                Specialization = "Nha khoa tong quat",
                LicenseNumber = "BS-001"
            };
        }
    }
}

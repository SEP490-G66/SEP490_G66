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
    // OZ-STAFF-03 CreateStaff
    [Trait("Tab", "OZ-STAFF-03")]
    public class CreateStaffTests : StaffTestBase
    {
        // UTCID01 (N): Create Doctor successfully with specialization and license
        [Fact]
        public async Task CreateStaffAsync_ShouldCreateDoctor_WhenRequestIsValid()
        {
            // Arrange
            var request = ValidDoctorRequest();
            SetupCreateUniquenessPasses();
            SetupCreateAccountSucceeds();

            // Act
            var result = await _service.CreateStaffAsync(request);

            // Assert
            result.FullName.Should().Be(ValidFullName);
            result.Email.Should().Be(ValidStaffEmail);
            result.PhoneNumber.Should().Be(ValidE164Phone);
            result.Role.Should().Be(RoleConstants.DoctorRole);
            result.Specialization.Should().Be("Nha khoa tong quat");
            result.LicenseNumber.Should().Be("BS-001");
            result.IsActive.Should().BeTrue();
            result.UserId.Should().NotBeNullOrEmpty();

            _userManagerMock.Verify(
                m => m.CreateAsync(
                    It.Is<ApplicationUser>(u =>
                        u.Email == ValidStaffEmail
                        && u.UserName == ValidStaffEmail
                        && u.PhoneNumber == ValidE164Phone
                        && u.StaffProfile != null
                        && u.StaffProfile.FullName == ValidFullName
                        && u.StaffProfile.LicenseNumber == "BS-001"
                        && u.StaffProfile.IsActive),
                    It.IsAny<string>()),
                Times.Once);
            _userManagerMock.Verify(m => m.AddToRoleAsync(It.IsAny<ApplicationUser>(), RoleConstants.DoctorRole), Times.Once);
            result.TemporaryPassword.Should().NotBeNullOrWhiteSpace();
        }

        // UTCID02 (N): Create Receptionist clears doctor-only fields
        [Fact]
        public async Task CreateStaffAsync_ShouldClearDoctorFields_WhenRoleIsReceptionist()
        {
            // Arrange
            var request = new CreateStaffRequest
            {
                FullName = "Tran Thi B",
                Email = "reception@oze.vn",
                PhoneNumber = "0987654321",
                Role = RoleConstants.ReceptionistRole,
                Specialization = "ShouldBeIgnored",
                LicenseNumber = "ShouldBeIgnored"
            };
            SetupCreateUniquenessPasses();
            SetupCreateAccountSucceeds();

            // Act
            var result = await _service.CreateStaffAsync(request);

            // Assert
            result.Role.Should().Be(RoleConstants.ReceptionistRole);
            result.Specialization.Should().BeNull();
            result.LicenseNumber.Should().BeNull();
            result.PhoneNumber.Should().Be("+84987654321");
            _userManagerMock.Verify(
                m => m.CreateAsync(
                    It.Is<ApplicationUser>(u =>
                        u.StaffProfile!.Specialization == null
                        && u.StaffProfile.LicenseNumber == null),
                    It.IsAny<string>()),
                Times.Once);
            _staffRepositoryMock.Verify(
                r => r.IsLicenseNumberInUseAsync(It.IsAny<string>(), It.IsAny<int>()),
                Times.Never);
        }

        // UTCID03 (B): FullName, Email, Specialization and LicenseNumber are trimmed
        [Fact]
        public async Task CreateStaffAsync_ShouldTrimTextFields_WhenValuesHaveSurroundingWhitespace()
        {
            // Arrange
            var request = new CreateStaffRequest
            {
                FullName = "  Nguyen Van A  ",
                Email = "  doctor@oze.vn  ",
                PhoneNumber = ValidLocalPhone,
                Role = RoleConstants.DoctorRole,
                Specialization = "  Nha khoa tong quat  ",
                LicenseNumber = "  BS-001  "
            };
            SetupCreateUniquenessPasses();
            SetupCreateAccountSucceeds();

            // Act
            var result = await _service.CreateStaffAsync(request);

            // Assert
            result.FullName.Should().Be(ValidFullName);
            result.Email.Should().Be(ValidStaffEmail);
            result.Specialization.Should().Be("Nha khoa tong quat");
            result.LicenseNumber.Should().Be("BS-001");
            _userManagerMock.Verify(m => m.FindByEmailAsync(ValidStaffEmail), Times.Once);
        }

        // UTCID04 (A): Invalid phone throws BadRequestException
        [Fact]
        public async Task CreateStaffAsync_ShouldThrowBadRequest_WhenPhoneIsInvalid()
        {
            // Arrange
            var request = ValidDoctorRequest();
            request.PhoneNumber = "abc";

            // Act
            var act = () => _service.CreateStaffAsync(request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.AuthMessage.InvalidPhone);
            _userManagerMock.Verify(m => m.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()), Times.Never);
        }

        // UTCID05 (A): Doctor without license number throws BadRequestException
        [Fact]
        public async Task CreateStaffAsync_ShouldThrowBadRequest_WhenDoctorLicenseIsMissing()
        {
            // Arrange
            var request = ValidDoctorRequest();
            request.LicenseNumber = "   ";

            // Act
            var act = () => _service.CreateStaffAsync(request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.LicenseNumberRequired);
            _userManagerMock.Verify(m => m.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()), Times.Never);
        }

        // UTCID06 (A): Existing email throws BadRequestException
        [Fact]
        public async Task CreateStaffAsync_ShouldThrowBadRequest_WhenEmailAlreadyExists()
        {
            // Arrange
            var request = ValidDoctorRequest();
            _userManagerMock
                .Setup(m => m.FindByEmailAsync(ValidStaffEmail))
                .ReturnsAsync(CreateSampleUser());

            // Act
            var act = () => _service.CreateStaffAsync(request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.AuthMessage.EmailExist);
            _userManagerMock.Verify(m => m.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()), Times.Never);
        }

        // UTCID07 (A): Existing phone throws BadRequestException
        [Fact]
        public async Task CreateStaffAsync_ShouldThrowBadRequest_WhenPhoneAlreadyExists()
        {
            // Arrange
            var request = ValidDoctorRequest();
            _userManagerMock
                .Setup(m => m.FindByEmailAsync(ValidStaffEmail))
                .ReturnsAsync((ApplicationUser?)null);
            _registrationRepositoryMock
                .Setup(r => r.FindUserByPhoneAsync(It.IsAny<IReadOnlyCollection<string>>()))
                .ReturnsAsync(CreateSampleUser(userId: "other-user"));

            // Act
            var act = () => _service.CreateStaffAsync(request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.PhoneExist);
            _userManagerMock.Verify(m => m.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()), Times.Never);
        }

        // UTCID08 (A): Identity create failure throws BadRequestException with CreateFailed fallback
        [Fact]
        public async Task CreateStaffAsync_ShouldThrowBadRequest_WhenIdentityCreateFails()
        {
            // Arrange
            var request = ValidDoctorRequest();
            SetupCreateUniquenessPasses();
            _userManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Failed());

            // Act
            var act = () => _service.CreateStaffAsync(request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.StaffMessage.CreateFailed);
            // Account create failed before a temporary password could be returned
        }

        private static CreateStaffRequest ValidDoctorRequest()
        {
            return new CreateStaffRequest
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

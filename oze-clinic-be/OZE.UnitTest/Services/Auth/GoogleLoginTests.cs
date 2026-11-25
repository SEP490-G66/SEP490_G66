using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Moq;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Auth
{
    public class GoogleLoginTests : AuthServiceTestBase
    {
        private const string GoogleSubject = "google-sub-123";
        private const string GoogleIdToken = "google-id-token";
        private const string GoogleLoginProvider = "Google";

        private static GoogleLoginRequest Request() => new() { IdToken = GoogleIdToken };

        private static GoogleIdTokenPayload ValidPayload(
            string email = Email,
            bool emailVerified = true,
            string? name = UserFullName) => new()
        {
            Subject = GoogleSubject,
            Email = email,
            EmailVerified = emailVerified,
            Name = name
        };

        private void SetupToken(GoogleIdTokenPayload? payload)
        {
            _googleIdTokenValidatorMock
                .Setup(v => v.ValidateAsync(GoogleIdToken, It.IsAny<CancellationToken>()))
                .ReturnsAsync(payload);
        }

        private void SetupValidToken() => SetupToken(ValidPayload());

        private void SetupNoExistingGoogleLogin()
        {
            _userManagerMock
                .Setup(m => m.FindByLoginAsync(GoogleLoginProvider, GoogleSubject))
                .ReturnsAsync((ApplicationUser?)null);
        }

        [Fact]
        public async Task GoogleLoginAsync_WhenClientIdMissing_ShouldFailConfigured()
        {
            var service = CreateService(30, googleClientId: "");

            var result = await service.GoogleLoginAsync(Request());

            result.Success.Should().BeFalse();
            result.Code.Should().Be(ErrorConstants.AuthCode.GoogleNotConfigured);
            VerifyNoTokenIssued();
        }

        [Fact]
        public async Task GoogleLoginAsync_WhenTokenInvalid_ShouldFail()
        {
            SetupToken(null);

            var result = await _authService.GoogleLoginAsync(Request());

            result.Success.Should().BeFalse();
            result.Code.Should().Be(ErrorConstants.AuthCode.GoogleTokenInvalid);
            VerifyNoTokenIssued();
        }

        [Fact]
        public async Task GoogleLoginAsync_WhenEmailNotVerified_ShouldFail()
        {
            SetupToken(ValidPayload(emailVerified: false));

            var result = await _authService.GoogleLoginAsync(Request());

            result.Success.Should().BeFalse();
            result.Code.Should().Be(ErrorConstants.AuthCode.GoogleEmailNotVerified);
            VerifyNoTokenIssued();
        }

        [Fact]
        public async Task GoogleLoginAsync_WhenNewGoogleUser_ShouldCreatePatientWithoutPhoneAndReturnTokens()
        {
            SetupValidToken();
            SetupNoExistingGoogleLogin();
            SetupFindByEmail(null);
            SetupIdentityWritesSucceed();
            _userManagerMock
                .Setup(m => m.AddLoginAsync(It.IsAny<ApplicationUser>(), It.IsAny<UserLoginInfo>()))
                .ReturnsAsync(IdentityResult.Success);
            ApplicationUser? created = null;
            _userManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<ApplicationUser>()))
                .Callback<ApplicationUser>(u => created = u)
                .ReturnsAsync(IdentityResult.Success);

            var result = await _authService.GoogleLoginAsync(Request());

            result.Success.Should().BeTrue();
            result.Data!.Token.Should().Be(AccessToken);
            result.Data.RefreshToken.Should().Be(RefreshToken);
            result.Data.Role.Should().Be(UserRole);
            created.Should().NotBeNull();
            created!.Email.Should().Be(Email);
            created.EmailConfirmed.Should().BeTrue();
            created.UserName.Should().Be(Email);
            created.PhoneNumber.Should().BeNull();
            created.Patient.Should().NotBeNull();
            created.Patient!.PhoneNumber.Should().BeNull();
            created.Patient.FullName.Should().Be(UserFullName);
            created.Patient.Email.Should().Be(Email);
            _userManagerMock.Verify(m => m.AddToRoleAsync(created, RoleConstants.PatientRole), Times.Once);
            _userManagerMock.Verify(
                m => m.AddLoginAsync(created, It.Is<UserLoginInfo>(l =>
                    l.LoginProvider == GoogleLoginProvider && l.ProviderKey == GoogleSubject)),
                Times.Once);
            _refreshTokenRepositoryMock.Verify(r => r.SaveChangesAsync(), Times.Once);
        }

        [Fact]
        public async Task GoogleLoginAsync_WhenExistingPatientByEmail_ShouldLinkGoogleAndReturnTokens()
        {
            var user = ActiveUser();
            SetupValidToken();
            SetupNoExistingGoogleLogin();
            SetupFindByEmail(user);
            _userManagerMock.Setup(m => m.IsInRoleAsync(user, RoleConstants.PatientRole)).ReturnsAsync(true);
            _userManagerMock.Setup(m => m.GetLoginsAsync(user)).ReturnsAsync(new List<UserLoginInfo>());
            _userManagerMock
                .Setup(m => m.AddLoginAsync(user, It.IsAny<UserLoginInfo>()))
                .ReturnsAsync(IdentityResult.Success);

            var result = await _authService.GoogleLoginAsync(Request());

            result.Success.Should().BeTrue();
            result.Data!.Token.Should().Be(AccessToken);
            _userManagerMock.Verify(
                m => m.AddLoginAsync(user, It.Is<UserLoginInfo>(l =>
                    l.LoginProvider == GoogleLoginProvider && l.ProviderKey == GoogleSubject)),
                Times.Once);
            _userManagerMock.Verify(m => m.CreateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        }

        [Fact]
        public async Task GoogleLoginAsync_WhenExistingGoogleLogin_ShouldReturnTokensWithoutCreating()
        {
            var user = ActiveUser();
            SetupValidToken();
            _userManagerMock
                .Setup(m => m.FindByLoginAsync(GoogleLoginProvider, GoogleSubject))
                .ReturnsAsync(user);
            _userManagerMock.Setup(m => m.IsInRoleAsync(user, RoleConstants.PatientRole)).ReturnsAsync(true);
            _userManagerMock
                .Setup(m => m.GetLoginsAsync(user))
                .ReturnsAsync(new List<UserLoginInfo>
                {
                    new(GoogleLoginProvider, GoogleSubject, GoogleLoginProvider)
                });

            var result = await _authService.GoogleLoginAsync(Request());

            result.Success.Should().BeTrue();
            result.Data!.Token.Should().Be(AccessToken);
            _userManagerMock.Verify(m => m.AddLoginAsync(It.IsAny<ApplicationUser>(), It.IsAny<UserLoginInfo>()), Times.Never);
            _userManagerMock.Verify(m => m.CreateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        }

        [Fact]
        public async Task GoogleLoginAsync_WhenStaffEmail_ShouldReject()
        {
            var staff = ActiveUser();
            SetupValidToken();
            SetupNoExistingGoogleLogin();
            SetupFindByEmail(staff);
            _userManagerMock.Setup(m => m.IsInRoleAsync(staff, RoleConstants.PatientRole)).ReturnsAsync(false);

            var result = await _authService.GoogleLoginAsync(Request());

            result.Success.Should().BeFalse();
            result.Code.Should().Be(ErrorConstants.AuthCode.GoogleNotPatient);
            VerifyNoTokenIssued();
        }

        [Fact]
        public async Task GoogleLoginAsync_WhenAccountDisabled_ShouldFail()
        {
            var user = ActiveUser();
            user.LockoutEnd = DateTimeOffset.MaxValue;
            SetupValidToken();
            SetupNoExistingGoogleLogin();
            SetupFindByEmail(user);
            _userManagerMock.Setup(m => m.IsInRoleAsync(user, RoleConstants.PatientRole)).ReturnsAsync(true);

            var result = await _authService.GoogleLoginAsync(Request());

            result.Success.Should().BeFalse();
            result.Code.Should().Be(ErrorConstants.AuthCode.AccountDisabled);
            VerifyNoTokenIssued();
        }

        [Fact]
        public async Task GoogleLoginAsync_WhenPendingRegistration_ShouldFailAsInvalidLogin()
        {
            var pending = PendingRegistrationUser();
            SetupValidToken();
            SetupNoExistingGoogleLogin();
            SetupFindByEmail(pending);
            _userManagerMock.Setup(m => m.IsInRoleAsync(pending, RoleConstants.PatientRole)).ReturnsAsync(true);

            var result = await _authService.GoogleLoginAsync(Request());

            result.Success.Should().BeFalse();
            result.Code.Should().Be(ErrorConstants.AuthCode.InvalidCredentials);
            VerifyNoTokenIssued();
        }
    }
}

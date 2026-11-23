using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Auth
{
    // OZ-AUTH-09 ForgotPassword
    [Trait("Tab", "OZ-AUTH-09")]
    public class ForgotPasswordTests : AuthServiceTestBase
    {
        [Fact]
        public async Task ForgotPasswordAsync_WhenPatientPhoneNeverConfirmed_ShouldNotSendCode()
        {
            // Arrange: a patient who signed up by email; whoever holds the phone they typed may not be them
            var user = ActiveUser();
            user.PhoneNumberConfirmed = false;
            SetupFindByPhone(user);
            _userManagerMock.Setup(m => m.IsInRoleAsync(user, RoleConstants.PatientRole)).ReturnsAsync(true);

            // Act
            var result = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest { Identifier = Phone });

            // Assert
            result.Success.Should().BeTrue();
            VerifyNothingSentAndNoSessionSaved();
        }

        [Fact]
        public async Task ForgotPasswordAsync_WithEmail_ShouldFailPhoneOnly()
        {
            // Act
            var result = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest { Identifier = Email });

            // Assert: password reset is SMS-only
            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.AuthMessage.PasswordResetPhoneOnly);
            _emailSenderMock.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _smsSenderMock.Verify(s => s.SendSmsAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ForgotPasswordAsync_WithPhone_ShouldSendCodeBySmsToNormalizedNumber()
        {
            // Arrange
            SetupFindByPhone(ActiveUser());

            // Act
            var result = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest { Identifier = Phone });

            // Assert: the SMS goes to the +84 form, never by email
            result.Success.Should().BeTrue();
            result.Data!.VerificationMethod.Should().Be(VerificationMethodConstants.Sms);
            _smsSenderMock.Verify(s => s.SendSmsAsync(NormalizedPhone, It.IsAny<string>()), Times.Once);
            _emailSenderMock.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _passwordResetStoreMock.Verify(s => s.Save(It.IsAny<PasswordResetSession>(), It.IsAny<TimeSpan>()), Times.Once);
        }

        [Fact]
        public async Task ForgotPasswordAsync_ShouldMaskWhereTheCodeWasSent()
        {
            // Arrange
            SetupFindByPhone(ActiveUser());

            // Act
            var byPhone = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest { Identifier = Phone });

            // Assert: the full number is never sent back
            byPhone.Data!.MaskedDestination.Should().NotBe(NormalizedPhone).And.Contain("*");
        }

        [Fact]
        public async Task ForgotPasswordAsync_ShouldNotPutTheCodeInTheResponse()
        {
            // Arrange: capture the SMS to learn the real code
            SetupFindByPhone(ActiveUser());
            string? sms = null;
            _smsSenderMock
                .Setup(s => s.SendSmsAsync(It.IsAny<string>(), It.IsAny<string>()))
                .Callback<string, string>((_, message) => sms = message)
                .Returns(Task.CompletedTask);

            // Act
            var result = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest { Identifier = Phone });

            // Assert: the 6-digit code reaches the phone but not the API response
            var code = System.Text.RegularExpressions.Regex.Match(sms!, @"\d{6}").Value;
            code.Should().HaveLength(6);
            System.Text.Json.JsonSerializer.Serialize(result).Should().NotContain(code);
        }

        [Fact]
        public async Task ForgotPasswordAsync_WithSpacesAroundEmail_ShouldStillRejectEmail()
        {
            // Act
            var result = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest { Identifier = $"  {Email}  " });

            // Assert
            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.AuthMessage.PasswordResetPhoneOnly);
        }

        [Theory]
        [InlineData("abc123")]
        [InlineData("091234567")]
        [InlineData("0112345678")]
        public async Task ForgotPasswordAsync_WithInvalidPhone_ShouldFailWithoutQueryingDatabase(string phone)
        {
            // Act
            var result = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest { Identifier = phone });

            // Assert
            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.AuthMessage.InvalidPhone);
            _registrationRepositoryMock.Verify(r => r.FindUserByPhoneAsync(It.IsAny<IReadOnlyCollection<string>>()), Times.Never);
            _smsSenderMock.Verify(s => s.SendSmsAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _passwordResetStoreMock.Verify(s => s.Save(It.IsAny<PasswordResetSession>(), It.IsAny<TimeSpan>()), Times.Never);
        }

        [Fact]
        public async Task ForgotPasswordAsync_WhenEmailIdentifier_ShouldFailWithoutSending()
        {
            // Act
            var result = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest { Identifier = Email });

            // Assert
            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.AuthMessage.PasswordResetPhoneOnly);
            _smsSenderMock.Verify(s => s.SendSmsAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _emailSenderMock.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ForgotPasswordAsync_WhenPhoneNotFound_ShouldAnswerLikeAnyAccountWithoutSending()
        {
            // Arrange
            SetupFindByPhone(null);

            // Act
            var result = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest { Identifier = Phone });

            // Assert
            // The same answer as for a real account, so the endpoint does not tell which accounts exist
            result.Success.Should().BeTrue();
            result.Data!.SessionId.Should().NotBeNullOrEmpty();
            VerifyNothingSentAndNoSessionSaved();
        }

        [Fact]
        public async Task ForgotPasswordAsync_WhenRegistrationNotVerified_ShouldAnswerLikeAnyAccountWithoutSending()
        {
            // Arrange: a patient who never finished OTP registration has no password to recover
            var user = PendingRegistrationUser();
            SetupFindByPhone(user);
            _userManagerMock.Setup(m => m.IsInRoleAsync(user, RoleConstants.PatientRole)).ReturnsAsync(true);

            // Act
            var result = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest { Identifier = Phone });

            // Assert
            // The same answer as for a real account, so the endpoint does not tell which accounts exist
            result.Success.Should().BeTrue();
            result.Data!.SessionId.Should().NotBeNullOrEmpty();
            VerifyNothingSentAndNoSessionSaved();
        }

        [Fact]
        public async Task ForgotPasswordAsync_WhenSmsFails_ShouldFailWithoutSavingSession()
        {
            // Arrange
            SetupFindByPhone(ActiveUser());
            _smsSenderMock
                .Setup(s => s.SendSmsAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ThrowsAsync(new Exception("SMS gateway down"));

            // Act
            var result = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest { Identifier = Phone });

            // Assert: a session nobody received a code for must not exist
            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.AuthMessage.OtpSendFailed);
            _passwordResetStoreMock.Verify(s => s.Save(It.IsAny<PasswordResetSession>(), It.IsAny<TimeSpan>()), Times.Never);
        }

    }
}

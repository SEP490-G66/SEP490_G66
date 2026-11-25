using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Me
{
    // OZ-ME-05 ResendConfirmEmail — confirmation emails are disabled
    [Trait("Tab", "OZ-ME-05")]
    public class ResendConfirmEmailTests : UserServiceTestBase
    {
        // UTCID01 (A): feature disabled — always returns NoEmailToConfirm
        [Fact]
        public async Task ResendEmailConfirmationAsync_AlwaysReturnsNoEmailToConfirm()
        {
            var user = NewUser();
            _userManagerMock.Setup(m => m.FindByIdAsync(UserId)).ReturnsAsync(user);

            var result = await _userService.ResendEmailConfirmationAsync(UserId, BaseUrl);

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ProfileMessage.NoEmailToConfirm);
            _emailSenderMock.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        // UTCID02 (A): even an unconfirmed email does not get a link
        [Fact]
        public async Task ResendEmailConfirmationAsync_UnconfirmedEmail_StillDisabled()
        {
            var user = NewUser();
            user.EmailConfirmed = false;
            _userManagerMock.Setup(m => m.FindByIdAsync(UserId)).ReturnsAsync(user);

            var result = await _userService.ResendEmailConfirmationAsync(UserId, BaseUrl);

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ProfileMessage.NoEmailToConfirm);
        }
    }
}

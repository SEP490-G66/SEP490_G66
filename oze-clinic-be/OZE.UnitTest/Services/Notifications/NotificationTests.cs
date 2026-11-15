using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Notifications
{
    // User "user-1" with 3 unread notifications
    public abstract class NotificationTestBase
    {
        protected const string UserId = "user-1";
        protected readonly Mock<INotificationRepository> _repo = new();
        protected readonly NotificationService _service;

        protected NotificationTestBase()
        {
            _service = new NotificationService(_repo.Object, new Mock<ILogger<NotificationService>>().Object);
            _repo.Setup(r => r.CountUnreadAsync(UserId, It.IsAny<CancellationToken>())).ReturnsAsync(3);
        }
    }

    // OZ-NOTIF-01 GetNotifications
    [Trait("Tab", "OZ-NOTIF-01")]
    public class GetNotificationsTests : NotificationTestBase
    {
        private void Page(int total, params Notification[] items) =>
            _repo.Setup(r => r.GetPageAsync(UserId, It.IsAny<bool>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((items.ToList(), total));

        // UTCID01 (N): the first page of the user's notifications with the unread count
        [Fact]
        public async Task GetMineAsync_ShouldReturnPage()
        {
            Page(25, new Notification { Id = 1, UserId = UserId, Title = "Lich hen da xac nhan", Message = "x" });

            var result = await _service.GetMineAsync(UserId, new NotificationQueryParameters { Page = 1, PageSize = 20 });

            result.Items.Should().ContainSingle(x => x.Title == "Lich hen da xac nhan");
            result.TotalItems.Should().Be(25);
            result.TotalPages.Should().Be(2);
            result.UnreadCount.Should().Be(3);
        }

        // UTCID02 (N): only unread notifications are asked for
        [Fact]
        public async Task GetMineAsync_ShouldPassUnreadOnly()
        {
            Page(0);

            await _service.GetMineAsync(UserId, new NotificationQueryParameters { UnreadOnly = true });

            _repo.Verify(r => r.GetPageAsync(UserId, true, 1, 20, It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID03 (B): a page below 1 and a page size above the limit are corrected
        [Fact]
        public async Task GetMineAsync_ShouldClampPaging()
        {
            Page(0);

            var result = await _service.GetMineAsync(UserId, new NotificationQueryParameters { Page = 0, PageSize = 1000 });

            result.Page.Should().Be(1);
            result.PageSize.Should().Be(NotificationConstants.MaxPageSize);
            result.TotalPages.Should().Be(1);
        }

        // UTCID04 (B): a page size of 0 takes the default
        [Fact]
        public async Task GetMineAsync_ShouldUseDefaultPageSize_WhenZero()
        {
            Page(0);

            var result = await _service.GetMineAsync(UserId, new NotificationQueryParameters { PageSize = 0 });

            result.PageSize.Should().Be(NotificationConstants.DefaultPageSize);
            result.Items.Should().BeEmpty();
        }
    }

    // OZ-NOTIF-02 MarkNotifRead
    [Trait("Tab", "OZ-NOTIF-02")]
    public class MarkNotifReadTests : NotificationTestBase
    {
        // UTCID01 (N): an unread notification becomes read
        [Fact]
        public async Task MarkReadAsync_ShouldMarkRead()
        {
            var notification = new Notification { Id = 1, UserId = UserId, IsRead = false };
            _repo.Setup(r => r.GetOwnAsync(1, UserId, It.IsAny<CancellationToken>())).ReturnsAsync(notification);

            var result = await _service.MarkReadAsync(UserId, 1);

            notification.IsRead.Should().BeTrue();
            notification.ReadAt.Should().NotBeNull();
            result.UnreadCount.Should().Be(3);
            _repo.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (B): a notification already read is left as is
        [Fact]
        public async Task MarkReadAsync_ShouldDoNothing_WhenAlreadyRead()
        {
            _repo.Setup(r => r.GetOwnAsync(1, UserId, It.IsAny<CancellationToken>())).ReturnsAsync(new Notification { Id = 1, UserId = UserId, IsRead = true });

            await _service.MarkReadAsync(UserId, 1);

            _repo.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID03 (A): a missing notification, or one of another user
        [Fact]
        public async Task MarkReadAsync_ShouldThrow_WhenNotOwn()
        {
            var act = () => _service.MarkReadAsync(UserId, 99);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.NotificationMessage.NotFound);
        }

        // UTCID04 (N): mark all as read
        [Fact]
        public async Task MarkAllReadAsync_ShouldMarkAll()
        {
            var result = await _service.MarkAllReadAsync(UserId);

            result.UnreadCount.Should().Be(0);
            _repo.Verify(r => r.MarkAllReadAsync(UserId, It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}

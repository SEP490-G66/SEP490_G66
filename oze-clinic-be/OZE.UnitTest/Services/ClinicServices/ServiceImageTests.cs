using FluentAssertions;
using Microsoft.Extensions.Caching.Distributed;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.ClinicServices
{
    // Pictures of services and service variants, kept in the database
    public class ServiceImageTests : ClinicServiceTestBase
    {
        private const int ServiceId = 5;
        private const int VariantId = 11;
        private const string ActiveServicesCacheKey = "ClinicServices_ActiveList";

        private static readonly byte[] PngHeader = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        private static readonly byte[] JpegHeader = { 0xFF, 0xD8, 0xFF, 0xE0 };
        private static readonly byte[] WebpHeader = { 0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50 };

        private readonly Service _serviceEntity = new() { Id = ServiceId, ServiceCode = "NIENG", ServiceName = "Nieng rang" };
        private readonly ServiceVariant _variant = new() { Id = VariantId, ServiceId = ServiceId, VariantCode = "NIENG-KL", VariantName = "Mac cai kim loai" };

        public ServiceImageTests()
        {
            _serviceRepositoryMock.Setup(r => r.GetByIdAsync(ServiceId, It.IsAny<CancellationToken>())).ReturnsAsync(_serviceEntity);
            _serviceRepositoryMock.Setup(r => r.GetVariantByIdAsync(ServiceId, VariantId, It.IsAny<CancellationToken>())).ReturnsAsync(_variant);
        }

        // A file of the given size that starts with the given header
        private static byte[] File(byte[] header, int size = 100)
        {
            var data = new byte[size];
            header.CopyTo(data, 0);
            return data;
        }

        [Fact]
        public async Task SetServiceImageAsync_ShouldSaveNewPicture()
        {
            var data = File(PngHeader);

            var result = await _service.SetServiceImageAsync(ServiceId, data);

            result.Success.Should().BeTrue();
            result.Data!.ImageUrl.Should().StartWith($"/api/services/{ServiceId}/image?v=");
            _serviceEntity.ImageUpdatedAt.Should().NotBeNull();
            _serviceRepositoryMock.Verify(r => r.AddServiceImageAsync(
                It.Is<ServiceImage>(i => i.ServiceId == ServiceId && i.ContentType == ServiceImageConstants.Png && i.Data == data),
                It.IsAny<CancellationToken>()), Times.Once);
            _serviceRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SetServiceImageAsync_ShouldReplaceExistingPicture()
        {
            var existing = new ServiceImage { ServiceId = ServiceId, ContentType = ServiceImageConstants.Png, Data = File(PngHeader) };
            _serviceRepositoryMock.Setup(r => r.GetServiceImageAsync(ServiceId, false, It.IsAny<CancellationToken>())).ReturnsAsync(existing);
            var data = File(JpegHeader);

            var result = await _service.SetServiceImageAsync(ServiceId, data);

            result.Success.Should().BeTrue();
            existing.ContentType.Should().Be(ServiceImageConstants.Jpeg);
            existing.Data.Should().BeSameAs(data);
            _serviceRepositoryMock.Verify(r => r.AddServiceImageAsync(It.IsAny<ServiceImage>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task SetServiceImageAsync_ShouldAcceptWebp()
        {
            var result = await _service.SetServiceImageAsync(ServiceId, File(WebpHeader));

            result.Success.Should().BeTrue();
            _serviceRepositoryMock.Verify(r => r.AddServiceImageAsync(
                It.Is<ServiceImage>(i => i.ContentType == ServiceImageConstants.Webp), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SetServiceImageAsync_ShouldAcceptPictureOfExactlyTheLimit()
        {
            var result = await _service.SetServiceImageAsync(ServiceId, File(PngHeader, ServiceImageConstants.MaxBytes));

            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task SetServiceImageAsync_ShouldReject_WhenNoFile()
        {
            var result = await _service.SetServiceImageAsync(ServiceId, Array.Empty<byte>());

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ServiceImageMessage.ImageRequired);
            _serviceRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task SetServiceImageAsync_ShouldReject_WhenOverTheLimit()
        {
            var result = await _service.SetServiceImageAsync(ServiceId, File(PngHeader, ServiceImageConstants.MaxBytes + 1));

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ServiceImageMessage.ImageTooLarge);
        }

        [Fact]
        public async Task SetServiceImageAsync_ShouldReject_WhenNotAPicture()
        {
            // A PDF renamed to .png: the first bytes give it away
            var result = await _service.SetServiceImageAsync(ServiceId, File(new byte[] { 0x25, 0x50, 0x44, 0x46 }));

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ServiceImageMessage.InvalidImageType);
        }

        [Fact]
        public async Task SetServiceImageAsync_ShouldReject_WhenServiceNotFound()
        {
            var result = await _service.SetServiceImageAsync(404, File(PngHeader));

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceNotFound);
        }

        [Fact]
        public async Task SetServiceImageAsync_ShouldClearActiveServicesCache()
        {
            await _cache.SetStringAsync(ActiveServicesCacheKey, "[]");

            await _service.SetServiceImageAsync(ServiceId, File(PngHeader));

            (await _cache.GetStringAsync(ActiveServicesCacheKey)).Should().BeNull();
        }

        [Fact]
        public async Task RemoveServiceImageAsync_ShouldRemovePicture()
        {
            var existing = new ServiceImage { ServiceId = ServiceId, ContentType = ServiceImageConstants.Png, Data = File(PngHeader) };
            _serviceEntity.ImageUpdatedAt = DateTimeOffset.UtcNow;
            _serviceRepositoryMock.Setup(r => r.GetServiceImageAsync(ServiceId, false, It.IsAny<CancellationToken>())).ReturnsAsync(existing);

            var result = await _service.RemoveServiceImageAsync(ServiceId);

            result.Success.Should().BeTrue();
            result.Data!.ImageUrl.Should().BeNull();
            _serviceEntity.ImageUpdatedAt.Should().BeNull();
            _serviceRepositoryMock.Verify(r => r.RemoveServiceImage(existing), Times.Once);
            _serviceRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task RemoveServiceImageAsync_ShouldReject_WhenNoPicture()
        {
            var result = await _service.RemoveServiceImageAsync(ServiceId);

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ServiceImageMessage.ImageNotFound);
        }

        [Fact]
        public async Task RemoveServiceImageAsync_ShouldReject_WhenServiceNotFound()
        {
            var result = await _service.RemoveServiceImageAsync(404);

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ServiceMessage.ServiceNotFound);
        }

        [Fact]
        public async Task GetServiceImageAsync_ShouldReturnFile()
        {
            var data = File(PngHeader);
            var updatedAt = new DateTimeOffset(2026, 11, 16, 8, 0, 0, TimeSpan.Zero);
            _serviceRepositoryMock.Setup(r => r.GetServiceImageAsync(ServiceId, true, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new ServiceImage { ServiceId = ServiceId, ContentType = ServiceImageConstants.Png, Data = data, UpdatedAt = updatedAt });

            var result = await _service.GetServiceImageAsync(ServiceId);

            result.Success.Should().BeTrue();
            result.Data!.Data.Should().BeSameAs(data);
            result.Data.ContentType.Should().Be(ServiceImageConstants.Png);
            result.Data.UpdatedAt.Should().Be(updatedAt);
        }

        [Fact]
        public async Task GetServiceImageAsync_ShouldReturnNotFound_WhenNoPicture()
        {
            var result = await _service.GetServiceImageAsync(ServiceId);

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ServiceImageMessage.ImageNotFound);
        }

        [Fact]
        public async Task SetVariantImageAsync_ShouldSaveNewPicture()
        {
            var result = await _service.SetVariantImageAsync(ServiceId, VariantId, File(JpegHeader));

            result.Success.Should().BeTrue();
            result.Data!.ImageUrl.Should().StartWith($"/api/services/{ServiceId}/variants/{VariantId}/image?v=");
            _variant.ImageUpdatedAt.Should().NotBeNull();
            _serviceRepositoryMock.Verify(r => r.AddVariantImageAsync(
                It.Is<ServiceVariantImage>(i => i.ServiceVariantId == VariantId && i.ContentType == ServiceImageConstants.Jpeg),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SetVariantImageAsync_ShouldReject_WhenVariantNotFound()
        {
            var result = await _service.SetVariantImageAsync(ServiceId, 404, File(JpegHeader));

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ServiceVariantMessage.VariantNotFound);
        }

        [Fact]
        public async Task SetVariantImageAsync_ShouldReject_WhenNotAPicture()
        {
            var result = await _service.SetVariantImageAsync(ServiceId, VariantId, File(new byte[] { 0x47, 0x49, 0x46, 0x38 }));

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ServiceImageMessage.InvalidImageType);
        }

        [Fact]
        public async Task RemoveVariantImageAsync_ShouldRemovePicture()
        {
            var existing = new ServiceVariantImage { ServiceVariantId = VariantId, ContentType = ServiceImageConstants.Png, Data = File(PngHeader) };
            _variant.ImageUpdatedAt = DateTimeOffset.UtcNow;
            _serviceRepositoryMock.Setup(r => r.GetVariantImageAsync(ServiceId, VariantId, false, It.IsAny<CancellationToken>())).ReturnsAsync(existing);

            var result = await _service.RemoveVariantImageAsync(ServiceId, VariantId);

            result.Success.Should().BeTrue();
            result.Data!.ImageUrl.Should().BeNull();
            _serviceRepositoryMock.Verify(r => r.RemoveVariantImage(existing), Times.Once);
        }

        [Fact]
        public async Task RemoveVariantImageAsync_ShouldReject_WhenNoPicture()
        {
            var result = await _service.RemoveVariantImageAsync(ServiceId, VariantId);

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ServiceImageMessage.ImageNotFound);
        }

        [Fact]
        public async Task GetVariantImageAsync_ShouldReturnNotFound_WhenNoPicture()
        {
            var result = await _service.GetVariantImageAsync(ServiceId, VariantId);

            result.Success.Should().BeFalse();
            result.Message.Should().Be(ErrorConstants.ServiceImageMessage.ImageNotFound);
        }

        [Fact]
        public async Task GetServiceByIdAsync_ShouldHaveNoImageUrl_WhenNoPicture()
        {
            _serviceRepositoryMock.Setup(r => r.GetByIdAsync(ServiceId, true, It.IsAny<CancellationToken>())).ReturnsAsync(_serviceEntity);

            var result = await _service.GetServiceByIdAsync(ServiceId);

            result.Data!.ImageUrl.Should().BeNull();
        }
    }
}

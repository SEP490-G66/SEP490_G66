using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Rooms
{
    // OZ-ROOM-02 GetRoomById
    [Trait("Tab", "OZ-ROOM-02")]
    public class GetRoomByIdTests : RoomTestBase
    {
        // UTCID01 (N): Return mapped room when room exists
        [Fact]
        public async Task GetRoomByIdAsync_ShouldReturnMappedRoom_WhenRoomExists()
        {
            // Arrange
            var room = CreateSampleRoom();
            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);

            // Act
            var result = await _service.GetRoomByIdAsync(ValidRoomId);

            // Assert
            result.Should().NotBeNull();
            result.Id.Should().Be(ValidRoomId);
            result.RoomName.Should().Be(ValidRoomName);
            result.RoomType.Should().Be(RoomTypeConstants.GeneralTreatment);
            result.Status.Should().Be(RoomConstants.ActiveStatus);
            result.Floor.Should().Be("1");
            result.Description.Should().Be("Ghe so 1");
            result.CreatedAt.Should().Be(room.CreatedAt);
            result.UpdatedAt.Should().BeNull();
            _roomRepositoryMock.Verify(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (N): Map null Floor and Description when optional fields are null
        [Fact]
        public async Task GetRoomByIdAsync_ShouldMapNullOptionalFields_WhenFloorAndDescriptionAreNull()
        {
            // Arrange
            var room = CreateSampleRoom(
                id: 2,
                roomName: "Phong XQuang",
                roomType: RoomTypeConstants.XRay,
                status: RoomConstants.MaintenanceStatus,
                floor: null,
                description: null);
            room.UpdatedAt = DateTimeOffset.Parse("2026-11-10T08:00:00Z");

            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(2, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);

            // Act
            var result = await _service.GetRoomByIdAsync(2);

            // Assert
            result.Id.Should().Be(2);
            result.RoomName.Should().Be("Phong XQuang");
            result.RoomType.Should().Be(RoomTypeConstants.XRay);
            result.Status.Should().Be(RoomConstants.MaintenanceStatus);
            result.Floor.Should().BeNull();
            result.Description.Should().BeNull();
            result.UpdatedAt.Should().Be(room.UpdatedAt);
        }

        // UTCID03 (B): Minimum positive id (id = 1) returns room when it exists
        [Fact]
        public async Task GetRoomByIdAsync_ShouldReturnRoom_WhenIdIsMinimumPositiveBoundary()
        {
            // Arrange
            const int roomId = 1;
            var room = CreateSampleRoom(id: roomId);

            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(roomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);

            // Act
            var result = await _service.GetRoomByIdAsync(roomId);

            // Assert
            result.Should().NotBeNull();
            result.Id.Should().Be(1);
            _roomRepositoryMock.Verify(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID04 (A): Throw NotFoundException when room does not exist
        [Fact]
        public async Task GetRoomByIdAsync_ShouldThrowNotFoundException_WhenRoomDoesNotExist()
        {
            // Arrange
            const int missingId = 999;
            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(missingId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Room?)null);

            // Act
            var act = () => _service.GetRoomByIdAsync(missingId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.RoomMessage.RoomNotFound);
            _roomRepositoryMock.Verify(r => r.GetByIdAsync(missingId, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}

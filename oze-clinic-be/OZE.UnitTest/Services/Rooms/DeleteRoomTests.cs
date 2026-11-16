using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Rooms
{
    // OZ-ROOM-05 DeleteRoom
    [Trait("Tab", "OZ-ROOM-05")]
    public class DeleteRoomTests : RoomTestBase
    {
        // UTCID01 (N): Delete room successfully when it is not referenced by schedule or queue history
        [Fact]
        public async Task DeleteRoomAsync_ShouldRemoveRoom_WhenRoomIsNotInUse()
        {
            // Arrange
            var room = CreateSampleRoom();
            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);
            _roomRepositoryMock
                .Setup(r => r.IsRoomInUseAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            _roomRepositoryMock
                .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            // Act
            await _service.DeleteRoomAsync(ValidRoomId);

            // Assert
            _roomRepositoryMock.Verify(r => r.Remove(room), Times.Once);
            _roomRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
            _roomRepositoryMock.Verify(r => r.IsRoomInUseAsync(ValidRoomId, It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (B): Minimum positive id (id = 1) deletes successfully when room is unused
        [Fact]
        public async Task DeleteRoomAsync_ShouldRemoveRoom_WhenIdIsMinimumPositiveBoundary()
        {
            // Arrange
            const int roomId = 1;
            var room = CreateSampleRoom(id: roomId);
            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(roomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);
            _roomRepositoryMock
                .Setup(r => r.IsRoomInUseAsync(roomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            _roomRepositoryMock
                .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            // Act
            await _service.DeleteRoomAsync(roomId);

            // Assert
            _roomRepositoryMock.Verify(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()), Times.Once);
            _roomRepositoryMock.Verify(r => r.Remove(room), Times.Once);
        }

        // UTCID03 (A): Throw NotFoundException when room does not exist
        [Fact]
        public async Task DeleteRoomAsync_ShouldThrowNotFound_WhenRoomDoesNotExist()
        {
            // Arrange
            const int missingId = 999;
            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(missingId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Room?)null);

            // Act
            var act = () => _service.DeleteRoomAsync(missingId);

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.RoomMessage.RoomNotFound);
            _roomRepositoryMock.Verify(r => r.IsRoomInUseAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
            _roomRepositoryMock.Verify(r => r.Remove(It.IsAny<Room>()), Times.Never);
            _roomRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID04 (A): Throw BadRequestException when room has schedule or queue history
        [Fact]
        public async Task DeleteRoomAsync_ShouldThrowBadRequest_WhenRoomIsInUse()
        {
            // Arrange
            var room = CreateSampleRoom();
            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);
            _roomRepositoryMock
                .Setup(r => r.IsRoomInUseAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            var act = () => _service.DeleteRoomAsync(ValidRoomId);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.RoomMessage.RoomInUse);
            _roomRepositoryMock.Verify(r => r.Remove(It.IsAny<Room>()), Times.Never);
            _roomRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}

using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Rooms
{
    // OZ-ROOM-03 CreateRoom
    [Trait("Tab", "OZ-ROOM-03")]
    public class CreateRoomTests : RoomTestBase
    {
        // UTCID01 (N): Create room successfully with valid fields; status defaults to Active
        [Fact]
        public async Task CreateRoomAsync_ShouldCreateRoom_WhenRequestIsValid()
        {
            // Arrange
            var request = new CreateRoomRequest
            {
                RoomName = "Phong 101",
                RoomType = RoomTypeConstants.GeneralTreatment,
                Floor = "1",
                Description = "Ghe so 1"
            };

            _roomRepositoryMock
                .Setup(r => r.IsRoomNameInUseAsync("Phong 101", null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            _roomRepositoryMock
                .Setup(r => r.AddAsync(It.IsAny<Room>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _roomRepositoryMock
                .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.CreateRoomAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.RoomName.Should().Be("Phong 101");
            result.RoomType.Should().Be(RoomTypeConstants.GeneralTreatment);
            result.Status.Should().Be(RoomConstants.ActiveStatus);
            result.Floor.Should().Be("1");
            result.Description.Should().Be("Ghe so 1");
            result.CreatedAt.Should().NotBeNull();

            _roomRepositoryMock.Verify(
                r => r.AddAsync(
                    It.Is<Room>(room =>
                        room.RoomName == "Phong 101"
                        && room.RoomType == RoomTypeConstants.GeneralTreatment
                        && room.Status == RoomConstants.ActiveStatus
                        && room.Floor == "1"
                        && room.Description == "Ghe so 1"),
                    It.IsAny<CancellationToken>()),
                Times.Once);
            _roomRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (N): Blank Floor and Description are stored as null
        [Fact]
        public async Task CreateRoomAsync_ShouldStoreNullOptionalFields_WhenFloorAndDescriptionAreBlank()
        {
            // Arrange
            var request = new CreateRoomRequest
            {
                RoomName = "Phong XQuang",
                RoomType = RoomTypeConstants.XRay,
                Floor = "   ",
                Description = null
            };

            _roomRepositoryMock
                .Setup(r => r.IsRoomNameInUseAsync("Phong XQuang", null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            _roomRepositoryMock
                .Setup(r => r.AddAsync(It.IsAny<Room>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _roomRepositoryMock
                .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.CreateRoomAsync(request);

            // Assert
            result.Floor.Should().BeNull();
            result.Description.Should().BeNull();
            result.Status.Should().Be(RoomConstants.ActiveStatus);
            result.RoomType.Should().Be(RoomTypeConstants.XRay);

            _roomRepositoryMock.Verify(
                r => r.AddAsync(
                    It.Is<Room>(room => room.Floor == null && room.Description == null),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        // UTCID03 (B): RoomName with leading/trailing spaces is trimmed before save and duplicate check
        [Fact]
        public async Task CreateRoomAsync_ShouldTrimRoomName_WhenNameHasSurroundingWhitespace()
        {
            // Arrange
            var request = new CreateRoomRequest
            {
                RoomName = "  Phong 202  ",
                RoomType = RoomTypeConstants.MinorSurgery,
                Floor = " 2 ",
                Description = "  Mo ta  "
            };

            _roomRepositoryMock
                .Setup(r => r.IsRoomNameInUseAsync("Phong 202", null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            _roomRepositoryMock
                .Setup(r => r.AddAsync(It.IsAny<Room>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _roomRepositoryMock
                .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.CreateRoomAsync(request);

            // Assert
            result.RoomName.Should().Be("Phong 202");
            result.Floor.Should().Be("2");
            result.Description.Should().Be("Mo ta");

            _roomRepositoryMock.Verify(
                r => r.IsRoomNameInUseAsync("Phong 202", null, It.IsAny<CancellationToken>()),
                Times.Once);
            _roomRepositoryMock.Verify(
                r => r.AddAsync(
                    It.Is<Room>(room =>
                        room.RoomName == "Phong 202"
                        && room.Floor == "2"
                        && room.Description == "Mo ta"),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        // UTCID04 (A): Invalid room type throws BadRequestException
        [Fact]
        public async Task CreateRoomAsync_ShouldThrowBadRequest_WhenRoomTypeIsInvalid()
        {
            // Arrange
            var request = new CreateRoomRequest
            {
                RoomName = "Phong Sai Loai",
                RoomType = "InvalidRoomType",
                Floor = "1"
            };

            // Act
            var act = () => _service.CreateRoomAsync(request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.RoomMessage.InvalidRoomType);
            _roomRepositoryMock.Verify(
                r => r.IsRoomNameInUseAsync(It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()),
                Times.Never);
            _roomRepositoryMock.Verify(r => r.AddAsync(It.IsAny<Room>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID05 (A): Duplicate room name throws BadRequestException
        [Fact]
        public async Task CreateRoomAsync_ShouldThrowBadRequest_WhenRoomNameAlreadyExists()
        {
            // Arrange
            var request = new CreateRoomRequest
            {
                RoomName = "Phong 101",
                RoomType = RoomTypeConstants.GeneralTreatment
            };

            _roomRepositoryMock
                .Setup(r => r.IsRoomNameInUseAsync("Phong 101", null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            var act = () => _service.CreateRoomAsync(request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.RoomMessage.RoomNameExist);
            _roomRepositoryMock.Verify(r => r.AddAsync(It.IsAny<Room>(), It.IsAny<CancellationToken>()), Times.Never);
            _roomRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}

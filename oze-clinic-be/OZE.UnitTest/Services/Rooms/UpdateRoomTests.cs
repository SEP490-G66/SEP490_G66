using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Rooms
{
    // OZ-ROOM-04 UpdateRoom
    [Trait("Tab", "OZ-ROOM-04")]
    public class UpdateRoomTests : RoomTestBase
    {
        private static UpdateRoomRequest Request(
            string roomName = "Phong 101 Updated",
            string roomType = RoomTypeConstants.GeneralTreatment,
            string status = RoomConstants.ActiveStatus,
            string? floor = "2",
            string? description = "Updated desc") => new()
        {
            RoomName = roomName,
            RoomType = roomType,
            Status = status,
            Floor = floor,
            Description = description
        };

        // UTCID01 (N): Update room successfully when name changes and room stays Active with same type
        [Fact]
        public async Task UpdateRoomAsync_ShouldUpdateRoom_WhenRequestIsValid()
        {
            // Arrange
            var room = CreateSampleRoom();
            var request = Request();

            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);
            _roomRepositoryMock
                .Setup(r => r.IsRoomNameInUseAsync("Phong 101 Updated", ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            _roomRepositoryMock
                .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.UpdateRoomAsync(ValidRoomId, request);

            // Assert
            result.RoomName.Should().Be("Phong 101 Updated");
            result.RoomType.Should().Be(RoomTypeConstants.GeneralTreatment);
            result.Status.Should().Be(RoomConstants.ActiveStatus);
            result.Floor.Should().Be("2");
            result.Description.Should().Be("Updated desc");
            result.UpdatedAt.Should().NotBeNull();
            _roomRepositoryMock.Verify(
                r => r.HasUpcomingShiftsAsync(It.IsAny<int>(), It.IsAny<DateOnly>(), It.IsAny<TimeOnly>(), It.IsAny<CancellationToken>()),
                Times.Never);
            _roomRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (N): Case-only rename does not trigger duplicate-name check
        [Fact]
        public async Task UpdateRoomAsync_ShouldSkipNameUniquenessCheck_WhenOnlyCasingChanges()
        {
            // Arrange
            var room = CreateSampleRoom(roomName: "Phong 101");
            var request = Request(roomName: "phong 101", floor: "1", description: "Ghe so 1");

            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);
            _roomRepositoryMock
                .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.UpdateRoomAsync(ValidRoomId, request);

            // Assert
            result.RoomName.Should().Be("phong 101");
            _roomRepositoryMock.Verify(
                r => r.IsRoomNameInUseAsync(It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()),
                Times.Never);
        }

        // UTCID03 (N): Active to Inactive succeeds when room has no upcoming shifts
        [Fact]
        public async Task UpdateRoomAsync_ShouldDeactivateRoom_WhenNoUpcomingShifts()
        {
            // Arrange
            var room = CreateSampleRoom(status: RoomConstants.ActiveStatus);
            var request = Request(
                roomName: ValidRoomName,
                status: RoomConstants.InactiveStatus,
                floor: "1",
                description: "Ghe so 1");

            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);
            _roomRepositoryMock
                .Setup(r => r.HasUpcomingShiftsAsync(ValidRoomId, It.IsAny<DateOnly>(), It.IsAny<TimeOnly>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            _roomRepositoryMock
                .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.UpdateRoomAsync(ValidRoomId, request);

            // Assert
            result.Status.Should().Be(RoomConstants.InactiveStatus);
            _roomRepositoryMock.Verify(
                r => r.HasUpcomingShiftsAsync(ValidRoomId, It.IsAny<DateOnly>(), It.IsAny<TimeOnly>(), It.IsAny<CancellationToken>()),
                Times.Once);
        }

        // UTCID04 (B): Trim RoomName, Floor and Description before save
        [Fact]
        public async Task UpdateRoomAsync_ShouldTrimFields_WhenValuesHaveSurroundingWhitespace()
        {
            // Arrange
            var room = CreateSampleRoom();
            var request = Request(
                roomName: "  Phong 303  ",
                floor: " 3 ",
                description: "  Mo ta  ");

            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);
            _roomRepositoryMock
                .Setup(r => r.IsRoomNameInUseAsync("Phong 303", ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            _roomRepositoryMock
                .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.UpdateRoomAsync(ValidRoomId, request);

            // Assert
            result.RoomName.Should().Be("Phong 303");
            result.Floor.Should().Be("3");
            result.Description.Should().Be("Mo ta");
            _roomRepositoryMock.Verify(
                r => r.IsRoomNameInUseAsync("Phong 303", ValidRoomId, It.IsAny<CancellationToken>()),
                Times.Once);
        }

        // UTCID05 (A): Throw NotFoundException when room does not exist
        [Fact]
        public async Task UpdateRoomAsync_ShouldThrowNotFound_WhenRoomDoesNotExist()
        {
            // Arrange
            const int missingId = 999;
            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(missingId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Room?)null);

            // Act
            var act = () => _service.UpdateRoomAsync(missingId, Request());

            // Assert
            var error = await act.Should().ThrowAsync<NotFoundException>();
            error.Which.Message.Should().Be(ErrorConstants.RoomMessage.RoomNotFound);
            _roomRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID06 (A): Invalid room type throws BadRequestException
        [Fact]
        public async Task UpdateRoomAsync_ShouldThrowBadRequest_WhenRoomTypeIsInvalid()
        {
            // Arrange
            var room = CreateSampleRoom();
            var request = Request(roomType: "InvalidRoomType");

            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);

            // Act
            var act = () => _service.UpdateRoomAsync(ValidRoomId, request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.RoomMessage.InvalidRoomType);
            _roomRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID07 (A): Invalid status throws BadRequestException
        [Fact]
        public async Task UpdateRoomAsync_ShouldThrowBadRequest_WhenStatusIsInvalid()
        {
            // Arrange
            var room = CreateSampleRoom();
            var request = Request(status: "Closed");

            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);

            // Act
            var act = () => _service.UpdateRoomAsync(ValidRoomId, request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.RoomMessage.InvalidStatus);
            _roomRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID08 (A): Duplicate room name throws BadRequestException when name actually changes
        [Fact]
        public async Task UpdateRoomAsync_ShouldThrowBadRequest_WhenNewNameAlreadyExists()
        {
            // Arrange
            var room = CreateSampleRoom();
            var request = Request(roomName: "Phong Trung");

            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);
            _roomRepositoryMock
                .Setup(r => r.IsRoomNameInUseAsync("Phong Trung", ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            var act = () => _service.UpdateRoomAsync(ValidRoomId, request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.RoomMessage.RoomNameExist);
            _roomRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID09 (A): Cannot leave Active status when room still has upcoming shifts
        [Fact]
        public async Task UpdateRoomAsync_ShouldThrowBadRequest_WhenLeavingActiveWithUpcomingShifts()
        {
            // Arrange
            var room = CreateSampleRoom(status: RoomConstants.ActiveStatus);
            var request = Request(
                roomName: ValidRoomName,
                status: RoomConstants.MaintenanceStatus,
                floor: "1",
                description: "Ghe so 1");

            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);
            _roomRepositoryMock
                .Setup(r => r.HasUpcomingShiftsAsync(ValidRoomId, It.IsAny<DateOnly>(), It.IsAny<TimeOnly>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            var act = () => _service.UpdateRoomAsync(ValidRoomId, request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.RoomMessage.HasUpcomingShifts);
            _roomRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID10 (A): Cannot change room type when room still has upcoming shifts
        [Fact]
        public async Task UpdateRoomAsync_ShouldThrowBadRequest_WhenChangingTypeWithUpcomingShifts()
        {
            // Arrange
            var room = CreateSampleRoom(roomType: RoomTypeConstants.GeneralTreatment);
            var request = Request(
                roomName: ValidRoomName,
                roomType: RoomTypeConstants.XRay,
                floor: "1",
                description: "Ghe so 1");

            _roomRepositoryMock
                .Setup(r => r.GetByIdAsync(ValidRoomId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(room);
            _roomRepositoryMock
                .Setup(r => r.HasUpcomingShiftsAsync(ValidRoomId, It.IsAny<DateOnly>(), It.IsAny<TimeOnly>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            var act = () => _service.UpdateRoomAsync(ValidRoomId, request);

            // Assert
            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(ErrorConstants.RoomMessage.HasUpcomingShifts);
            _roomRepositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}

using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Rooms
{
    // OZ-ROOM-01 GetRooms
    [Trait("Tab", "OZ-ROOM-01")]
    public class GetRoomsTests : RoomTestBase
    {
        // UTCID01 (N): Return mapped room list when repository returns rooms (no filters)
        [Fact]
        public async Task GetRoomsAsync_ShouldReturnMappedRooms_WhenRepositoryReturnsRooms()
        {
            // Arrange
            var query = new RoomQueryRequest();
            var rooms = new List<Room>
            {
                CreateSampleRoom(1, "Phong 101"),
                CreateSampleRoom(2, "Phong 102", RoomTypeConstants.XRay, RoomConstants.ActiveStatus, "2", null)
            };

            _roomRepositoryMock
                .Setup(r => r.GetAllAsync(query, It.IsAny<CancellationToken>()))
                .ReturnsAsync(rooms);

            // Act
            var result = await _service.GetRoomsAsync(query);

            // Assert
            result.Should().HaveCount(2);
            result[0].Id.Should().Be(1);
            result[0].RoomName.Should().Be("Phong 101");
            result[0].RoomType.Should().Be(RoomTypeConstants.GeneralTreatment);
            result[0].Status.Should().Be(RoomConstants.ActiveStatus);
            result[0].Floor.Should().Be("1");
            result[0].Description.Should().Be("Ghe so 1");
            result[1].Id.Should().Be(2);
            result[1].RoomName.Should().Be("Phong 102");
            result[1].RoomType.Should().Be(RoomTypeConstants.XRay);
            result[1].Floor.Should().Be("2");
            result[1].Description.Should().BeNull();
            _roomRepositoryMock.Verify(r => r.GetAllAsync(query, It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (N): Forward Keyword, RoomType and Status filters to repository
        [Fact]
        public async Task GetRoomsAsync_ShouldPassQueryFiltersToRepository_WhenFiltersProvided()
        {
            // Arrange
            var query = new RoomQueryRequest
            {
                Keyword = "Phong",
                RoomType = RoomTypeConstants.GeneralTreatment,
                Status = RoomConstants.ActiveStatus
            };
            var rooms = new List<Room>
            {
                CreateSampleRoom()
            };

            _roomRepositoryMock
                .Setup(r => r.GetAllAsync(query, It.IsAny<CancellationToken>()))
                .ReturnsAsync(rooms);

            // Act
            var result = await _service.GetRoomsAsync(query);

            // Assert
            result.Should().HaveCount(1);
            result[0].RoomName.Should().Be(ValidRoomName);
            _roomRepositoryMock.Verify(
                r => r.GetAllAsync(
                    It.Is<RoomQueryRequest>(q =>
                        q.Keyword == "Phong"
                        && q.RoomType == RoomTypeConstants.GeneralTreatment
                        && q.Status == RoomConstants.ActiveStatus),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        // UTCID03 (N): Return empty list when repository returns no rooms
        [Fact]
        public async Task GetRoomsAsync_ShouldReturnEmptyList_WhenRepositoryReturnsNoRooms()
        {
            // Arrange
            var query = new RoomQueryRequest
            {
                Keyword = "KhongTonTai"
            };

            _roomRepositoryMock
                .Setup(r => r.GetAllAsync(query, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<Room>());

            // Act
            var result = await _service.GetRoomsAsync(query);

            // Assert
            result.Should().NotBeNull();
            result.Should().BeEmpty();
            _roomRepositoryMock.Verify(r => r.GetAllAsync(query, It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID04 (B): Null/empty filter values are still forwarded; service does not alter the query
        [Fact]
        public async Task GetRoomsAsync_ShouldForwardEmptyFilters_WhenKeywordRoomTypeStatusAreNullOrWhitespace()
        {
            // Arrange
            var query = new RoomQueryRequest
            {
                Keyword = "   ",
                RoomType = null,
                Status = string.Empty
            };
            var rooms = new List<Room> { CreateSampleRoom() };

            _roomRepositoryMock
                .Setup(r => r.GetAllAsync(query, It.IsAny<CancellationToken>()))
                .ReturnsAsync(rooms);

            // Act
            var result = await _service.GetRoomsAsync(query);

            // Assert
            result.Should().HaveCount(1);
            _roomRepositoryMock.Verify(
                r => r.GetAllAsync(
                    It.Is<RoomQueryRequest>(q =>
                        q.Keyword == "   "
                        && q.RoomType == null
                        && q.Status == string.Empty),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }
    }
}

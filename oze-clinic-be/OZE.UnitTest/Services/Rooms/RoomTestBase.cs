using AutoMapper;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.MappingProfiles;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Domain.Entities;

namespace OZE.UnitTest.Services.Rooms
{
    // Shared mocks, setup and sample data for Rooms service tests. Holds no tests itself.
    public abstract class RoomTestBase
    {
        protected readonly Mock<IRoomRepository> _roomRepositoryMock;
        protected readonly IMapper _mapper;
        protected readonly RoomService _service;

        protected const int ValidRoomId = 1;
        protected const string ValidRoomName = "Phong 101";

        protected RoomTestBase()
        {
            _roomRepositoryMock = new Mock<IRoomRepository>();

            var config = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<BaseMappingObject>();
            });
            _mapper = config.CreateMapper();

            _service = new RoomService(_roomRepositoryMock.Object, _mapper);
        }

        protected Room CreateSampleRoom(
            int id = ValidRoomId,
            string roomName = ValidRoomName,
            string roomType = RoomTypeConstants.GeneralTreatment,
            string status = RoomConstants.ActiveStatus,
            string? floor = "1",
            string? description = "Ghe so 1")
        {
            return new Room
            {
                Id = id,
                RoomName = roomName,
                RoomType = roomType,
                Status = status,
                Floor = floor,
                Description = description,
                CreatedAt = DateTimeOffset.Parse("2026-11-01T00:00:00Z"),
                UpdatedAt = null
            };
        }
    }
}

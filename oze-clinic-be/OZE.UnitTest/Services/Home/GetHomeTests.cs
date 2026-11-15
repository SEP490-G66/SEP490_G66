using FluentAssertions;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Home
{
    // OZ-HOME-01 GetHome
    [Trait("Tab", "OZ-HOME-01")]
    public class GetHomeTests
    {
        private readonly Mock<IHomeRepository> _repo = new();
        private readonly HomeService _service;

        public GetHomeTests()
        {
            _service = new HomeService(_repo.Object);
            _repo.Setup(r => r.GetActiveServiceAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new List<Service>());
            _repo.Setup(r => r.GetActiveDoctorAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new List<StaffProfile>());
        }

        // UTCID01 (N): the home page shows the active services and doctors
        [Fact]
        public async Task GetHomePageAsync_ShouldReturnServicesAndDoctors()
        {
            _repo.Setup(r => r.GetActiveServiceAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new List<Service>
            {
                new() { Id = 1, ServiceName = "Kham tong quat", ReferencePrice = 0, EstimatedMinutes = 30, IsActive = true },
                new() { Id = 4, ServiceName = "Cao voi", ReferencePrice = 300000, EstimatedMinutes = 30, IsActive = true }
            });
            _repo.Setup(r => r.GetActiveDoctorAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new List<StaffProfile>
            {
                new() { Id = 5, FullName = "BS. Nguyen Van A", Specialization = "Nha chu", IsActive = true }
            });

            var result = await _service.GetHomePageAsync();

            result.Services.Select(x => x.ServiceName).Should().Equal("Kham tong quat", "Cao voi");
            result.Services[1].ReferencePrice.Should().Be(300000);
            result.Doctors.Should().ContainSingle(x => x.FullName == "BS. Nguyen Van A" && x.Specialization == "Nha chu");
        }

        // UTCID02 (B): nothing is open yet
        [Fact]
        public async Task GetHomePageAsync_ShouldReturnEmptyLists_WhenNothingActive()
        {
            var result = await _service.GetHomePageAsync();

            result.Services.Should().BeEmpty();
            result.Doctors.Should().BeEmpty();
        }
    }
}

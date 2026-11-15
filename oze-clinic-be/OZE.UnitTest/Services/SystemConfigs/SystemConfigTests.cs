using FluentAssertions;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.SystemConfigs
{
    // Settings of the clinic: slot length (Int), opening and closing time, general exam service code
    public abstract class SystemConfigTestBase
    {
        protected readonly Mock<ISystemConfigurationRepository> _repo = new();
        protected readonly Mock<IServiceRepository> _serviceRepo = new();
        protected readonly Mock<IAuditLogService> _audit = new();
        protected readonly SystemConfigurationService _service;
        protected readonly SystemConfiguration _slot = new() { ConfigKey = ConfigKeyConstants.SlotDurationMinutes, ConfigValue = "30", DataType = "Int" };
        protected readonly SystemConfiguration _start = new() { ConfigKey = ConfigKeyConstants.ClinicWorkStartTime, ConfigValue = "08:00", DataType = "String" };
        protected readonly SystemConfiguration _end = new() { ConfigKey = ConfigKeyConstants.ClinicWorkEndTime, ConfigValue = "17:00", DataType = "String" };
        protected readonly SystemConfiguration _examCode = new() { ConfigKey = ConfigKeyConstants.GeneralExamServiceCode, ConfigValue = "DV-001", DataType = "String" };

        protected SystemConfigTestBase()
        {
            _service = new SystemConfigurationService(_repo.Object, _serviceRepo.Object, _audit.Object);
            foreach (var config in new[] { _slot, _start, _end, _examCode })
            {
                _repo.Setup(r => r.GetByKeyAsync(config.ConfigKey, It.IsAny<CancellationToken>())).ReturnsAsync(config);
            }
            _repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new List<SystemConfiguration> { _slot, _start, _end, _examCode });
        }
    }

    // OZ-CFG-01 GetSystemConfig
    [Trait("Tab", "OZ-CFG-01")]
    public class GetSystemConfigTests : SystemConfigTestBase
    {
        // UTCID01 (N): every setting is listed
        [Fact]
        public async Task GetAllAsync_ShouldReturnAllSettings()
        {
            var result = await _service.GetAllAsync();

            result.Should().HaveCount(4);
            result.Should().Contain(x => x.Key == ConfigKeyConstants.SlotDurationMinutes && x.Value == "30" && x.DataType == "Int");
        }

        // UTCID02 (N): one setting by its key, spaces around the key are ignored
        [Fact]
        public async Task GetByKeyAsync_ShouldReturnSetting()
        {
            var result = await _service.GetByKeyAsync(" " + ConfigKeyConstants.ClinicWorkStartTime + " ");

            result.Value.Should().Be("08:00");
        }

        // UTCID03 (A): a key that does not exist
        [Fact]
        public async Task GetByKeyAsync_ShouldThrow_WhenNotFound()
        {
            var act = () => _service.GetByKeyAsync("Clinic.Unknown");

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.SystemConfigMessage.NotFound);
        }
    }

    // OZ-CFG-02 UpdateSystemConfig
    [Trait("Tab", "OZ-CFG-02")]
    public class UpdateSystemConfigTests : SystemConfigTestBase
    {
        // UTCID01 (N): the slot length is changed, the change is audited
        [Fact]
        public async Task UpdateAsync_ShouldSaveNewValue()
        {
            var result = await _service.UpdateAsync(ConfigKeyConstants.SlotDurationMinutes, " 45 ", "admin-user");

            result.Value.Should().Be("45");
            _slot.UpdatedByUserId.Should().Be("admin-user");
            _repo.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
            _audit.Verify(a => a.LogAsync(AuditConstants.SystemConfigUpdated, AuditConstants.SystemConfigEntity, ConfigKeyConstants.SlotDurationMinutes,
                It.IsAny<object?>(), It.IsAny<object?>(), It.IsAny<string?>()), Times.Once);
        }

        // UTCID02 (N): the general exam code is saved in capitals when an active service has it
        [Fact]
        public async Task UpdateAsync_ShouldSaveServiceCode_WhenServiceActive()
        {
            _serviceRepo.Setup(r => r.GetByCodeAsync("DV-002", It.IsAny<CancellationToken>())).ReturnsAsync(new Service { ServiceCode = "DV-002", IsActive = true });

            var result = await _service.UpdateAsync(ConfigKeyConstants.GeneralExamServiceCode, "dv-002", "admin-user");

            result.Value.Should().Be("DV-002");
        }

        // UTCID03 (B): the same value saves nothing
        [Fact]
        public async Task UpdateAsync_ShouldDoNothing_WhenValueUnchanged()
        {
            await _service.UpdateAsync(ConfigKeyConstants.SlotDurationMinutes, "30", "admin-user");

            _repo.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID04 (A): a key that does not exist
        [Fact]
        public async Task UpdateAsync_ShouldThrow_WhenNotFound()
        {
            var act = () => _service.UpdateAsync("Clinic.Unknown", "1", "admin-user");

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.SystemConfigMessage.NotFound);
        }

        // UTCID05 (A): an empty value
        [Fact]
        public async Task UpdateAsync_ShouldThrow_WhenValueEmpty()
        {
            var act = () => _service.UpdateAsync(ConfigKeyConstants.SlotDurationMinutes, "  ", "admin-user");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.SystemConfigMessage.ValueRequired);
        }

        // UTCID06 (A): text where a whole number is needed
        [Fact]
        public async Task UpdateAsync_ShouldThrow_WhenNotWholeNumber()
        {
            var act = () => _service.UpdateAsync(ConfigKeyConstants.SlotDurationMinutes, "abc", "admin-user");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.SystemConfigMessage.InvalidInt);
        }

        // UTCID07 (B): a slot of 0 minutes
        [Fact]
        public async Task UpdateAsync_ShouldThrow_WhenSlotZero()
        {
            var act = () => _service.UpdateAsync(ConfigKeyConstants.SlotDurationMinutes, "0", "admin-user");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.SystemConfigMessage.MustBePositive);
        }

        // UTCID08 (A): a time not in HH:mm
        [Fact]
        public async Task UpdateAsync_ShouldThrow_WhenTimeInvalid()
        {
            var act = () => _service.UpdateAsync(ConfigKeyConstants.ClinicWorkStartTime, "8h", "admin-user");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.SystemConfigMessage.InvalidTime);
        }

        // UTCID09 (B): opening at the closing time
        [Fact]
        public async Task UpdateAsync_ShouldThrow_WhenOpeningNotBeforeClosing()
        {
            var act = () => _service.UpdateAsync(ConfigKeyConstants.ClinicWorkStartTime, "17:00", "admin-user");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.SystemConfigMessage.WorkTimeOrder);
        }

        // UTCID10 (A): no active service has the code
        [Fact]
        public async Task UpdateAsync_ShouldThrow_WhenServiceCodeUnknown()
        {
            var act = () => _service.UpdateAsync(ConfigKeyConstants.GeneralExamServiceCode, "DV-999", "admin-user");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.SystemConfigMessage.ServiceCodeNotFound);
        }

        // UTCID11 (B): a value one character over the limit
        [Fact]
        public async Task UpdateAsync_ShouldThrow_WhenValueTooLong()
        {
            var act = () => _service.UpdateAsync(ConfigKeyConstants.GeneralExamServiceCode, new string('A', 501), "admin-user");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.SystemConfigMessage.ValueTooLong);
        }
    }
}

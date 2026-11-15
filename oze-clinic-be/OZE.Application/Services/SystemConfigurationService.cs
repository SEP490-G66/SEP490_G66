using System.Globalization;
using System.Text.Json;
using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.Services
{
    public class SystemConfigurationService : ISystemConfigurationService
    {
        // Must match the ConfigValue column length in SystemConfigurationConfiguration
        private const int MaxValueLength = 500;
        private const string TimeFormat = "HH:mm";

        // Values the booking and slot logic divides or counts with, so 0 would break it
        private static readonly string[] PositiveIntKeys =
        {
            ConfigKeyConstants.SlotDurationMinutes,
            ConfigKeyConstants.BookingMaxDaysAhead
        };

        private readonly ISystemConfigurationRepository _repository;
        private readonly IServiceRepository _serviceRepository;
        private readonly IAuditLogService _auditLogService;

        public SystemConfigurationService(
            ISystemConfigurationRepository repository,
            IServiceRepository serviceRepository,
            IAuditLogService auditLogService)
        {
            _repository = repository;
            _serviceRepository = serviceRepository;
            _auditLogService = auditLogService;
        }

        public async Task<List<SystemConfigurationResponse>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            var configs = await _repository.GetAllAsync(cancellationToken);
            return configs.Select(ToResponse).ToList();
        }

        public async Task<SystemConfigurationResponse> GetByKeyAsync(string key, CancellationToken cancellationToken = default)
        {
            var config = await _repository.GetByKeyAsync(key?.Trim() ?? string.Empty, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(config != null, ErrorConstants.SystemConfigMessage.NotFound);
            return ToResponse(config!);
        }

        public async Task<SystemConfigurationResponse> UpdateAsync(string key, string? value, string userId, CancellationToken cancellationToken = default)
        {
            var config = await _repository.GetByKeyAsync(key?.Trim() ?? string.Empty, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(config != null, ErrorConstants.SystemConfigMessage.NotFound);

            var newValue = await ValidateAsync(config!, value, cancellationToken);
            if (newValue == config!.ConfigValue)
            {
                return ToResponse(config);
            }

            var oldValue = config.ConfigValue;
            config.ConfigValue = newValue;
            config.UpdatedAt = DateTimeOffset.UtcNow;
            config.UpdatedByUserId = userId;
            await _repository.SaveChangesAsync(cancellationToken);

            await _auditLogService.LogAsync(AuditConstants.SystemConfigUpdated, AuditConstants.SystemConfigEntity, config.ConfigKey,
                new { Value = oldValue }, new { Value = newValue });

            return ToResponse(config);
        }

        // Checks the value against the type of the setting and the few settings with their own rules; returns it normalized
        private async Task<string> ValidateAsync(SystemConfiguration config, string? value, CancellationToken cancellationToken)
        {
            var trimmed = value?.Trim() ?? string.Empty;
            ConditionGuard.Ensure(trimmed.Length > 0, ErrorConstants.SystemConfigMessage.ValueRequired);
            ConditionGuard.Ensure(trimmed.Length <= MaxValueLength, ErrorConstants.SystemConfigMessage.ValueTooLong);

            switch (config.DataType)
            {
                case "Int":
                    ConditionGuard.Ensure(int.TryParse(trimmed, NumberStyles.None, CultureInfo.InvariantCulture, out var number),
                        ErrorConstants.SystemConfigMessage.InvalidInt);
                    ConditionGuard.ThrowIf(PositiveIntKeys.Contains(config.ConfigKey) && number == 0,
                        ErrorConstants.SystemConfigMessage.MustBePositive);
                    return number.ToString(CultureInfo.InvariantCulture);

                case "Bool":
                    ConditionGuard.Ensure(bool.TryParse(trimmed, out var flag), ErrorConstants.SystemConfigMessage.InvalidBool);
                    return flag ? "true" : "false";

                case "Decimal":
                    ConditionGuard.Ensure(decimal.TryParse(trimmed, NumberStyles.Number, CultureInfo.InvariantCulture, out var amount),
                        ErrorConstants.SystemConfigMessage.InvalidDecimal);
                    return amount.ToString(CultureInfo.InvariantCulture);

                case "Json":
                    try
                    {
                        using var _ = JsonDocument.Parse(trimmed);
                    }
                    catch (JsonException)
                    {
                        throw new BadRequestException(ErrorConstants.SystemConfigMessage.InvalidJson);
                    }
                    return trimmed;
            }

            // String settings with a meaning the code relies on
            if (config.ConfigKey == ConfigKeyConstants.ClinicWorkStartTime || config.ConfigKey == ConfigKeyConstants.ClinicWorkEndTime)
            {
                ConditionGuard.Ensure(TimeOnly.TryParseExact(trimmed, TimeFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time),
                    ErrorConstants.SystemConfigMessage.InvalidTime);
                await EnsureWorkTimeOrderAsync(config.ConfigKey, time, cancellationToken);
                return time.ToString(TimeFormat, CultureInfo.InvariantCulture);
            }

            if (config.ConfigKey == ConfigKeyConstants.GeneralExamServiceCode)
            {
                // Every booking starts with this service, so it must exist and be open
                var code = trimmed.ToUpperInvariant();
                var service = await _serviceRepository.GetByCodeAsync(code, cancellationToken);
                ConditionGuard.Ensure(service != null && service.IsActive, ErrorConstants.SystemConfigMessage.ServiceCodeNotFound);
                return code;
            }

            return trimmed;
        }

        // Opening time stays before closing time whichever of the two is changed
        private async Task EnsureWorkTimeOrderAsync(string key, TimeOnly time, CancellationToken cancellationToken)
        {
            var otherKey = key == ConfigKeyConstants.ClinicWorkStartTime ? ConfigKeyConstants.ClinicWorkEndTime : ConfigKeyConstants.ClinicWorkStartTime;
            var other = await _repository.GetByKeyAsync(otherKey, cancellationToken);
            if (other == null || !TimeOnly.TryParseExact(other.ConfigValue, TimeFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var otherTime))
            {
                return;
            }

            var (start, end) = key == ConfigKeyConstants.ClinicWorkStartTime ? (time, otherTime) : (otherTime, time);
            ConditionGuard.Ensure(start < end, ErrorConstants.SystemConfigMessage.WorkTimeOrder);
        }

        private static SystemConfigurationResponse ToResponse(SystemConfiguration x) => new()
        {
            Key = x.ConfigKey,
            Value = x.ConfigValue,
            DataType = x.DataType,
            Description = x.Description,
            UpdatedAt = x.UpdatedAt,
            UpdatedByUserId = x.UpdatedByUserId
        };
    }
}

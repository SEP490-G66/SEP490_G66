using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Common.Constants;

namespace OZE.Application.BackgroundServices
{
    /// <summary>
    /// Background Service chạy định kỳ trong hệ thống: tự động quét và đánh dấu trạng thái NO_SHOW
    /// cho các lịch hẹn PENDING mà ngày hẹn đã trôi qua mà chưa từng được xác nhận.
    /// </summary>
    public class PendingNoShowBackgroundService : BackgroundService
    {
        private const int CheckIntervalMinutes = 30;

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<PendingNoShowBackgroundService> _logger;
        private DateOnly? _lastRunClinicDate;

        public PendingNoShowBackgroundService(IServiceScopeFactory scopeFactory, ILogger<PendingNoShowBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Brief initial delay so the application can finish startup completely
            await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var today = DateOnly.FromDateTime(ClinicClock.Now);
                    if (_lastRunClinicDate != today)
                    {
                        var count = await MarkAsync(today, stoppingToken);
                        _logger.LogInformation("Pending appointments before {Date} marked NO_SHOW: {Count}.", today, count);
                        _lastRunClinicDate = today;
                    }
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unexpected error in PendingNoShowBackgroundService.");
                }

                await Task.Delay(TimeSpan.FromMinutes(CheckIntervalMinutes), stoppingToken);
            }
        }

        private async Task<int> MarkAsync(DateOnly today, CancellationToken cancellationToken)
        {
            using var scope = _scopeFactory.CreateScope();
            var appointments = scope.ServiceProvider.GetRequiredService<IAppointmentRepository>();
            var audit = scope.ServiceProvider.GetRequiredService<IAuditLogService>();

            var ids = await appointments.MarkPastPendingAsNoShowAsync(today, cancellationToken);
            foreach (var id in ids)
            {
                await audit.LogAsync(AuditConstants.AppointmentAutoNoShow, AuditConstants.AppointmentEntity, id.ToString(),
                    new { Status = AppointmentConstants.PendingStatus }, new { Status = AppointmentConstants.NoShowStatus },
                    "Not confirmed before the appointment day");
            }
            return ids.Count;
        }
    }
}

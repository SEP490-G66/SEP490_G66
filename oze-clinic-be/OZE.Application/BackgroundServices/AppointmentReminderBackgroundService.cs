using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;

namespace OZE.Application.BackgroundServices
{
    // Once a day, from RunHour (clinic time), reminds every patient with a pending or confirmed appointment tomorrow.
    // A patient already reminded about an appointment is skipped, so a restart on the same day does not send it twice.
    public class AppointmentReminderBackgroundService : BackgroundService
    {
        private const int RunHour = 8;
        private const int CheckIntervalMinutes = 30;
        private const int PageSize = 100;
        private static readonly string[] RemindedStatuses = { AppointmentConstants.PendingStatus, AppointmentConstants.ConfirmedStatus };

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AppointmentReminderBackgroundService> _logger;
        private DateOnly? _lastRunClinicDate;

        public AppointmentReminderBackgroundService(IServiceScopeFactory scopeFactory, ILogger<AppointmentReminderBackgroundService> logger)
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
                    var clinicNow = ClinicClock.Now;
                    var today = DateOnly.FromDateTime(clinicNow);
                    if (clinicNow.Hour >= RunHour && _lastRunClinicDate != today)
                    {
                        var sent = await RemindAsync(today.AddDays(1), stoppingToken);
                        _logger.LogInformation("Appointment reminders for {Date}: {Sent} sent.", today.AddDays(1), sent);
                        _lastRunClinicDate = today;
                    }
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unexpected error in AppointmentReminderBackgroundService.");
                }

                await Task.Delay(TimeSpan.FromMinutes(CheckIntervalMinutes), stoppingToken);
            }
        }

        private async Task<int> RemindAsync(DateOnly date, CancellationToken cancellationToken)
        {
            using var scope = _scopeFactory.CreateScope();
            var appointments = scope.ServiceProvider.GetRequiredService<IAppointmentRepository>();
            var notificationRepository = scope.ServiceProvider.GetRequiredService<INotificationRepository>();
            var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();
            var title = NotificationConstants.Text.AppointmentReminderTitle;
            var sent = 0;

            foreach (var status in RemindedStatuses)
            {
                for (var page = 1; ; page++)
                {
                    var result = await appointments.GetAppointmentsAsync(
                        new AppointmentQueryParameters { Date = date, Status = status, PageNumber = page, PageSize = PageSize }, cancellationToken);
                    foreach (var appointment in result.Items)
                    {
                        var userId = appointment.Patient?.UserId;
                        var referenceId = appointment.Id.ToString();
                        if (string.IsNullOrWhiteSpace(userId)
                            || await notificationRepository.ExistsAsync(userId, title, NotificationConstants.Reference.Appointment, referenceId, cancellationToken))
                        {
                            continue;
                        }

                        var message = string.Format(NotificationConstants.Text.AppointmentReminderMessage,
                            appointment.TimeSlotStart?.ToString("HH:mm") ?? string.Empty, appointment.AppointmentDate.ToString("dd/MM/yyyy"));
                        await notifications.NotifyUsersAsync(new[] { userId },
                            new NotificationContent(title, message, NotificationConstants.Reference.Appointment, referenceId), cancellationToken);
                        sent++;
                    }

                    if (result.Items.Count < PageSize)
                    {
                        break;
                    }
                }
            }

            return sent;
        }
    }
}

using Microsoft.EntityFrameworkCore;
using OZE.Domain.Entities;

namespace OZE.Persistence.Repositories
{
    // The one query every repository uses to read a setting from SystemConfigurations
    internal static class SystemConfigurationQueries
    {
        public static Task<string?> ValueOfAsync(this DbSet<SystemConfiguration> configurations, string configKey,
            CancellationToken cancellationToken = default) =>
            configurations
                .AsNoTracking()
                .Where(x => x.ConfigKey == configKey)
                .Select(x => (string?)x.ConfigValue)
                .FirstOrDefaultAsync(cancellationToken);
    }
}

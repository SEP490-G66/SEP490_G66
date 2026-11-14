using Microsoft.EntityFrameworkCore;
using OZE.Application.Interfaces;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;

namespace OZE.Persistence.Repositories
{
    public class SystemConfigurationRepository : ISystemConfigurationRepository
    {
        private readonly AppIdentityDbContext _context;

        public SystemConfigurationRepository(AppIdentityDbContext context)
        {
            _context = context;
        }

        public Task<List<SystemConfiguration>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            return _context.SystemConfigurations.AsNoTracking().OrderBy(x => x.ConfigKey).ToListAsync(cancellationToken);
        }

        public Task<SystemConfiguration?> GetByKeyAsync(string key, CancellationToken cancellationToken = default)
        {
            return _context.SystemConfigurations.FirstOrDefaultAsync(x => x.ConfigKey == key, cancellationToken);
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return _context.SaveChangesAsync(cancellationToken);
        }
    }
}

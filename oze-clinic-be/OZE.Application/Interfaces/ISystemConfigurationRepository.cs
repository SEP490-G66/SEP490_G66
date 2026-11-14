using OZE.Domain.Entities;

namespace OZE.Application.Interfaces
{
    public interface ISystemConfigurationRepository
    {
        Task<List<SystemConfiguration>> GetAllAsync(CancellationToken cancellationToken = default);
        // Tracked, so it can be updated
        Task<SystemConfiguration?> GetByKeyAsync(string key, CancellationToken cancellationToken = default);
        Task SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}

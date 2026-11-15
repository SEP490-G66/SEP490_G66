using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    // System settings for the clinic manager: view all, change the value of one. Keys are fixed by the code, so none is added or removed.
    public interface ISystemConfigurationService
    {
        Task<List<SystemConfigurationResponse>> GetAllAsync(CancellationToken cancellationToken = default);
        Task<SystemConfigurationResponse> GetByKeyAsync(string key, CancellationToken cancellationToken = default);
        Task<SystemConfigurationResponse> UpdateAsync(string key, string? value, string userId, CancellationToken cancellationToken = default);
    }
}

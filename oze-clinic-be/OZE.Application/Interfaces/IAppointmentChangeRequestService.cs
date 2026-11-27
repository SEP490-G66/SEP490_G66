using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    public interface IAppointmentChangeRequestService
    {
        Task<AppointmentChangeRequestResponse> CreateAsync(string patientUserId, CreateAppointmentChangeRequest request, CancellationToken cancellationToken = default);
        Task<List<AppointmentChangeRequestResponse>> GetMineAsync(string patientUserId, CancellationToken cancellationToken = default);
        Task<AppointmentChangeRequestResponse> WithdrawAsync(string patientUserId, long id, CancellationToken cancellationToken = default);
        Task<List<AppointmentChangeRequestResponse>> GetAllAsync(string? status, CancellationToken cancellationToken = default);
        Task<AppointmentChangeRequestResponse> ResolveAsync(string staffUserId, long id, ResolveAppointmentChangeRequest request, CancellationToken cancellationToken = default);
    }
}

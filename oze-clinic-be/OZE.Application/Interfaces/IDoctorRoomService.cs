using OZE.Common.Models;

namespace OZE.Application.Interfaces
{
    // The doctor's examination room for today ("Khám bệnh"): the queue with every id the screen needs, and who is done
    public interface IDoctorRoomService
    {
        Task<DoctorRoomResponse> GetAsync(string doctorUserId, CancellationToken cancellationToken = default);
    }
}

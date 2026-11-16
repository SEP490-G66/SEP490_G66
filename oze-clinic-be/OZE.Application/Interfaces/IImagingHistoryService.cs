using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Application.Interfaces
{
    // The technician's "Lịch sử chụp chiếu": imaging requests that were done or cancelled
    public interface IImagingHistoryService
    {
        Task<PagedResult<ImagingHistoryItemResponse>> GetHistoryAsync(ImagingHistoryQuery query, CancellationToken cancellationToken = default);
        Task<ImagingHistoryDetailResponse> GetDetailAsync(long id, CancellationToken cancellationToken = default);
    }
}

using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Application.Middlewares;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;

namespace OZE.Application.Services
{
    public class ImagingHistoryService : IImagingHistoryService
    {
        private readonly IImagingRequestRepository _imagingRequestRepository;
        private readonly IImagingCaptureRepository _captureRepository;

        public ImagingHistoryService(IImagingRequestRepository imagingRequestRepository, IImagingCaptureRepository captureRepository)
        {
            _imagingRequestRepository = imagingRequestRepository;
            _captureRepository = captureRepository;
        }

        public async Task<PagedResult<ImagingHistoryItemResponse>> GetHistoryAsync(ImagingHistoryQuery query, CancellationToken cancellationToken = default)
        {
            var filter = Normalize(query);
            var from = filter.From.HasValue ? StartOfClinicDay(filter.From.Value) : (DateTimeOffset?)null;
            var toExclusive = filter.To.HasValue ? StartOfClinicDay(filter.To.Value.AddDays(1)) : (DateTimeOffset?)null;

            var page = await _imagingRequestRepository.GetHistoryAsync(filter, ParseOrderCode(filter.Keyword), from, toExclusive, cancellationToken);
            var devices = await LatestDevicesAsync(page.Items.Select(x => x.Id).ToList(), cancellationToken);

            var items = page.Items
                .Select(request => Fill(new ImagingHistoryItemResponse(), request, devices.GetValueOrDefault(request.Id)))
                .ToList();
            return new PagedResult<ImagingHistoryItemResponse>(items, page.TotalCount, page.PageNumber, page.PageSize);
        }

        public async Task<ImagingHistoryDetailResponse> GetDetailAsync(long id, CancellationToken cancellationToken = default)
        {
            var request = await _imagingRequestRepository.GetHistoryDetailAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(request != null, ErrorConstants.ImagingRequestMessage.RequestNotFound);

            var devices = await LatestDevicesAsync(new List<long> { id }, cancellationToken);
            var results = request!.Results.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).ToList();
            var patient = request.Examination?.Patient;

            var detail = Fill(new ImagingHistoryDetailResponse(), request, devices.GetValueOrDefault(id));
            detail.Gender = patient?.Gender;
            detail.BirthDate = patient?.DateOfBirth;
            detail.ClinicalIndication = request.ClinicalIndication ?? string.Empty;
            detail.TechnicianName = results.Select(x => x.UploadedByTechnician?.FullName?.Trim()).FirstOrDefault(x => !string.IsNullOrEmpty(x));
            detail.TechnicianNote = results.Select(x => x.TechnicianNotes).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)) ?? request.Notes;
            detail.Images = results.Select(result => new ImagingHistoryImageResponse
            {
                Id = result.Id,
                FileName = result.FileName,
                MimeType = result.MimeType,
                FileUrl = result.FilePath.StartsWith(ImagingCaptureConstants.MockFilePrefix, StringComparison.OrdinalIgnoreCase)
                    ? null
                    : $"/api/imaging-results/{result.Id}/file",
                ReviewStatus = result.ReviewStatus,
                CreatedAt = result.CreatedAt
            }).ToList();
            return detail;
        }

        // Checks the filters and fills in the paging defaults
        private static ImagingHistoryQuery Normalize(ImagingHistoryQuery query)
        {
            var status = string.IsNullOrWhiteSpace(query.Status) ? null : query.Status.Trim();
            ConditionGuard.Ensure<BadRequestException>(
                status == null || ImagingRequestConstants.HistoryStatuses.Contains(status),
                ErrorConstants.ImagingCaptureMessage.HistoryStatusInvalid);
            ConditionGuard.Ensure<BadRequestException>(
                !query.From.HasValue || !query.To.HasValue || query.From.Value <= query.To.Value,
                ErrorConstants.ImagingCaptureMessage.HistoryDateRangeInvalid);

            return new ImagingHistoryQuery
            {
                Keyword = string.IsNullOrWhiteSpace(query.Keyword) ? null : query.Keyword.Trim(),
                ImagingType = string.IsNullOrWhiteSpace(query.ImagingType) ? null : query.ImagingType.Trim(),
                Status = status,
                From = query.From,
                To = query.To,
                Page = Math.Max(1, query.Page),
                PageSize = query.PageSize < 1
                    ? ImagingRequestConstants.HistoryDefaultPageSize
                    : Math.Min(query.PageSize, ImagingRequestConstants.HistoryMaxPageSize)
            };
        }

        // "IR-1031" or "1031" also finds the request by its number
        private static long? ParseOrderCode(string? keyword)
        {
            if (string.IsNullOrEmpty(keyword))
            {
                return null;
            }

            var digits = keyword.StartsWith(ImagingCaptureConstants.OrderReferencePrefix, StringComparison.OrdinalIgnoreCase)
                ? keyword[ImagingCaptureConstants.OrderReferencePrefix.Length..]
                : keyword;
            return long.TryParse(digits, out var id) && id > 0 ? id : null;
        }

        private static DateTimeOffset StartOfClinicDay(DateOnly day)
        {
            return new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(ClinicTimeConstants.UtcOffsetHours));
        }

        // Device of the latest completed capture of each request; requests uploaded by hand have none
        private async Task<Dictionary<long, ImagingCapture>> LatestDevicesAsync(List<long> requestIds, CancellationToken cancellationToken)
        {
            if (requestIds.Count == 0)
            {
                return new Dictionary<long, ImagingCapture>();
            }

            var captures = await _captureRepository.GetCompletedByRequestIdsAsync(requestIds, cancellationToken);
            return captures
                .GroupBy(x => x.ImagingRequestId)
                .ToDictionary(group => group.Key, group => group.First());
        }

        private static T Fill<T>(T row, ImagingRequest request, ImagingCapture? capture) where T : ImagingHistoryItemResponse
        {
            var cancelled = request.RequestStatus == ImagingRequestConstants.Cancelled;
            var lastPicture = request.Results.Count == 0 ? (DateTimeOffset?)null : request.Results.Max(x => x.CreatedAt);

            row.Id = request.Id;
            row.Status = request.RequestStatus;
            row.PatientId = request.Examination?.PatientId ?? 0;
            row.PatientName = request.Examination?.Patient?.FullName?.Trim() ?? string.Empty;
            row.PatientCode = request.Examination?.Patient?.PatientCode ?? string.Empty;
            row.ImagingType = request.ImagingType;
            row.TargetArea = request.TargetArea ?? string.Empty;
            row.DoctorName = request.RequestedByDoctor?.FullName?.Trim() ?? string.Empty;
            row.DeviceId = capture?.DeviceId;
            row.ImageCount = request.Results.Count;
            row.CancelReason = request.CancelReason;
            row.CreatedAt = request.CreatedAt;
            row.CompletedAt = cancelled ? null : capture?.CompletedAt ?? lastPicture ?? request.UpdatedAt;
            row.CancelledAt = cancelled ? request.UpdatedAt : null;
            return row;
        }
    }
}

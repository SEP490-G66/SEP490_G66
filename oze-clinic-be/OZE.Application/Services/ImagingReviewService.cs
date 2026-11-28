using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.Services
{
    public class ImagingReviewService : IImagingReviewService
    {
        private readonly IImagingRequestRepository _imagingRequestRepository;
        private readonly IStaffRepository _staffRepository;
        private readonly IImagingRequestService _imagingRequestService;

        public ImagingReviewService(
            IImagingRequestRepository imagingRequestRepository,
            IStaffRepository staffRepository,
            IImagingRequestService imagingRequestService)
        {
            _imagingRequestRepository = imagingRequestRepository;
            _staffRepository = staffRepository;
            _imagingRequestService = imagingRequestService;
        }

        public async Task<List<ImagingReviewResponse>> GetReviewsAsync(string doctorUserId, string? status, CancellationToken cancellationToken = default)
        {
            var wanted = string.IsNullOrWhiteSpace(status) ? null : status.Trim();
            ConditionGuard.Ensure<BadRequestException>(
                wanted == null || ImagingRequestConstants.ReviewStatuses.Contains(wanted, StringComparer.OrdinalIgnoreCase),
                ErrorConstants.ImagingCaptureMessage.ReviewStatusInvalid);

            var doctor = await RequireDoctorAsync(doctorUserId);
            var requests = await _imagingRequestRepository.GetForReviewAsync(doctor.Id, ImagingRequestConstants.ReviewListLimit, cancellationToken);
            return requests
                .Select(ToResponse)
                .Where(review => wanted == null || string.Equals(review.Status, wanted, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        public async Task<ImagingReviewResponse> ApproveAsync(string doctorUserId, long imagingRequestId, CancellationToken cancellationToken = default)
        {
            var (doctor, request) = await RequireReviewableAsync(doctorUserId, imagingRequestId, cancellationToken);
            var waiting = request.Results.Where(x => x.ReviewStatus == MedicalRecordConstants.PendingImageStatus).ToList();
            ConditionGuard.Ensure(waiting.Count > 0, ErrorConstants.ImagingCaptureMessage.NothingToReview);

            var now = ClinicClock.UtcNow;
            foreach (var result in waiting)
            {
                result.ReviewStatus = MedicalRecordConstants.ReviewedImageStatus;
                result.ReviewedByDoctorId = doctor.Id;
                result.ReviewedAt = now;
            }
            await _imagingRequestRepository.SaveChangesAsync(cancellationToken);
            return ToResponse(request);
        }

        public async Task<ImagingReviewResponse> RetakeAsync(
            string doctorUserId,
            long imagingRequestId,
            RetakeImagingRequest body,
            CancellationToken cancellationToken = default)
        {
            var reason = body?.Reason?.Trim();
            ConditionGuard.Ensure(!string.IsNullOrEmpty(reason), ErrorConstants.ImagingCaptureMessage.RetakeReasonRequired);
            ConditionGuard.Ensure(reason!.Length <= ImagingRequestConstants.RetakeReasonMaxLength, ErrorConstants.ImagingCaptureMessage.RetakeReasonInvalid);

            var (doctor, request) = await RequireReviewableAsync(doctorUserId, imagingRequestId, cancellationToken);
            ConditionGuard.Ensure(
                request.Results.Any(x => x.ReviewStatus == MedicalRecordConstants.PendingImageStatus),
                ErrorConstants.ImagingCaptureMessage.NothingToReview);

            // The new order goes through the normal flow: the examination must still be open, the technician is told,
            // the patient goes back to the imaging queue. Nothing is rejected if that fails.
            var retake = await _imagingRequestService.CreateAsync(doctorUserId, request.ExaminationId, new CreateImagingRequest
            {
                ImagingType = request.ImagingType,
                TargetArea = request.TargetArea,
                ClinicalIndication = request.ClinicalIndication
            }, cancellationToken);

            var now = ClinicClock.UtcNow;
            foreach (var result in request.Results.Where(x => x.ReviewStatus == MedicalRecordConstants.PendingImageStatus))
            {
                result.ReviewStatus = MedicalRecordConstants.RejectedImageStatus;
                result.ReviewedByDoctorId = doctor.Id;
                result.ReviewedAt = now;
                result.DoctorNotes = reason;
            }

            var newRequest = await _imagingRequestRepository.GetTrackedByIdAsync(retake.Id, cancellationToken);
            if (newRequest != null)
            {
                newRequest.Notes = string.Format(ImagingRequestConstants.RetakeNotePrefix, request.Id, reason);
            }
            await _imagingRequestRepository.SaveChangesAsync(cancellationToken);
            return ToResponse(request);
        }

        private async Task<StaffProfile> RequireDoctorAsync(string doctorUserId)
        {
            var doctor = await _staffRepository.GetByUserIdAsync(doctorUserId);
            ConditionGuard.Ensure<NotFoundException>(doctor != null, ErrorConstants.MedicalRecordMessage.DoctorNotFound);
            return doctor!;
        }

        // Only the doctor who ordered it reviews a request, and only once the pictures are in
        private async Task<(StaffProfile Doctor, ImagingRequest Request)> RequireReviewableAsync(
            string doctorUserId,
            long imagingRequestId,
            CancellationToken cancellationToken)
        {
            var doctor = await RequireDoctorAsync(doctorUserId);
            var request = await _imagingRequestRepository.GetTrackedWithResultsAsync(imagingRequestId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(request != null, ErrorConstants.ImagingRequestMessage.RequestNotFound);
            ConditionGuard.Ensure<ForbiddenException>(request!.RequestedByDoctorId == doctor.Id, ErrorConstants.ImagingCaptureMessage.CannotReviewRequest);
            ConditionGuard.Ensure(
                request.RequestStatus == ImagingRequestConstants.Completed,
                string.Format(ErrorConstants.ImagingCaptureMessage.ReviewNotCompleted, request.RequestStatus));
            return (doctor, request);
        }

        private static string ReviewStatusOf(ImagingRequest request)
        {
            if (request.RequestStatus == ImagingRequestConstants.Cancelled)
            {
                return ImagingRequestConstants.ReviewCancelled;
            }
            if (request.Results.Count == 0 || request.Results.Any(x => x.ReviewStatus == MedicalRecordConstants.PendingImageStatus))
            {
                return ImagingRequestConstants.ReviewPending;
            }
            // The doctor's latest decision counts: older rejected sample pictures do not hide a later approval, and the other way round
            var latest = request.Results
                .OrderByDescending(x => x.ReviewedAt ?? x.CreatedAt)
                .ThenByDescending(x => x.Id)
                .First();
            return latest.ReviewStatus == MedicalRecordConstants.RejectedImageStatus
                ? ImagingRequestConstants.ReviewRetake
                : ImagingRequestConstants.ReviewApproved;
        }

        private static ImagingReviewResponse ToResponse(ImagingRequest request)
        {
            var results = request.Results.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).ToList();
            var patient = request.Examination?.Patient;
            return new ImagingReviewResponse
            {
                Id = request.Id,
                ExaminationId = request.ExaminationId,
                Status = ReviewStatusOf(request),
                ImagingType = request.ImagingType,
                TargetArea = request.TargetArea ?? string.Empty,
                ClinicalIndication = request.ClinicalIndication ?? string.Empty,
                TechnicianName = results.Select(x => x.UploadedByTechnician?.FullName?.Trim()).FirstOrDefault(x => !string.IsNullOrEmpty(x)),
                RetakeReason = results
                    .Where(x => x.ReviewStatus == MedicalRecordConstants.RejectedImageStatus)
                    .Select(x => x.DoctorNotes)
                    .FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)),
                OrderedAt = request.CreatedAt,
                CapturedAt = results.Count == 0 ? null : results.Max(x => x.CreatedAt),
                ReviewedAt = results.Max(x => x.ReviewedAt),
                Patient = new ImagingReviewPatientResponse
                {
                    Id = patient?.Id ?? 0,
                    Name = patient?.FullName?.Trim() ?? string.Empty,
                    Code = patient?.PatientCode ?? string.Empty,
                    Gender = patient?.Gender,
                    BirthDate = patient?.DateOfBirth
                },
                Images = results.Select(result => new ImagingHistoryImageResponse
                {
                    Id = result.Id,
                    FileName = result.FileName,
                    MimeType = result.MimeType,
                    FileUrl = result.FilePath.StartsWith(ImagingCaptureConstants.MockFilePrefix, StringComparison.OrdinalIgnoreCase)
                        ? null
                        : $"/api/imaging-results/{result.Id}/file",
                    ReviewStatus = result.ReviewStatus,
                    CreatedAt = result.CreatedAt
                }).ToList()
            };
        }
    }
}

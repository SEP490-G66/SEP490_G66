using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Application.Interfaces
{
    /// <summary>
    /// Service quản lý toàn bộ vòng đời của kế hoạch điều trị (Treatment Plan):
    /// tạo nháp, đề xuất, bệnh nhân duyệt, hủy, cập nhật giai đoạn và theo dõi tiến độ.
    /// </summary>
    public interface ITreatmentPlanService
    {
        /// <summary>Tạo kế hoạch điều trị từ một buổi khám cụ thể.</summary>
        Task<TreatmentPlanProgressResponse> CreateAsync(long examinationId, CreateTreatmentPlanRequest request,
            string userId, CancellationToken cancellationToken = default);

        /// <summary>Tạo kế hoạch điều trị trực tiếp không thông qua buổi khám.</summary>
        Task<TreatmentPlanProgressResponse> CreateAsync(CreateTreatmentPlanRequest request,
            string userId, CancellationToken cancellationToken = default);

        /// <summary>Lấy thông tin chi tiết kèm tiến độ của kế hoạch điều trị (có phân quyền bác sĩ/lễ tân).</summary>
        Task<TreatmentPlanProgressResponse> GetDetailAsync(long treatmentPlanId, string userId, bool canViewAll,
            CancellationToken cancellationToken = default);

        /// <summary>Lấy danh sách các kế hoạch điều trị của một bệnh nhân.</summary>
        // "Buổi chờ xếp giờ": sessions the front desk still has to give a time
        Task<List<PendingPlanSessionResponse>> GetPendingSessionsAsync(CancellationToken cancellationToken = default);

        // Doctors a session of this service can be given to, the ones who work in its kind of room first
        Task<List<PlanDoctorOptionResponse>> GetDoctorOptionsAsync(int? serviceId, CancellationToken cancellationToken = default);

        Task<List<TreatmentPlanSummaryResponse>> GetByPatientAsync(int patientId, bool includeClosed, string userId, bool canViewAll,
            CancellationToken cancellationToken = default);

        /// <summary>Lấy danh sách phân trang các kế hoạch điều trị theo bộ lọc tìm kiếm.</summary>
        Task<PagedResult<TreatmentPlanSummaryResponse>> GetAllPlansAsync(TreatmentPlanQueryParameters query,
            string userId, bool canViewAll, CancellationToken cancellationToken = default);

        /// <summary>Cập nhật nội dung của kế hoạch điều trị ở trạng thái Nháp (Draft).</summary>
        Task<TreatmentPlanProgressResponse> UpdateAsync(long treatmentPlanId, UpdateTreatmentPlanRequest request,
            string userId, CancellationToken cancellationToken = default);

        /// <summary>Tạo phiên bản mới của kế hoạch điều trị khi có điều chỉnh lộ trình.</summary>
        Task<TreatmentPlanProgressResponse> CreateNewVersionAsync(long treatmentPlanId, UpdateTreatmentPlanRequest request,
            string userId, CancellationToken cancellationToken = default);

        /// <summary>Xóa kế hoạch điều trị nháp chưa được đề xuất.</summary>
        Task DeleteAsync(long treatmentPlanId, string userId, CancellationToken cancellationToken = default);

        /// <summary>Bác sĩ đề xuất (Propose) kế hoạch điều trị cho bệnh nhân xem xét.</summary>
        Task<TreatmentPlanProgressResponse> ProposeAsync(long treatmentPlanId, string userId, CancellationToken cancellationToken = default);

        /// <summary>Ghi nhận sự đồng ý/phê duyệt (Approve) kế hoạch điều trị của bệnh nhân.</summary>
        Task<TreatmentPlanProgressResponse> ApproveAsync(long treatmentPlanId, string userId, bool canViewAll,
            CancellationToken cancellationToken = default);

        /// <summary>Hủy kế hoạch điều trị với lý do cụ thể.</summary>
        Task<TreatmentPlanProgressResponse> CancelAsync(long treatmentPlanId, CancelTreatmentPlanRequest request, string userId, bool canViewAll,
            CancellationToken cancellationToken = default);

        /// <summary>Lấy thông tin tiến độ tổng quan của kế hoạch điều trị.</summary>
        Task<TreatmentPlanProgressResponse> GetProgressAsync(long treatmentPlanId,
            string userId, CancellationToken cancellationToken = default);

        /// <summary>Bắt đầu thực hiện một giai đoạn trong kế hoạch điều trị.</summary>
        Task<TreatmentPlanProgressResponse> StartStageAsync(long treatmentPlanId, long stageId,
            string userId, CancellationToken cancellationToken = default);

        /// <summary>Cập nhật thông tin chi tiết của một giai đoạn điều trị.</summary>
        Task<TreatmentPlanProgressResponse> UpdateStageAsync(long treatmentPlanId, long stageId, UpdateTreatmentStageRequest request,
            string userId, CancellationToken cancellationToken = default);

        /// <summary>Hoàn thành một giai đoạn điều trị.</summary>
        Task<TreatmentPlanProgressResponse> CompleteStageAsync(long treatmentPlanId, long stageId, CompleteTreatmentStageRequest? request, string userId, CancellationToken cancellationToken = default);

        /// <summary>Thực hiện một phiên làm việc (session) trong giai đoạn điều trị.</summary>
        Task<TreatmentPlanProgressResponse> PerformSessionAsync(long stageId, PerformSessionRequest request,
            string userId, CancellationToken cancellationToken = default);
    }
}


namespace OZE.Common.Models
{
    /// <summary>Bệnh nhân xin đổi hoặc huỷ một lần đến do phòng khám sắp xếp (lịch hẹn hoặc buổi điều trị chưa có lịch).</summary>
    public class CreateAppointmentChangeRequest
    {
        /// <summary>Lịch hẹn cần đổi / huỷ (một trong hai: AppointmentId hoặc TreatmentPlanStageId).</summary>
        public long? AppointmentId { get; set; }

        /// <summary>Buổi điều trị chưa có lịch hẹn.</summary>
        public long? TreatmentPlanStageId { get; set; }

        /// <summary>Reschedule hoặc Cancel.</summary>
        public string? Type { get; set; }

        /// <summary>Lý do (bắt buộc).</summary>
        public string? Reason { get; set; }

        /// <summary>Tối đa 3 khung giờ mong muốn, ví dụ "07/12 · Sáng" (chỉ khi xin đổi).</summary>
        public List<string>? PreferredTimes { get; set; }

        /// <summary>Ghi chú cho lễ tân.</summary>
        public string? Note { get; set; }
    }

    /// <summary>Lễ tân ghi lại đã xử lý yêu cầu thế nào.</summary>
    public class ResolveAppointmentChangeRequest
    {
        /// <summary>Rescheduled, Cancelled hoặc Kept.</summary>
        public string? Outcome { get; set; }

        /// <summary>Ghi chú của lễ tân (ví dụ: đã đổi sang 07/12 09:00).</summary>
        public string? Note { get; set; }
    }

    /// <summary>Một yêu cầu đổi / huỷ lịch.</summary>
    public class AppointmentChangeRequestResponse
    {
        public long Id { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public List<string> PreferredTimes { get; set; } = new();
        public string? Note { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? HandledAt { get; set; }
        public string? HandlerNote { get; set; }

        public int PatientId { get; set; }
        public string PatientCode { get; set; } = string.Empty;
        public string PatientName { get; set; } = string.Empty;
        public string PatientPhoneNumber { get; set; } = string.Empty;

        // The visit asked about, as it was when the request was read
        public long? AppointmentId { get; set; }
        public string? AppointmentCode { get; set; }
        public long? TreatmentPlanStageId { get; set; }
        public DateOnly? VisitDate { get; set; }
        public TimeOnly? TimeSlotStart { get; set; }
        public TimeOnly? TimeSlotEnd { get; set; }
        public string VisitTitle { get; set; } = string.Empty;
        public string? DoctorName { get; set; }
        public string? PlanName { get; set; }
        public int? StageNumber { get; set; }
        public int? TotalStages { get; set; }
        /// <summary>Lịch tái khám bác sĩ hẹn (lịch có lịch gốc).</summary>
        public bool IsFollowUp { get; set; }
    }
}

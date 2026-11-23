using System.ComponentModel.DataAnnotations;

namespace OZE.Common.Models
{
    /// <summary>Khung giờ ca làm việc áp dụng cho tạo ca hàng loạt.</summary>
    public class BulkWorkShiftSlot
    {
        [Required]
        public TimeOnly? ShiftStart { get; set; }

        [Required]
        public TimeOnly? ShiftEnd { get; set; }
    }

    /// <summary>Ca làm việc bị bỏ qua trong danh sách duyệt trước (preview).</summary>
    public class BulkSkippedItem
    {
        [Required]
        public string StaffUserId { get; set; } = string.Empty;

        [Required]
        public DateOnly? ScheduleDate { get; set; }

        [Required]
        public TimeOnly? ShiftStart { get; set; }
    }

    /// <summary>Yêu cầu tạo ca làm việc hàng loạt cho nhân viên.</summary>
    public class BulkWorkShiftRequest
    {
        [Required]
        [MinLength(1)]
        public List<string> StaffUserIds { get; set; } = new();

        [Required]
        public DateOnly? FromDate { get; set; }

        [Required]
        public DateOnly? ToDate { get; set; }

        [Required]
        [MinLength(1)]
        public List<int> DaysOfWeek { get; set; } = new();

        [Required]
        [MinLength(1)]
        public List<BulkWorkShiftSlot> Slots { get; set; } = new();

        public int? RoomId { get; set; }

        [MaxLength(200)]
        public string? Assignment { get; set; }

        [MaxLength(500)]
        public string? Note { get; set; }

        public List<DateOnly>? ExcludedDates { get; set; }

        // Only used by POST bulk: candidates the manager unchecked in preview
        public List<BulkSkippedItem>? SkippedItems { get; set; }
    }
}


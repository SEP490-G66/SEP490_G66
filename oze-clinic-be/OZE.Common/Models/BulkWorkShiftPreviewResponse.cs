namespace OZE.Common.Models
{
    public class BulkWorkShiftPreviewItem
    {
        public string StaffUserId { get; set; } = string.Empty;
        public string StaffName { get; set; } = string.Empty;
        public DateOnly ScheduleDate { get; set; }
        public TimeOnly ShiftStart { get; set; }
        public TimeOnly ShiftEnd { get; set; }
        public int? RoomId { get; set; }
        public bool Valid { get; set; }
        public string? Reason { get; set; }
    }

    public class BulkWorkShiftPreviewResponse
    {
        public List<BulkWorkShiftPreviewItem> Items { get; set; } = new();
        public int ValidCount { get; set; }
        public int InvalidCount { get; set; }
    }
}

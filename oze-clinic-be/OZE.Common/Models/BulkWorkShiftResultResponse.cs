namespace OZE.Common.Models
{
    public class BulkWorkShiftSkippedItem
    {
        public string StaffUserId { get; set; } = string.Empty;
        public string? StaffName { get; set; }
        public DateOnly ScheduleDate { get; set; }
        public TimeOnly ShiftStart { get; set; }
        public TimeOnly ShiftEnd { get; set; }
        public int? RoomId { get; set; }
        public string Reason { get; set; } = string.Empty;
    }

    public class BulkWorkShiftResultResponse
    {
        public int CreatedCount { get; set; }
        public List<long> CreatedIds { get; set; } = new();
        public List<BulkWorkShiftSkippedItem> Skipped { get; set; } = new();
    }
}

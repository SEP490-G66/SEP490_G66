using System;

namespace OZE.Common.Models
{
    public class QueueEntryResponse
    {
        public long Id { get; set; }
        public long AppointmentId { get; set; }
        public string QueueType { get; set; } = string.Empty;
        public int? RoomId { get; set; }
        public string? RoomName { get; set; }
        public int? AssignedStaffId { get; set; }
        public string? StaffName { get; set; }
        public string PatientName { get; set; } = string.Empty;
        public string PatientCode { get; set; } = string.Empty;
        public int QueueNumber { get; set; }
        public int Priority { get; set; }
        // Staff only; null on the public board, where the patient only sees that someone is prioritized
        public string? PriorityReason { get; set; }
        public int SkipCount { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTimeOffset? CalledAt { get; set; }
        public DateTimeOffset? StartedAt { get; set; }
        public DateTimeOffset? CompletedAt { get; set; }
        public string? Notes { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}

namespace OZE.Domain.Entities
{
    public class Appointment
    {
        public long Id { get; set; }
        public int PatientId { get; set; }
        public int? DoctorId { get; set; }
        public string AppointmentType { get; set; } = string.Empty;
        public DateOnly AppointmentDate { get; set; }
        public TimeOnly? TimeSlotStart { get; set; }
        public TimeOnly? TimeSlotEnd { get; set; }
        public string Status { get; set; } = "PENDING";
        // Waiting-list priority, set by the receptionist: 0 normal, 1 high, 2 urgent
        public int Priority { get; set; }
        // Why the patient is above normal priority; staff only, never shown to the patient. Null at normal priority
        public string? PriorityReason { get; set; }
        public DateTimeOffset? CheckInAt { get; set; }
        public string? Notes { get; set; }
        public string? CancellationReason { get; set; }
        public DateTimeOffset? CancelledAt { get; set; }
        public string? CancelledByUserId { get; set; }
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();
        public DateTimeOffset CreatedAt { get; set; }
        public string? CreatedByUserId { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }

        // Links to the previous appointment if this is a follow-up visit
        public long? ParentAppointmentId { get; set; }

        // The treatment plan session this visit is booked for; null for a visit outside a plan
        public long? TreatmentPlanStageId { get; set; }

        public virtual Patient Patient { get; set; } = null!;
        public virtual StaffProfile? Doctor { get; set; }
        public virtual Examination? Examination { get; set; }
        public virtual Appointment? ParentAppointment { get; set; }
        public virtual TreatmentPlanStage? TreatmentPlanStage { get; set; }
        public virtual ICollection<QueueEntry> QueueEntries { get; set; } = new List<QueueEntry>();
        public virtual ICollection<AppointmentServiceItem> ServiceItems { get; set; } = new List<AppointmentServiceItem>();
    }
}

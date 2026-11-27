namespace OZE.Domain.Entities
{
    // A patient asks the front desk to move or cancel a visit the clinic arranged: a booked appointment (AppointmentId)
    // or a treatment session that has no appointment yet (TreatmentPlanStageId). Nothing changes until the front desk acts.
    public class AppointmentChangeRequest
    {
        public long Id { get; set; }
        public int PatientId { get; set; }
        public long? AppointmentId { get; set; }
        public long? TreatmentPlanStageId { get; set; }
        public string RequestType { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        // Up to three times the patient would like, one per line ("07/12 · Sáng")
        public string? PreferredTimes { get; set; }
        public string? Note { get; set; }
        public string Status { get; set; } = "Pending";
        public string? HandledByUserId { get; set; }
        public DateTimeOffset? HandledAt { get; set; }
        public string? HandlerNote { get; set; }
        public DateTimeOffset CreatedAt { get; set; }

        public virtual Patient Patient { get; set; } = null!;
        public virtual Appointment? Appointment { get; set; }
        public virtual TreatmentPlanStage? TreatmentPlanStage { get; set; }
    }
}

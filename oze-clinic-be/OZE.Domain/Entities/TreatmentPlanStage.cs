namespace OZE.Domain.Entities
{
    public class TreatmentPlanStage
    {
        public long Id { get; set; }
        public long TreatmentPlanId { get; set; }
        public int StageNumber { get; set; }
        public string? StageName { get; set; }
        public string? Description { get; set; }
        public int? ServiceId { get; set; }
        public decimal EstimatedCost { get; set; }
        public decimal? ActualCost { get; set; }
        public string StageStatus { get; set; } = "Scheduled";
        public DateOnly? ScheduledDate { get; set; }
        public DateOnly? ActualDate { get; set; }
        public int? PerformedByDoctorId { get; set; }
        // The doctor who is to do this session (chosen when the plan is made: the planning doctor by default, or a doctor
        // who can do the service). The front desk books the session with this doctor. PerformedByDoctorId is who really did it.
        public int? AssignedDoctorId { get; set; }
        // The visit in which the doctor did this session, so the cashier does not collect it twice with that visit
        public long? AppointmentId { get; set; }
        public string? Notes { get; set; }
        public DateTimeOffset? CompletedAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }

        public virtual TreatmentPlan TreatmentPlan { get; set; } = null!;
        public virtual Service? Service { get; set; }
        public virtual StaffProfile? PerformedByDoctor { get; set; }
        public virtual StaffProfile? AssignedDoctor { get; set; }
        public virtual Appointment? Appointment { get; set; }
    }
}

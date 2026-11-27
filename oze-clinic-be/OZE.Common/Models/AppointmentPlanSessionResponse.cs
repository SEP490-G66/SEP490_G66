namespace OZE.Common.Models
{
    // The treatment plan session an appointment is booked for ("Buổi 4/6 · Niềng răng")
    public class AppointmentPlanSessionResponse
    {
        public long TreatmentPlanId { get; set; }
        public string? PlanName { get; set; }
        public long StageId { get; set; }
        public int StageNumber { get; set; }
        public string? StageName { get; set; }
        // Sessions of the plan, cancelled ones left out
        public int TotalStages { get; set; }
        public string StageStatus { get; set; } = string.Empty;
    }
}

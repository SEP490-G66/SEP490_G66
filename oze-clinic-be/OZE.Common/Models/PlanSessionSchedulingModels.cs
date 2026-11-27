namespace OZE.Common.Models
{
    // A treatment plan session the doctor has set and the front desk still has to give a time
    // ("Buổi chờ xếp giờ"): the next open session of each plan being carried out, with no active appointment yet.
    public class PendingPlanSessionResponse
    {
        public long StageId { get; set; }
        public long TreatmentPlanId { get; set; }
        public string? PlanName { get; set; }
        public int PatientId { get; set; }
        public string PatientName { get; set; } = string.Empty;
        public string PatientCode { get; set; } = string.Empty;
        public string? PatientPhoneNumber { get; set; }
        // "Buổi 2/3": the position among the plan's sessions that are not cancelled
        public int StageNumber { get; set; }
        public int TotalStages { get; set; }
        public string? StageName { get; set; }
        public int? ServiceId { get; set; }
        public string? ServiceName { get; set; }
        public string RequiredRoomType { get; set; } = string.Empty;
        // The doctor who is to do the session: the front desk books with this doctor only
        public int DoctorId { get; set; }
        public string? DoctorName { get; set; }
        public DateOnly? ScheduledDate { get; set; }
    }

    // A doctor the planning doctor can give a session to. Suggested: the doctor works shifts in the kind of room the
    // service needs (a sign they do that work); the others can still be picked.
    public class PlanDoctorOptionResponse
    {
        public int DoctorId { get; set; }
        public string DoctorName { get; set; } = string.Empty;
        public string? Specialization { get; set; }
        public bool Suggested { get; set; }
    }
}

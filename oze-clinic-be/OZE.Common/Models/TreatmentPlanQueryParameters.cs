using OZE.Common.Models.Base;

namespace OZE.Common.Models
{
    // Filters for the paged treatment plan list
    public class TreatmentPlanQueryParameters : PagedRequestBase
    {
        public int? PatientId { get; set; }
        public int? DoctorId { get; set; }
        public string? Status { get; set; }
        // Matches the plan name or the patient's name or code
        public string? Keyword { get; set; }
        // When no status is given, closed plans (completed or cancelled) are left out unless this is true
        public bool IncludeClosed { get; set; }
    }
}

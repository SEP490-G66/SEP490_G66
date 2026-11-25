using System.ComponentModel.DataAnnotations;

namespace OZE.Common.Models
{
    public class ReassignDoctorRequest
    {
        // The doctor who takes over the waiting patient
        [Required]
        public int? DoctorId { get; set; }

        // Why the patient is moved; logged and told to the patient
        [Required]
        [MaxLength(500)]
        public string? Reason { get; set; }
    }
}

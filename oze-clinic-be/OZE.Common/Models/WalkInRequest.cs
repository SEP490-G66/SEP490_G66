using System.ComponentModel.DataAnnotations;

namespace OZE.Common.Models
{
    // A patient who comes to the clinic without a booking: the receptionist registers and checks the patient in at once
    public class WalkInRequest
    {
        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        // The format is checked in the service
        [Required]
        public string PhoneNumber { get; set; } = string.Empty;

        // Optional; the format is checked in the service only when a value is given
        public string? Email { get; set; }

        public DateOnly? DateOfBirth { get; set; }

        [MaxLength(10)]
        public string? Gender { get; set; }

        // The doctor the patient asks for
        [Required]
        public int? DoctorId { get; set; }

        // Services the patient picked; the general exam is added by the system, so this may be empty
        public List<int> ServiceId { get; set; } = new();

        public List<int> VariantId { get; set; } = new();

        [MaxLength(500)]
        public string? Note { get; set; }

        // Optional; null means normal. Above normal needs a reason, like at check-in
        public int? Priority { get; set; }

        [MaxLength(500)]
        public string? Reason { get; set; }

        // Relative to call when needed; saved only when a new record is created
        [MaxLength(100)]
        public string? EmergencyContactName { get; set; }

        public string? EmergencyContactPhone { get; set; }

        // Allergies and conditions ticked at the desk; saved only when a new record is created
        public List<WalkInMedicalHistoryItem> MedicalHistory { get; set; } = new();
    }

    public class WalkInMedicalHistoryItem
    {
        // Allergy or Condition
        [Required]
        [MaxLength(20)]
        public string RecordType { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;
    }
}

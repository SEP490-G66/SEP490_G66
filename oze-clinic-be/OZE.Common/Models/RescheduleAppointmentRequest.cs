using System;
using System.ComponentModel.DataAnnotations;

namespace OZE.Common.Models
{
    public class RescheduleAppointmentRequest
    {
        [Required]
        public DateOnly? Date { get; set; }

        [Required]
        public TimeOnly? SlotStart { get; set; }

        // Optional; null means "keep the doctor if free, otherwise any suitable doctor"
        public int? DoctorId { get; set; }

        // New services and variants, like a booking; both null keeps the services of the appointment.
        // The general exam is added by the system, so sending neither list as empty means "general exam only".
        public List<int>? ServiceId { get; set; }

        public List<int>? VariantId { get; set; }

        // Why the clinic moved the appointment; sent to the patient with the new time
        [MaxLength(500)]
        public string? Reason { get; set; }
    }
}

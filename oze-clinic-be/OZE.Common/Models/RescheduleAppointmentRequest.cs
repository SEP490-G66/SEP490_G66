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

        // Why the clinic moved the appointment; sent to the patient with the new time
        [MaxLength(500)]
        public string? Reason { get; set; }
    }
}

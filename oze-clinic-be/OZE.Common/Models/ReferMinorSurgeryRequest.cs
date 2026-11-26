using System.ComponentModel.DataAnnotations;

namespace OZE.Common.Models
{
    // "Chỉ định chuyển phòng · tiểu phẫu": the doctor hands the visit to a doctor on shift in the minor surgery room
    public class ReferMinorSurgeryRequest
    {
        // The doctor of the minor surgery room who takes the patient (and the examination)
        [Required]
        public int? SurgeryDoctorId { get; set; }

        // What to do there, shown in that doctor's queue
        [MaxLength(300)]
        public string? Note { get; set; }
    }
}

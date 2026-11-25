using System.ComponentModel.DataAnnotations;

namespace OZE.Common.Models
{
    /// <summary>Khoảng ngày cần đếm số ca trống (lịch tuần ở trang Đặt lịch khám).</summary>
    public class AvailableDaysRequest
    {
        // Services the patient picked; the general exam is added by the system, so this may be empty
        public List<int> ServiceId { get; set; } = new();

        // Variants the patient picked; each one belongs to a service, which the system finds from the variant
        public List<int> VariantId { get; set; } = new();

        [Required]
        public DateOnly? From { get; set; }

        [Required]
        public DateOnly? To { get; set; }

        // Optional; null means "any suitable doctor"
        public int? DoctorId { get; set; }
    }

    /// <summary>Số ca còn trống của một ngày.</summary>
    public class AvailableDayResponse
    {
        public DateOnly Date { get; set; }
        // Distinct start times still free (several doctors free at the same time count once)
        public int FreeSlotCount { get; set; }
        // A suitable doctor works that day; false = day off, true with 0 free slots = full
        public bool IsWorkingDay { get; set; }
        public TimeOnly? FirstSlotStart { get; set; }
    }
}

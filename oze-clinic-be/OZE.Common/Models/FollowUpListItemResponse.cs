using OZE.Common.Helpers;
using System;
using OZE.Common.Constants;

namespace OZE.Common.Models
{
    public class FollowUpListItemResponse
    {
        public long ExaminationId { get; set; }
        public long OriginalAppointmentId { get; set; }
        public string OriginalAppointmentCode { get; set; } = string.Empty;
        public DateOnly OriginalAppointmentDate { get; set; }
        public int PatientId { get; set; }
        public string PatientCode { get; set; } = string.Empty;
        public string PatientName { get; set; } = string.Empty;
        public string PatientPhoneNumber { get; set; } = string.Empty;
        public int DoctorId { get; set; }
        public string DoctorName { get; set; } = string.Empty;
        public DateOnly? FollowUpDate { get; set; }
        public string? FollowUpNotes { get; set; }
        public long? FollowUpAppointmentId { get; set; }
        public string? FollowUpAppointmentCode { get; set; }
        public DateOnly? FollowUpAppointmentDate { get; set; }
        public TimeOnly? FollowUpTimeSlotStart { get; set; }
        public string? FollowUpAppointmentStatus { get; set; }
        // The doctor of the follow-up appointment, who may differ from the doctor of the original visit
        public int? FollowUpDoctorId { get; set; }
        public string? FollowUpDoctorName { get; set; }
        public DateTimeOffset? LastRemindedAt { get; set; }
        public int ReminderCount { get; set; }
        // Set by the service's periodic recall rather than by the doctor
        public bool IsRecall { get; set; }
        // The patient declined; no more reminders
        public bool IsClosed { get; set; }
        public string? LastContactOutcome { get; set; }
        public DateTimeOffset? LastContactAt { get; set; }
        public string? LastContactNote { get; set; }
        public DateOnly? CallBackDate { get; set; }
        public int ContactCount { get; set; }

        public bool HasActiveAppointment => FollowUpAppointmentId.HasValue 
            && FollowUpAppointmentStatus != "CANCELLED" 
            && FollowUpAppointmentStatus != "NO_SHOW";

        public bool IsOverdue
        {
            get
            {
                if (HasActiveAppointment || !FollowUpDate.HasValue) return false;
                var today = ClinicClock.TodayDate;
                return FollowUpDate.Value < today;
            }
        }

        public string ComputedStatus
        {
            get
            {
                if (HasActiveAppointment)
                {
                    return FollowUpAppointmentStatus switch
                    {
                        "COMPLETED" => "Completed",
                        _ => "Scheduled"
                    };
                }
                if (FollowUpAppointmentStatus is "CANCELLED" or "NO_SHOW")
                {
                    return "Cancelled";
                }
                if (FollowUpDate.HasValue)
                {
                    var today = ClinicClock.TodayDate;
                    if (FollowUpDate.Value < today) return "Overdue";
                    if (FollowUpDate.Value == today) return "DueToday";
                    return "PendingBooking";
                }
                return "NotSet";
            }
        }
    }
}

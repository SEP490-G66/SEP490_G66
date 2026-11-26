using OZE.Domain.Entities;

namespace OZE.Application.Helpers
{
    // Which shift of the day an appointment belongs to. Booked patients are placed by the time slot,
    // walk-ins (no booked time) by the clinic time they checked in (not the server's time zone).
    public static class ShiftTimeHelper
    {
        public static TimeOnly? GetTimeInShift(Appointment appointment)
        {
            return appointment.TimeSlotStart
                ?? (appointment.CheckInAt.HasValue ? TimeOnly.FromDateTime(ClinicClock.ToClinicTime(appointment.CheckInAt.Value)) : null);
        }

        public static bool IsInShift(Appointment appointment, StaffSchedule shift)
        {
            var time = GetTimeInShift(appointment);
            return time.HasValue && time.Value >= shift.ShiftStart && time.Value < shift.ShiftEnd;
        }
    }
}

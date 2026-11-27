namespace OZE.Application.Helpers
{
    // Booking slots of the clinic day ("Clinic.SlotDurationMinutes"): how long a booking holds the doctor,
    // and whether a time falls on a slot boundary.
    public static class SlotTimeHelper
    {
        // R3: a booking holds whole slots. The services' own minutes are rounded up to the next slot
        // (20' → 30', 45' → 60', 75' → 90' with 30-minute slots), so every booking ends on a slot boundary.
        public static int HeldMinutes(int serviceMinutes, int slotMinutes)
        {
            if (slotMinutes <= 0 || serviceMinutes <= 0)
            {
                return Math.Max(serviceMinutes, 0);
            }

            return (serviceMinutes + slotMinutes - 1) / slotMinutes * slotMinutes;
        }

        // R4: a time on a slot boundary of the day (08:00, 08:30 with 30-minute slots)
        public static bool IsOnSlot(TimeOnly time, int slotMinutes)
        {
            if (slotMinutes <= 0)
            {
                return true;
            }

            return time.Second == 0 && time.Millisecond == 0 && (time.Hour * 60 + time.Minute) % slotMinutes == 0;
        }
    }
}

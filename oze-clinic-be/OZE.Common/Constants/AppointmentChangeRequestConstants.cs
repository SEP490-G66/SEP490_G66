namespace OZE.Common.Constants
{
    // "Xin đổi / huỷ lịch": a patient cannot move or cancel a visit the clinic arranged (a treatment session, a follow-up
    // booked by the front desk); they ask, and the front desk calls back and handles it.
    public static class AppointmentChangeRequestConstants
    {
        public static class Type
        {
            public const string Reschedule = "Reschedule";
            public const string Cancel = "Cancel";
        }

        public static readonly string[] Types = { Type.Reschedule, Type.Cancel };

        // Pending: waiting for the front desk. The other ones are final.
        public static class Status
        {
            public const string Pending = "Pending";
            public const string Rescheduled = "Rescheduled";
            public const string Cancelled = "Cancelled";
            public const string Kept = "Kept";
            public const string Withdrawn = "Withdrawn";
        }

        // What the front desk did with a request
        public static readonly string[] Outcomes = { Status.Rescheduled, Status.Cancelled, Status.Kept };

        public const int ReasonMaxLength = 200;
        public const int NoteMaxLength = 500;
        public const int PreferredTimeMaxLength = 50;
        public const int MaxPreferredTimes = 3;
    }
}

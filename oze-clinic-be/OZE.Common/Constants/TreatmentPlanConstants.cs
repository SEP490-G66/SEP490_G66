namespace OZE.Common.Constants
{
    public static class TreatmentPlanConstants
    {
        // Must match CK_TreatmentPlans_Status in TreatmentPlanConfiguration
        public const string Draft = "Draft";
        public const string Proposed = "Proposed";
        public const string Approved = "Approved";
        public const string InProgress = "InProgress";
        public const string Completed = "Completed";
        public const string Cancelled = "Cancelled";
        public const string Superseded = "Superseded";

        public static readonly string[] PlanStatuses =
        {
            Draft, Proposed, Approved, InProgress, Completed, Cancelled, Superseded
        };

        // A plan in one of these is still being worked on; an examination holds at most one
        // A doctor is suggested for a session when they have shifts in the service's kind of room in this window
        public const int DoctorSuggestionPastDays = 90;
        public const int DoctorSuggestionFutureDays = 60;

        public static readonly string[] OpenStatuses = { Draft, Proposed, Approved, InProgress };

        // Reason written on the appointments of the sessions dropped when the plan is cancelled (shown to staff and patient)
        public const string SessionAppointmentCancelReason = "Kế hoạch điều trị đã huỷ";

        // Must match CK_TreatmentPlanStages_Status in TreatmentPlanStageConfiguration
        // Stored without space (InProgress) to match existing DB check constraints.
        public static class StageStatus
        {
            public const string Scheduled = "Scheduled";
            public const string InProgress = "InProgress";
            public const string Completed = "Completed";
            public const string Cancelled = "Cancelled";

            public static readonly string[] All = { Scheduled, InProgress, Completed, Cancelled };
        }
    }
}

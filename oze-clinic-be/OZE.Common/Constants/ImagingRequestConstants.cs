namespace OZE.Common.Constants
{
    public static class ImagingRequestConstants
    {
        // Must match CK_ImagingRequests_Status in ImagingRequestConfiguration.
        public const string Pending = "Pending";
        public const string InProgress = "InProgress";
        public const string Completed = "Completed";
        public const string Cancelled = "Cancelled";

        // BR-081: the technician queue shows these statuses in request-time order.
        public static readonly string[] QueueStatuses = { Pending, InProgress };
        // Requests shown on the technician history page
        public static readonly string[] HistoryStatuses = { Completed, Cancelled };
        public const int HistoryDefaultPageSize = 10;
        public const int HistoryMaxPageSize = 100;

        // BR-190
        public const string PeriapicalXRay = "Periapical X-ray";
        public const string Panoramic = "Panoramic";
        public const string Cephalometric = "Cephalometric";
        public const string Cbct = "CBCT";
        public const string IntraoralPhoto = "Intraoral Photo";

        public static readonly string[] ImagingTypes =
        {
            PeriapicalXRay, Panoramic, Cephalometric, Cbct, IntraoralPhoto
        };

        public const int ImagingTypeMaxLength = 50;
        public const int TargetAreaMaxLength = 200;
        public const int ClinicalIndicationMaxLength = 500;
        public const int CancelReasonMaxLength = 500;

        public const string InProgressExaminationStatus = "InProgress";

        // The simulator signs the body of each webhook with this shared secret (HMAC SHA256)
        public const string WebhookSecretConfigKey = "XRaySimulator:WebhookSecret";
        public const string WebhookSignaturePrefix = "sha256=";
        // Only used on a development machine that has no secret configured; any other environment must configure its own
        // It is the simulator's own development secret, so the two work together on a fresh machine
        public const string DevelopmentWebhookSecret = "oze-sim-webhook-secret-2026";

    }
}

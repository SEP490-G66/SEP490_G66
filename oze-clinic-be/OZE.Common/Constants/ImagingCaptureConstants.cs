namespace OZE.Common.Constants
{
    // Capturing imaging requests on the X-ray simulator (oze-xray-simulator)
    public static class ImagingCaptureConstants
    {
        // Capture states, the same words the simulator uses
        public const string Accepted = "ACCEPTED";
        public const string Capturing = "CAPTURING";
        public const string Processing = "PROCESSING";
        public const string Completed = "COMPLETED";
        public const string Failed = "FAILED";
        public const string Cancelled = "CANCELLED";

        // A capture in one of these states is still running on the device
        public static readonly string[] RunningStatuses = { Accepted, Capturing, Processing };
        public static readonly string[] AllStatuses = { Accepted, Capturing, Processing, Completed, Failed, Cancelled };

        // Webhook event types sent by the simulator
        public const string EventProgress = "CAPTURE_PROGRESS";
        public const string EventCompleted = "CAPTURE_COMPLETED";
        public const string EventFailed = "CAPTURE_FAILED";
        public const string EventCancelled = "CAPTURE_CANCELLED";

        // The simulator gets "IR-{imaging request id}" so a webhook can be matched to its request
        public const string OrderReferencePrefix = "IR-";

        // Simulator modalities for the imaging types the X-ray devices can take; other types are uploaded by hand
        public const string ModalityPanoramic = "PANORAMIC";
        public const string ModalityPeriapical = "PERIAPICAL";

        public static readonly IReadOnlyDictionary<string, string> ModalityByImagingType =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                [ImagingRequestConstants.Panoramic] = ModalityPanoramic,
                [ImagingRequestConstants.PeriapicalXRay] = ModalityPeriapical
            };

        public const int MinImageCount = 1;
        public const int MaxImageCount = 10;

        // Configuration
        public const string BaseUrlConfigKey = "XRaySimulator:BaseUrl";
        public const string ApiKeyConfigKey = "XRaySimulator:ApiKey";
        public const string TimeoutSecondsConfigKey = "XRaySimulator:TimeoutSeconds";
        public const string StorageRootConfigKey = "ImagingStorage:RootPath";

        // Only used on a development machine with nothing configured: the simulator's own development address and key
        public const string DevelopmentBaseUrl = "http://localhost:5026";
        public const string DevelopmentApiKey = "oze-xray-sim-secret-key-2026";
        public const int DefaultTimeoutSeconds = 15;

        // Pictures from the device are kept under the storage root as {yyyy}/{MM}/IR-{requestId}/{simulationId}_{n}.png
        public const string DevelopmentStorageFolder = "App_Data/imaging";
        // Azure App Service keeps %HOME%/data across restarts and deployments
        public const string AzureStorageFolder = "data/imaging";

        // Pictures of the sample data live in the frontend, not on the server
        public const string MockFilePrefix = "mock/";

        public const int SimulationIdMaxLength = 100;
        public const int DeviceIdMaxLength = 50;
        public const int ModalityMaxLength = 20;
        public const int StatusMaxLength = 20;
        public const int BodyRegionMaxLength = 200;
        public const int FailureCodeMaxLength = 100;
        public const int FailureMessageMaxLength = 1000;
        // ImagingResults.FileName column
        public const int FileNameMaxLength = 500;
    }
}

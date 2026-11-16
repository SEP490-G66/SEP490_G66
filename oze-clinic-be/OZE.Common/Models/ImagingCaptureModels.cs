using System.Text.Json.Serialization;

namespace OZE.Common.Models
{
    // Body of POST api/imaging-requests/{id}/captures
    public class StartImagingCaptureRequest
    {
        public string DeviceId { get; set; } = string.Empty;
        public int ImageCount { get; set; } = 1;
        public double? Kv { get; set; }
        public double? Ma { get; set; }
        public double? ExposureSeconds { get; set; }
    }

    // One capture of an imaging request, as the technician screen shows it
    public class ImagingCaptureResponse
    {
        public string SimulationId { get; set; } = string.Empty;
        public long ImagingRequestId { get; set; }
        public string DeviceId { get; set; } = string.Empty;
        public string Modality { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int Progress { get; set; }
        public int ImageCount { get; set; }
        public string? FailureMessage { get; set; }
        public DateTimeOffset StartedAt { get; set; }
        public DateTimeOffset? CompletedAt { get; set; }
        // The stored pictures, once the capture is completed
        public List<ImagingCaptureImageResponse> Images { get; set; } = new();
    }

    public class ImagingCaptureImageResponse
    {
        public long ResultId { get; set; }
        public string FileName { get; set; } = string.Empty;
        // Relative API address of the picture: /api/imaging-results/{resultId}/file
        public string FileUrl { get; set; } = string.Empty;
    }

    // An X-ray device of the simulator
    public class ImagingDeviceResponse
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string SerialNumber { get; set; } = string.Empty;
        public List<string> SupportedModalities { get; set; } = new();
        public string State { get; set; } = string.Empty;
    }

    // A stored picture read back for download
    public class ImagingFileResult
    {
        public byte[] Data { get; set; } = Array.Empty<byte>();
        public string ContentType { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
    }

    // ---- Simulator API contracts (oze-xray-simulator /api/v1) ----

    public class SimulatorExposure
    {
        [JsonPropertyName("kv")] public double? KV { get; set; }
        [JsonPropertyName("ma")] public double? MA { get; set; }
        [JsonPropertyName("seconds")] public double? Seconds { get; set; }
        [JsonPropertyName("mode")] public string? Mode { get; set; }
    }

    public class SimulatorCaptureRequest
    {
        [JsonPropertyName("captureRequestId")] public string CaptureRequestId { get; set; } = string.Empty;
        [JsonPropertyName("orderReference")] public string OrderReference { get; set; } = string.Empty;
        [JsonPropertyName("deviceId")] public string DeviceId { get; set; } = string.Empty;
        [JsonPropertyName("modality")] public string Modality { get; set; } = string.Empty;
        [JsonPropertyName("bodyRegion")] public string? BodyRegion { get; set; }
        [JsonPropertyName("imageCount")] public int? ImageCount { get; set; }
        [JsonPropertyName("exposure")] public SimulatorExposure? Exposure { get; set; }
    }

    public class SimulatorImage
    {
        [JsonPropertyName("imageId")] public string ImageId { get; set; } = string.Empty;
        [JsonPropertyName("fileName")] public string FileName { get; set; } = string.Empty;
        [JsonPropertyName("contentType")] public string ContentType { get; set; } = string.Empty;
        [JsonPropertyName("sizeBytes")] public long SizeBytes { get; set; }
        [JsonPropertyName("sequenceNumber")] public int SequenceNumber { get; set; }
        [JsonPropertyName("bodyRegion")] public string? BodyRegion { get; set; }
    }

    public class SimulatorCapture
    {
        [JsonPropertyName("simulationId")] public string SimulationId { get; set; } = string.Empty;
        [JsonPropertyName("orderReference")] public string OrderReference { get; set; } = string.Empty;
        [JsonPropertyName("deviceId")] public string DeviceId { get; set; } = string.Empty;
        [JsonPropertyName("modality")] public string Modality { get; set; } = string.Empty;
        [JsonPropertyName("bodyRegion")] public string? BodyRegion { get; set; }
        [JsonPropertyName("status")] public string Status { get; set; } = string.Empty;
        [JsonPropertyName("progress")] public int Progress { get; set; }
        [JsonPropertyName("failureCode")] public string? FailureCode { get; set; }
        [JsonPropertyName("failureMessage")] public string? FailureMessage { get; set; }
        [JsonPropertyName("images")] public List<SimulatorImage> Images { get; set; } = new();
        [JsonPropertyName("updatedAt")] public DateTimeOffset UpdatedAt { get; set; }
    }

    public class SimulatorDevice
    {
        [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
        [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
        [JsonPropertyName("serialNumber")] public string SerialNumber { get; set; } = string.Empty;
        [JsonPropertyName("supportedModalities")] public List<string> SupportedModalities { get; set; } = new();
        [JsonPropertyName("state")] public string State { get; set; } = string.Empty;
    }

    // The answer of one call to the simulator: the data, or why it failed
    public class SimulatorResult<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
        // True when the simulator could not be reached at all (network, timeout, 5xx)
        public bool Unreachable { get; set; }
        public int StatusCode { get; set; }
        public string? Error { get; set; }

        public static SimulatorResult<T> Ok(T data) => new() { Success = true, Data = data, StatusCode = 200 };
        public static SimulatorResult<T> Fail(int statusCode, string? error, bool unreachable = false) =>
            new() { Success = false, StatusCode = statusCode, Error = error, Unreachable = unreachable };
    }
}

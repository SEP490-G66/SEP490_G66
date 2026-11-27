using OZE.Common.Constants;

namespace OZE.Application.Helpers
{
    public static class FileMimeTypeHelper
    {
        public const string Default = "application/octet-stream";

        // The MIME type of a lower-case extension such as ".pdf"; fallback when it is not a known one
        public static string Of(string extension, string fallback = Default) => extension switch
        {
            ".pdf" => "application/pdf",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".dcm" => ImagingRequestConstants.DicomMimeType,
            _ => fallback
        };
    }
}

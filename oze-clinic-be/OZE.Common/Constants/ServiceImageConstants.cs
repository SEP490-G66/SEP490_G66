namespace OZE.Common.Constants
{
    // Rules for the pictures of services and service variants
    public static class ServiceImageConstants
    {
        public const int MaxBytes = 2 * 1024 * 1024;
        // The upload request may carry a little more than the picture (multipart headers)
        public const int MaxRequestBytes = MaxBytes + 64 * 1024;

        public const string Jpeg = "image/jpeg";
        public const string Png = "image/png";
        public const string Webp = "image/webp";
    }
}

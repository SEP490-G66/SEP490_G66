using OZE.Common.Constants;

namespace OZE.Application.Helpers
{
    // Pictures of services: what kind of file the bytes are, and the address the API serves them at
    public static class ServiceImageHelper
    {
        // The type read from the first bytes of the file, not from its name, so a renamed file is caught; null = not allowed
        public static string? DetectContentType(byte[] data)
        {
            if (data.Length >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)
            {
                return ServiceImageConstants.Jpeg;
            }

            if (data.Length >= 8 && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47
                && data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A)
            {
                return ServiceImageConstants.Png;
            }

            // RIFF....WEBP
            if (data.Length >= 12 && data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46
                && data[8] == 0x57 && data[9] == 0x45 && data[10] == 0x42 && data[11] == 0x50)
            {
                return ServiceImageConstants.Webp;
            }

            return null;
        }

        // Null when the picture is missing, otherwise an address that changes with every new picture so browsers can keep it cached
        public static string? ServiceImageUrl(int serviceId, DateTimeOffset? imageUpdatedAt) =>
            imageUpdatedAt.HasValue ? $"/api/services/{serviceId}/image?v={imageUpdatedAt.Value.UtcTicks}" : null;

        public static string? VariantImageUrl(int serviceId, int variantId, DateTimeOffset? imageUpdatedAt) =>
            imageUpdatedAt.HasValue ? $"/api/services/{serviceId}/variants/{variantId}/image?v={imageUpdatedAt.Value.UtcTicks}" : null;
    }
}

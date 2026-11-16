namespace OZE.Domain.Entities
{
    // The picture of a service variant, one per variant
    public class ServiceVariantImage
    {
        public int ServiceVariantId { get; set; }
        public string ContentType { get; set; } = string.Empty;
        public byte[] Data { get; set; } = Array.Empty<byte>();
        public DateTimeOffset UpdatedAt { get; set; }

        public virtual ServiceVariant ServiceVariant { get; set; } = null!;
    }
}

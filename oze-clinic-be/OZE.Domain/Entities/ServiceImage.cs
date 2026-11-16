namespace OZE.Domain.Entities
{
    // The picture of a service, one per service, kept apart from Services so service lists do not load it
    public class ServiceImage
    {
        public int ServiceId { get; set; }
        public string ContentType { get; set; } = string.Empty;
        public byte[] Data { get; set; } = Array.Empty<byte>();
        public DateTimeOffset UpdatedAt { get; set; }

        public virtual Service Service { get; set; } = null!;
    }
}

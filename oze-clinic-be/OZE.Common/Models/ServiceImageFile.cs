namespace OZE.Common.Models
{
    // A stored picture, ready to be sent back as a file
    public class ServiceImageFile
    {
        public byte[] Data { get; set; } = Array.Empty<byte>();
        public string ContentType { get; set; } = string.Empty;
        public DateTimeOffset UpdatedAt { get; set; }
    }
}

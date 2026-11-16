namespace OZE.Domain.Entities
{
    public class Service
    {
        public int Id { get; set; }
        public string ServiceCode { get; set; } = string.Empty;
        public string ServiceName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal ReferencePrice { get; set; }
        public int? EstimatedMinutes { get; set; }
        public string? RequiredRoomType { get; set; }
        // Months until the patient should come back for this service (e.g. scaling every 6 months); null = no recall
        public int? RecallIntervalMonths { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }
        // When the picture was last changed; null = no picture. The bytes live in ServiceImages so lists stay light.
        public DateTimeOffset? ImageUpdatedAt { get; set; }

        public virtual ICollection<ServiceVariant> Variants { get; set; } = new List<ServiceVariant>();
        public virtual ServiceImage? Image { get; set; }
    }
}

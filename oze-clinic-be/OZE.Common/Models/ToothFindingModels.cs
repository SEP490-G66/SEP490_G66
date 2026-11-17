namespace OZE.Common.Models
{
    // One finding on one tooth in this examination (several per tooth are allowed)
    public class ToothFindingResponse
    {
        public long Id { get; set; }
        public string ToothNumber { get; set; } = string.Empty;
        public string Condition { get; set; } = string.Empty;
        public List<string> Surfaces { get; set; } = new();
        public string? Notes { get; set; }
        public bool IsReplaced { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }

    public class SaveToothFindingRequest
    {
        // FDI number: 11-48 for permanent teeth, 51-85 for baby teeth
        public string? ToothNumber { get; set; }
        // The doctor's own words, e.g. "Sâu răng"
        public string? Condition { get; set; }
        // Any of M, O, D, B, L
        public List<string>? Surfaces { get; set; }
        public string? Notes { get; set; }
        public bool IsReplaced { get; set; }
    }
}

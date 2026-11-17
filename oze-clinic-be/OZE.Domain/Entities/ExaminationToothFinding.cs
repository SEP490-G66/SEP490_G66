namespace OZE.Domain.Entities
{
    // What the doctor found on one tooth during one examination ("Khám & Chẩn đoán"). A tooth may have several findings,
    // written in the doctor's own words. Unlike DentalChartEntries it is not the lasting state of the tooth.
    public class ExaminationToothFinding
    {
        public long Id { get; set; }
        public long ExaminationId { get; set; }
        public int PatientId { get; set; }
        // FDI number, e.g. "36" or "75"
        public string ToothNumber { get; set; } = string.Empty;
        public string Condition { get; set; } = string.Empty;
        // Tooth surfaces, comma separated: M, O, D, B, L
        public string? Surfaces { get; set; }
        public string? Notes { get; set; }
        // A baby tooth already replaced by the permanent one
        public bool IsReplaced { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }

        public virtual Examination Examination { get; set; } = null!;
        public virtual Patient Patient { get; set; } = null!;
    }
}

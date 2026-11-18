namespace OZE.Domain.Entities
{
    // A document the doctor asks the patient to bring in for one examination (blood test, film taken elsewhere...)
    public class DocumentRequest
    {
        public long Id { get; set; }
        public long ExaminationId { get; set; }
        public int PatientId { get; set; }
        public int RequestedByDoctorId { get; set; }
        public string DocumentName { get; set; } = string.Empty;
        public string? Note { get; set; }
        public string Status { get; set; } = "Pending";
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }

        public virtual Examination Examination { get; set; } = null!;
        public virtual Patient Patient { get; set; } = null!;
        public virtual StaffProfile RequestedByDoctor { get; set; } = null!;
        public virtual ICollection<PatientDocument> Documents { get; set; } = new List<PatientDocument>();
    }
}

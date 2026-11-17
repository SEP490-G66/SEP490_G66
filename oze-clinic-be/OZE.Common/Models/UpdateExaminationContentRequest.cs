namespace OZE.Common.Models
{
    // Both texts are replaced as a whole, an empty value clears the field
    public class UpdateExaminationContentRequest
    {
        // The reason the patient gave when booking, which the doctor may correct
        public string? ChiefComplaint { get; set; }

        public string? ClinicalNotes { get; set; }
        // Symptom labels; null keeps the saved ones, an empty list clears them
        public List<string>? Symptoms { get; set; }
    }
}

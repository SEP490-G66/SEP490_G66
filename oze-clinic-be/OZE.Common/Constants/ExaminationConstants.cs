namespace OZE.Common.Constants
{
    public static class ExaminationConstants
    {
        // Must match the check constraint CK_Examinations_Status
        public const string InProgress = "InProgress";
        public const string Completed = "Completed";
        public const string Locked = "Locked";

        // Limits of the free text fields. The database columns have no limit, so the service enforces these.
        public const int ChiefComplaintMaxLength = 500;
        public const int ClinicalNotesMaxLength = 2000;
        // Must match the column lengths in ClinicalDiagnosisConfiguration
        public const int DiagnosisCodeMaxLength = 20;
        public const int DiagnosisNameMaxLength = 300;
        public const int DiagnosisDescriptionMaxLength = 1000;
        // Symptoms are stored as a JSON array; findings and diagnosis teeth as text
        public const int SymptomsMaxLength = 1000;
        public const int SymptomMaxLength = 100;
        public const int MaxSymptoms = 30;
        public const int DiagnosisTeethMaxLength = 200;
        public const int ToothFindingConditionMaxLength = 100;
        public const int ToothFindingSurfacesMaxLength = 20;
        public static readonly string[] ToothSurfaces = { "M", "O", "D", "B", "L" };

        // Addenda to a locked examination (F-EXM-08). Types must match CK_ClinicalRecordAddenda_Type
        public const string AddendumCorrection = "Correction";
        public const string AddendumAddition = "Addition";
        public const string AddendumClarification = "Clarification";
        public static readonly string[] AddendumTypes = { AddendumCorrection, AddendumAddition, AddendumClarification };
        public const int AddendumContentMaxLength = 2000;
    }
}

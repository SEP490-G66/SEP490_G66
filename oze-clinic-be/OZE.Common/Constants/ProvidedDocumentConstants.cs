namespace OZE.Common.Constants
{
    // Documents the patient uploads from elsewhere without a doctor's request ("Cung cấp tài liệu").
    // They are PatientDocuments rows; the files of one upload share an UploadGroupId.
    public static class ProvidedDocumentConstants
    {
        // PatientDocuments.DocumentType of these files
        public const string DocumentType = "Provided";

        public const int DocumentNameMaxLength = 200;
        public const int ProviderAddressMaxLength = 300;
        public const int NoteMaxLength = 500;

        // PatientDocuments.Category: what kind of document it is (the FE shows them as Phim chụp, Xét nghiệm...)
        public static class Category
        {
            public const string Imaging = "Imaging";
            public const string LabResult = "LabResult";
            public const string Prescription = "Prescription";
            public const string MedicalPaper = "MedicalPaper";
            public const string Other = "Other";
        }

        public static readonly string[] Categories = { Category.Imaging, Category.LabResult, Category.Prescription, Category.MedicalPaper, Category.Other };

        public static readonly string[] UploadExtensions = { ".pdf", ".jpg", ".jpeg", ".png", ".dcm" };
        public const int UploadMaxFiles = 5;
        public const long UploadMaxFileBytes = 20 * 1024 * 1024;
        // Whole multipart body: the largest valid upload plus 1 MB for the form fields, boundaries and headers
        public const long UploadMaxRequestBytes = UploadMaxFiles * UploadMaxFileBytes + 1024 * 1024;

        // Stored under documents/{yyyy}/{MM}/PD-{group}/ in the file store
        public const string FolderPrefix = "PD-";
    }
}

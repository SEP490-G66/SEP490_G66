namespace OZE.Common.Constants
{
    // Documents the doctor asks the patient to submit for an examination ("Yêu cầu bổ sung tài liệu")
    public static class DocumentRequestConstants
    {
        // Must match CK_DocumentRequests_Status in DocumentRequestConfiguration.
        public const string Pending = "Pending";
        public const string Submitted = "Submitted";
        public const string Cancelled = "Cancelled";
        public static readonly string[] Statuses = { Pending, Submitted, Cancelled };

        public const int DocumentNameMaxLength = 200;
        public const int NoteMaxLength = 500;

        public const string InProgressExaminationStatus = "InProgress";

        // Files the patient uploads
        public static readonly string[] UploadExtensions = { ".pdf", ".jpg", ".jpeg", ".png" };
        public const int UploadMaxFiles = 10;
        public const long UploadMaxFileBytes = 20 * 1024 * 1024;
        // Whole multipart body: the largest valid upload plus 1 MB for the form boundaries and headers
        public const long UploadMaxRequestBytes = UploadMaxFiles * UploadMaxFileBytes + 1024 * 1024;
        // Stored under documents/{yyyy}/{MM}/DR-{id}/ in the file store
        public const string StorageFolder = "documents";
        public const string FolderPrefix = "DR-";
        // PatientDocuments.DocumentType of a file uploaded for a request
        public const string DocumentType = "DocumentRequest";
        public const int FileNameMaxLength = 500;
        public const string FileUrlFormat = "/api/patient-documents/{0}/file";
    }
}

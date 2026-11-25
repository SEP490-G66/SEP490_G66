// "Cung cấp tài liệu": documents the patient uploads without a doctor's request (ProvidedDocumentsController).
// The limits match the backend's checks (ProvidedDocumentConstants).

export const PROVIDED_DOCUMENT_NAME_MAX = 200;
export const PROVIDED_DOCUMENT_ADDRESS_MAX = 300;

export const PROVIDED_DOCUMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".dcm"];
export const PROVIDED_DOCUMENT_MAX_MB = 20;
export const PROVIDED_DOCUMENT_MAX_FILES = 5;

export const PROVIDED_DOCUMENT_STATUS = { label: "Đã tải lên", badge: "badge-success" };

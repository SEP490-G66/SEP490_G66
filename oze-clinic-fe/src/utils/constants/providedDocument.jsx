// "Cung cấp tài liệu": documents the patient uploads without a doctor's request (ProvidedDocumentsController).
// They belong to the patient's record, not to one visit: every doctor sees them at every visit.
// The limits match the backend's checks (ProvidedDocumentConstants).

export const PROVIDED_DOCUMENT_NAME_MAX = 200;
export const PROVIDED_DOCUMENT_ADDRESS_MAX = 300;
export const PROVIDED_DOCUMENT_NOTE_MAX = 500;

export const PROVIDED_DOCUMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".dcm"];
export const PROVIDED_DOCUMENT_MAX_MB = 20;
export const PROVIDED_DOCUMENT_MAX_FILES = 5;

// Backend codes (ProvidedDocumentConstants.Category), in the order the patient picks them
export const PROVIDED_DOCUMENT_CATEGORIES = [
    { value: "Imaging", label: "Phim chụp", full: "Phim X-quang / CT" },
    { value: "LabResult", label: "Xét nghiệm", full: "Kết quả xét nghiệm" },
    { value: "Prescription", label: "Đơn thuốc", full: "Đơn thuốc" },
    { value: "MedicalPaper", label: "Giấy khám", full: "Giấy khám bệnh, giấy ra viện" },
    { value: "Other", label: "Khác", full: "Khác" },
];

export const providedCategoryOf = (value) => PROVIDED_DOCUMENT_CATEGORIES.find((category) => category.value === value) ?? null;

// "Trần Minh Khoa" -> "BS. Trần Minh Khoa"; a name already starting with "BS" is kept as it is
export const doctorTitle = (name) => (!name ? "Bác sĩ" : /^BS\b/i.test(name.trim()) ? name.trim() : `BS. ${name.trim()}`);

// Status of a provided document: has a doctor opened it yet?
export const PROVIDED_DOCUMENT_STATUS = {
    SEEN: { label: "Bác sĩ đã xem", badge: "badge-success" },
    WAITING: { label: "Chờ bác sĩ xem", badge: "badge-warning" },
};

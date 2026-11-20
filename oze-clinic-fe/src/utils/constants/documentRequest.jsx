// "Yêu cầu bổ sung tài liệu" (DocumentRequestsController). Statuses are the backend's own codes
// (DocumentRequestConstants); the upload limits match the backend's checks.

export const DOCUMENT_REQUEST_STATUS = { PENDING: "Pending", SUBMITTED: "Submitted", CANCELLED: "Cancelled" };

export const DOCUMENT_REQUEST_STATUS_LABELS = {
    [DOCUMENT_REQUEST_STATUS.PENDING]: { label: "Chờ nộp", badge: "badge-warning" },
    [DOCUMENT_REQUEST_STATUS.SUBMITTED]: { label: "Đã nộp", badge: "badge-success" },
    [DOCUMENT_REQUEST_STATUS.CANCELLED]: { label: "Đã huỷ", badge: "badge-neutral" },
};

export const DOCUMENT_NAME_MAX = 200;
export const DOCUMENT_NOTE_MAX = 500;

export const DOCUMENT_UPLOAD_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
export const DOCUMENT_UPLOAD_MAX_MB = 20;
export const DOCUMENT_UPLOAD_MAX_FILES = 10;

// Imaging orders as the technician sees them (api/imaging-requests, M6 in oze-clinic-be/docs/chuc-nang).

// RequestStatus of an imaging order. The technician cannot cancel one: only the doctor who ordered it can.
export const IMAGING_REQUEST_STATUSES = {
    PENDING: "Pending",
    IN_PROGRESS: "InProgress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
};

export const IMAGING_REQUEST_STATUS_LABELS = {
    Pending: { label: "Chờ chụp", badge: "badge-neutral" },
    InProgress: { label: "Đang chụp", badge: "badge-info" },
    Completed: { label: "Hoàn tất", badge: "badge-success" },
    Cancelled: { label: "Đã huỷ", badge: "badge-neutral" },
};

// ImagingType values of the backend (ImagingRequestConstants.ImagingTypes).
export const IMAGING_TYPE_LABELS = {
    "Periapical X-ray": "Phim quanh chóp",
    Panoramic: "Phim toàn cảnh (Panorama)",
    Cephalometric: "Phim sọ nghiêng",
    CBCT: "CT Cone beam (CBCT)",
    "Intraoral Photo": "Ảnh chụp trong miệng",
};

export const imagingTypeLabel = (type) => IMAGING_TYPE_LABELS[type] ?? type ?? "";

// X-ray devices of oze-xray-simulator and the order types each one takes. Other types are uploaded by hand.
export const CAPTURE_DEVICES = [
    { id: "XR-PANO-01", name: "Máy chụp toàn cảnh", imagingTypes: ["Panoramic"] },
    { id: "XR-IO-01", name: "Cảm biến trong miệng", imagingTypes: ["Periapical X-ray"] },
];

export const devicesForImagingType = (type) => CAPTURE_DEVICES.filter((device) => device.imagingTypes.includes(type));

// "Máy chụp" block of the capture screen.
export const CAPTURE_STATES = {
    READY: "ready",
    CAPTURING: "capturing",
    COMPLETED: "completed",
    FAILED: "failed",
    UNSUPPORTED: "unsupported",
    UNAVAILABLE: "unavailable",
};

export const CAPTURE_STATE_LABELS = {
    ready: { label: "Sẵn sàng", badge: "badge-success" },
    capturing: { label: "Đang chụp", badge: "badge-info" },
    completed: { label: "Hoàn tất", badge: "badge-success" },
    failed: { label: "Lỗi", badge: "badge-danger" },
    unsupported: { label: "Không hỗ trợ", badge: "badge-neutral" },
    unavailable: { label: "Không sẵn sàng", badge: "badge-warning" },
};

export const CAPTURE_IMAGE_COUNT_MAX = 10;

// "Tải ảnh thủ công"
export const MANUAL_UPLOAD_EXTENSIONS = [".dcm", ".jpg", ".jpeg", ".png"];
export const MANUAL_UPLOAD_MAX_MB = 50;

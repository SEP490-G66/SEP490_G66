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

// Device modality of the order types an X-ray device can take (ImagingCaptureConstants.ModalityByImagingType).
// Other types are uploaded by hand.
export const IMAGING_TYPE_MODALITY = {
    Panoramic: "PANORAMIC",
    "Periapical X-ray": "PERIAPICAL",
};

// Suggested exposure per order type, filled in for the technician (who can change it), with the usual range of
// dental X-ray units. Reference values for the demo only: a real unit uses the maker's presets for the patient
// (child / adult, small / large build). TODO(be): move these to the system settings or the device presets.
export const EXPOSURE_PRESETS = {
    Panoramic: {
        kv: { suggested: 70, min: 60, max: 90 },
        ma: { suggested: 10, min: 4, max: 15 },
        seconds: { suggested: 14, min: 10, max: 20 },
    },
    "Periapical X-ray": {
        kv: { suggested: 70, min: 60, max: 70 },
        ma: { suggested: 7, min: 4, max: 8 },
        seconds: { suggested: 0.2, min: 0.05, max: 1 },
    },
};

// { kv, ma, seconds } to fill in a new capture form; empty when the order type has no preset
export const suggestedExposure = (imagingType) => {
    const preset = EXPOSURE_PRESETS[imagingType];
    return preset
        ? { kv: preset.kv.suggested, ma: preset.ma.suggested, seconds: preset.seconds.suggested }
        : { kv: "", ma: "", seconds: "" };
};

// State of a device (GET api/imaging-devices); it only takes an order while READY.
export const DEVICE_READY = "READY";
export const DEVICE_STATE_LABELS = {
    READY: "Sẵn sàng",
    BUSY: "Đang bận",
    INITIALIZING: "Đang khởi động",
    OFFLINE: "Đã tắt",
    ERROR: "Lỗi",
};

export const deviceStateLabel = (state) => DEVICE_STATE_LABELS[state] ?? state ?? "";

// Film types a device takes (supportedModalities of GET api/imaging-devices).
export const MODALITY_LABELS = {
    PANORAMIC: "Toàn cảnh",
    PERIAPICAL: "Quanh chóp",
    BITEWING: "Cắn cánh",
};

export const modalitiesText = (modalities) => (modalities ?? []).map((modality) => MODALITY_LABELS[modality] ?? modality).join(", ");

// Every device, each marked supported when it takes the order type: supported and ready first, then supported, then the others.
export const devicesForImagingType = (devices, type) => {
    const modality = IMAGING_TYPE_MODALITY[type];
    const rank = (device) => (device.supported ? 2 : 0) + (device.state === DEVICE_READY ? 1 : 0);
    return (devices ?? [])
        .map((device) => ({ ...device, supported: Boolean(modality && device.supportedModalities?.includes(modality)) }))
        .sort((a, b) => rank(b) - rank(a));
};

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

import api from "./api";
import { call } from "./receptionService";
import { MANUAL_UPLOAD_EXTENSIONS } from "@/utils/imagingRequest";

// Imaging technician ("Chụp chiếu", "Lịch sử chụp chiếu"). Every call returns the ApiResponse shape
// ({ success, message, data, errors }).
// Real API: the queue and "Hoàn thành" (ImagingRequestsController), history (ImagingHistoryController).
// TODO(api): capture and manual upload are still mocks here
// (see oze-fe-docs/08-webhook-may-chup-xquang.md).

const MESSAGES = [
    [/imaging request is Cancelled/i, "Bác sĩ đã huỷ chỉ định này."],
    [/imaging request is Completed/i, "Chỉ định này đã hoàn tất (máy đã gửi kết quả)."],
    [/Imaging request not found/i, "Không tìm thấy chỉ định chụp."],
    [/Status must be Completed or Cancelled/i, "Trạng thái lọc không hợp lệ."],
    [/start date must not be after the end date/i, "Ngày bắt đầu không được sau ngày kết thúc."],
];

const translate = (response) => {
    if (response.success || !response.message) return response;
    const match = MESSAGES.find(([pattern]) => pattern.test(response.message));
    return match ? { ...response, message: match[1] } : response;
};

const success = (data, message = null) => ({ success: true, message, data, errors: null });
const failure = (message) => ({ success: false, message, data: null, errors: null });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Orders waiting (Pending) or being imaged (InProgress), oldest first; one row per order.
export const getImagingQueue = async () => {
    const response = await call(() => api.get("/api/imaging-requests/queue"));
    return response.success ? { ...response, data: response.data ?? [] } : translate(response);
};

// Marks the order done: the doctor is told and the patient goes back to the top of the exam queue.
export const completeImagingRequest = async (id) => translate(await call(() => api.post(`/api/imaging-requests/${id}/complete`)));

// ---- TODO(api): mock capture, like oze-xray-simulator (≈3 s exposure + 3 s processing) ----

const CAPTURE_MS = 6000;
const sessions = new Map();

// POST api/imaging-requests/{id}/capture in the backend proposal. setup: { deviceId, imageCount, kv, ma, seconds }.
export const startCapture = async (requestId, setup) => {
    await wait(300);
    const imageCount = Math.max(1, Number(setup.imageCount) || 1);
    const session = { id: `SIM-${Date.now().toString(16).toUpperCase()}`, requestId, deviceId: setup.deviceId, imageCount, sentAt: new Date().toISOString() };
    sessions.set(session.id, session);
    return success({ ...session });
};

// state: "capturing" until the device returns the images, then "completed" (or "cancelled").
export const getCapture = async (sessionId) => {
    const session = sessions.get(sessionId);
    if (!session) return failure("Không tìm thấy phiên chụp.");
    if (session.cancelled) return success({ ...session, state: "cancelled", images: [] });
    const finished = Date.now() - new Date(session.sentAt).getTime() >= CAPTURE_MS;
    if (!finished) return success({ ...session, state: "capturing", images: [] });
    const finishedAt = new Date(new Date(session.sentAt).getTime() + CAPTURE_MS).toISOString();
    const images = Array.from({ length: session.imageCount }, (_, index) => ({ id: `${session.id}-${index + 1}`, takenAt: finishedAt }));
    return success({ ...session, state: "completed", finishedAt, images });
};

export const cancelCapture = async (sessionId) => {
    await wait(200);
    const session = sessions.get(sessionId);
    if (!session) return failure("Không tìm thấy phiên chụp.");
    session.cancelled = true;
    return success(null, "Đã huỷ lệnh chụp.");
};

// "Tải ảnh thủ công". .jpg / .png get a local preview; a .dcm has none until the backend reads DICOM.
export const uploadManualImages = async (requestId, { files }) => {
    await wait(400);
    const now = new Date().toISOString();
    const images = files.map((file, index) => {
        const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        const preview = MANUAL_UPLOAD_EXTENSIONS.includes(extension) && extension !== ".dcm";
        return { id: `manual-${requestId}-${Date.now()}-${index}`, takenAt: now, url: preview ? URL.createObjectURL(file) : undefined };
    });
    return success(images, `Đã tải lên ${images.length} ảnh.`);
};

// ---- History ("Lịch sử chụp chiếu"): done or cancelled orders ----

// filters: { keyword, imagingType, status, from, to (yyyy-mm-dd), page, pageSize }.
// data: { items, page, pageSize, totalItems, totalPages } (the table and the pager read these names).
export const getImagingHistory = async ({ keyword = "", imagingType = "", status = "", from = "", to = "", page = 1, pageSize = 10 } = {}) => {
    const params = { keyword: keyword || undefined, imagingType: imagingType || undefined, status: status || undefined, from: from || undefined, to: to || undefined, page, pageSize };
    const response = translate(await call(() => api.get("/api/imaging-history", { params })));
    if (!response.success) return response;
    const data = response.data ?? {};
    return {
        ...response,
        data: { items: data.items ?? [], page: data.pageNumber ?? page, pageSize: data.pageSize ?? pageSize, totalItems: data.totalCount ?? 0, totalPages: Math.max(1, data.totalPages ?? 1) },
    };
};

// A picture needs the sign-in token, so it is fetched as a blob and shown through an object URL.
// Sample pictures (fileUrl null) have no file on the server: the viewer shows its placeholder.
const loadPicture = async (image) => {
    if (!image.fileUrl) return { ...image };
    try {
        const response = await api.get(image.fileUrl, { responseType: "blob" });
        return { ...image, url: URL.createObjectURL(response.data) };
    } catch {
        return { ...image };
    }
};

// Object URLs made by getImagingHistoryDetail; call when the detail is closed.
export const releaseImagingHistoryPictures = (detail) => {
    (detail?.images ?? []).forEach((image) => image.url && URL.revokeObjectURL(image.url));
};

export const getImagingHistoryDetail = async (id) => {
    const response = translate(await call(() => api.get(`/api/imaging-history/${id}`)));
    if (!response.success) return response;
    const images = await Promise.all((response.data.images ?? []).map(loadPicture));
    return { ...response, data: { ...response.data, images } };
};

import api from "./api";
import { call } from "./receptionService";
import { MOCK_IMAGING_HISTORY } from "@/utils/data/mockImagingHistory";
import { IMAGING_REQUEST_STATUSES, MANUAL_UPLOAD_EXTENSIONS } from "@/utils/imagingRequest";
import { normalizeText } from "@/utils/format";

// Imaging technician ("Chụp chiếu", "Lịch sử chụp chiếu"). Every call returns the ApiResponse shape
// ({ success, message, data, errors }).
// Real API: the queue and "Hoàn thành" (ImagingRequestsController).
// TODO(api): capture, manual upload and history are mocks: the backend has no endpoint for them yet
// (see oze-fe-docs/08-webhook-may-chup-xquang.md).

const MESSAGES = [
    [/imaging request is Cancelled/i, "Bác sĩ đã huỷ chỉ định này."],
    [/imaging request is Completed/i, "Chỉ định này đã hoàn tất (máy đã gửi kết quả)."],
    [/Imaging request not found/i, "Không tìm thấy chỉ định chụp."],
];

const translate = (response) => {
    if (response.success || !response.message) return response;
    const match = MESSAGES.find(([pattern]) => pattern.test(response.message));
    return match ? { ...response, message: match[1] } : response;
};

const success = (data, message = null) => ({ success: true, message, data, errors: null });
const failure = (message) => ({ success: false, message, data: null, errors: null });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// TODO(api): history rows (sample data + orders completed in this session).
const history = MOCK_IMAGING_HISTORY.map((item) => ({ ...item }));

// Orders waiting (Pending) or being imaged (InProgress), oldest first; one row per order.
export const getImagingQueue = async () => {
    const response = await call(() => api.get("/api/imaging-requests/queue"));
    return response.success ? { ...response, data: response.data ?? [] } : translate(response);
};

// Marks the order done: the doctor is told and the patient goes back to the top of the exam queue.
// summary ({ patientName, ..., deviceId, images }) is kept for the history page until it has its own API.
export const completeImagingRequest = async (id, summary = {}) => {
    const response = translate(await call(() => api.post(`/api/imaging-requests/${id}/complete`)));
    if (response.success) {
        history.unshift({
            ...summary,
            id,
            status: IMAGING_REQUEST_STATUSES.COMPLETED,
            completedAt: new Date().toISOString(),
            imageCount: summary.images?.length ?? 0,
        });
    }
    return response;
};

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

// ---- TODO(api): mock history ----

const inRange = (value, from, to) => {
    const day = (value ?? "").slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
};

// filters: { keyword, imagingType, status, from, to (yyyy-mm-dd), page, pageSize }.
export const getImagingHistory = async ({ keyword = "", imagingType = "", status = "", from = "", to = "", page = 1, pageSize = 10 } = {}) => {
    await wait(250);
    const q = normalizeText(keyword);
    const rows = history
        .filter((item) => !q || [item.patientName, item.patientCode, `IR-${item.id}`].some((field) => normalizeText(field).includes(q)))
        .filter((item) => (!imagingType || item.imagingType === imagingType) && (!status || item.status === status) && inRange(item.createdAt, from, to))
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const current = Math.min(page, totalPages);
    return success({ items: rows.slice((current - 1) * pageSize, current * pageSize), page: current, pageSize, totalItems: rows.length, totalPages });
};

export const getImagingHistoryDetail = async (id) => {
    await wait(200);
    const item = history.find((row) => row.id === id);
    return item ? success({ ...item, images: (item.images ?? []).map((image) => ({ ...image })) }) : failure("Không tìm thấy lượt chụp.");
};

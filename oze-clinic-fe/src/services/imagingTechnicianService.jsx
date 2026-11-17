import api from "./api";
import { call } from "./receptionService";
import { loadPicture, releasePictures } from "./imagingPictures";
import { MANUAL_UPLOAD_EXTENSIONS } from "@/utils/imagingRequest";

// Imaging technician ("Chụp chiếu", "Lịch sử chụp chiếu"). Every call returns the ApiResponse shape
// ({ success, message, data, errors }).
// Real API: the queue and "Hoàn thành" (ImagingRequestsController), capture and manual upload (ImagingCapturesController),
// history (ImagingHistoryController).

const MESSAGES = [
    [/imaging request is Cancelled/i, "Bác sĩ đã huỷ chỉ định này."],
    [/imaging request is Completed/i, "Chỉ định này đã hoàn tất (máy đã gửi kết quả)."],
    [/Imaging request not found/i, "Không tìm thấy chỉ định chụp."],
    [/Status must be Completed or Cancelled/i, "Trạng thái lọc không hợp lệ."],
    [/start date must not be after the end date/i, "Ngày bắt đầu không được sau ngày kết thúc."],
    [/X-ray device is not reachable/i, "Không kết nối được máy chụp. Vui lòng thử lại sau."],
    [/X-ray device refused the capture/i, "Máy chụp từ chối lệnh chụp. Kiểm tra lại máy và thông số."],
    [/X-ray device cannot take/i, "Máy chụp không hỗ trợ loại phim này. Vui lòng tải ảnh thủ công."],
    [/capture is already running/i, "Chỉ định này đang có một lượt chụp chạy."],
    [/Capture not found/i, "Không tìm thấy phiên chụp."],
    [/Cannot cancel because the capture is/i, "Lượt chụp đã kết thúc, không huỷ được nữa."],
    [/select an X-ray device/i, "Vui lòng chọn máy chụp."],
    [/Number of images must be between/i, "Số ảnh phải từ 1 đến 10."],
    [/choose at least one image/i, "Vui lòng chọn ít nhất một ảnh."],
    [/at most 10 images/i, "Mỗi lần tải tối đa 10 ảnh."],
    [/is not a supported image/i, "Chỉ nhận ảnh .png, .jpg, .jpeg hoặc .dcm."],
    [/larger than 20 MB/i, "Mỗi ảnh tối đa 20 MB."],
    [/is empty./i, "Có ảnh bị rỗng, vui lòng chọn lại."],
];

const translate = (response) => {
    if (response.success || !response.message) return response;
    const match = MESSAGES.find(([pattern]) => pattern.test(response.message));
    return match ? { ...response, message: match[1] } : response;
};

const success = (data, message = null) => ({ success: true, message, data, errors: null });
const failure = (message) => ({ success: false, message, data: null, errors: null });

// Orders waiting (Pending) or being imaged (InProgress), oldest first; one row per order.
export const getImagingQueue = async () => {
    const response = await call(() => api.get("/api/imaging-requests/queue"));
    return response.success ? { ...response, data: response.data ?? [] } : translate(response);
};

// Marks the order done: the doctor is told and the patient goes back to the top of the exam queue.
// After a capture on the device the backend has already completed the order when the pictures arrived: that counts as done.
export const completeImagingRequest = async (id) => {
    const response = await call(() => api.post(`/api/imaging-requests/${id}/complete`));
    if (!response.success && /imaging request is Completed/i.test(response.message ?? "")) return success(null);
    return translate(response);
};

// ---- Capture on the X-ray device (ImagingCapturesController; the backend talks to oze-xray-simulator) ----

const CAPTURE_STATUS = { COMPLETED: "COMPLETED", FAILED: "FAILED", CANCELLED: "CANCELLED" };

const toSession = (data) => ({
    id: data.simulationId,
    requestId: data.imagingRequestId,
    deviceId: data.deviceId,
    imageCount: data.imageCount,
    progress: data.progress ?? 0,
    sentAt: data.startedAt,
});

// setup: { deviceId, imageCount, kv, ma, seconds }. data: the session { id, requestId, deviceId, imageCount, progress, sentAt }.
export const startCapture = async (requestId, setup) => {
    const body = {
        deviceId: setup.deviceId,
        imageCount: Math.max(1, Number(setup.imageCount) || 1),
        kv: setup.kv ?? null,
        ma: setup.ma ?? null,
        exposureSeconds: setup.seconds ?? null,
    };
    const response = translate(await call(() => api.post(`/api/imaging-requests/${requestId}/captures`, body)));
    return response.success ? { ...response, data: toSession(response.data) } : response;
};

// state: "capturing" (with progress) until the device returns the images, then "completed" (images loaded) or "cancelled".
// A failed capture comes back as success: false with the device's reason.
export const getCapture = async (requestId, sessionId) => {
    const response = await call(() => api.get(`/api/imaging-requests/${requestId}/captures/${sessionId}`));
    // 409: the device's "done" message was being saved at the same moment; the next poll reads the result
    if (!response.success && response.status === 409) return success({ id: sessionId, state: "capturing", images: [] });
    if (!response.success) return translate(response);

    const data = response.data;
    const session = toSession(data);
    if (data.status === CAPTURE_STATUS.FAILED) return failure(data.failureMessage || "Máy chụp báo lỗi, vui lòng chụp lại.");
    if (data.status === CAPTURE_STATUS.CANCELLED) return success({ ...session, state: "cancelled", images: [] });
    if (data.status !== CAPTURE_STATUS.COMPLETED) return success({ ...session, state: "capturing", images: [] });

    const images = await Promise.all(
        (data.images ?? []).map((image) => loadPicture({ id: image.resultId, fileName: image.fileName, fileUrl: image.fileUrl, takenAt: data.completedAt })),
    );
    return success({ ...session, state: "completed", finishedAt: data.completedAt, images });
};

export const cancelCapture = async (requestId, sessionId) =>
    translate(await call(() => api.post(`/api/imaging-requests/${requestId}/captures/${sessionId}/cancel`)));

// "Tải ảnh thủ công" (POST api/imaging-requests/{id}/results, multipart). .jpg / .png get a local preview;
// a .dcm has none (the server keeps the file, nobody reads DICOM yet).
export const uploadManualImages = async (requestId, { files, note }) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    if (note) form.append("note", note);
    const response = translate(
        await call(() => api.post(`/api/imaging-requests/${requestId}/results`, form, { headers: { "Content-Type": "multipart/form-data" } })),
    );
    if (!response.success) return response;

    const now = new Date().toISOString();
    const images = (response.data ?? []).map((image, index) => {
        const file = files[index];
        const extension = file ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
        const preview = file && MANUAL_UPLOAD_EXTENSIONS.includes(extension) && extension !== ".dcm";
        return { id: image.resultId, fileName: image.fileName, fileUrl: image.fileUrl, takenAt: now, url: preview ? URL.createObjectURL(file) : undefined };
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

// Object URLs made by getImagingHistoryDetail; call when the detail is closed.
export const releaseImagingHistoryPictures = (detail) => {
    releasePictures(detail?.images);
};

export const getImagingHistoryDetail = async (id) => {
    const response = translate(await call(() => api.get(`/api/imaging-history/${id}`)));
    if (!response.success) return response;
    const images = await Promise.all((response.data.images ?? []).map(loadPicture));
    return { ...response, data: { ...response.data, images } };
};

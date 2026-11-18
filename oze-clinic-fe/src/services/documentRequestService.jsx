import api from "./api";
import { call } from "./receptionService";
import { examinationIdOf } from "./examinationService";

// "Yêu cầu bổ sung tài liệu" (DocumentRequestsController). Every call returns the ApiResponse shape
// ({ success, message, data, errors }). A request: { id, examinationId, examinationDate, documentName, note, status,
// doctorName, canCancel (doctor list only), createdAt, updatedAt, files: [{ id, fileName, fileUrl, createdAt }] }.
// The doctor asks during step 1 of the examination; the patient uploads from the medical book, also after the visit ended.

const MESSAGES = [
    [/Please enter document name/i, "Nhập tên tài liệu cần bổ sung."],
    [/Document name must be at most/i, "Tên tài liệu tối đa 200 ký tự."],
    [/Note must be at most/i, "Ghi chú tối đa 500 ký tự."],
    [/Cannot request documents because the examination is/i, "Lượt khám không còn ở trạng thái đang khám."],
    [/permission to request documents|permission to view document requests/i, "Bạn không phụ trách lượt khám này."],
    [/permission to cancel this document request/i, "Bạn không phải bác sĩ đã tạo yêu cầu này."],
    [/Cannot cancel document request because the document request is Submitted/i, "Bệnh nhân đã nộp tài liệu, không huỷ được nữa."],
    [/Cannot cancel document request because the document request is Cancelled/i, "Yêu cầu này đã được huỷ."],
    [/Document request not found/i, "Không tìm thấy yêu cầu bổ sung tài liệu."],
    [/permission to submit documents/i, "Bạn không có quyền nộp tài liệu cho yêu cầu này."],
    [/document request is Cancelled/i, "Bác sĩ đã huỷ yêu cầu này, không nộp thêm được."],
    [/choose at least one file/i, "Vui lòng chọn ít nhất một file."],
    [/at most 10 files/i, "Mỗi lần tải tối đa 10 file."],
    [/is not a supported file/i, "Chỉ nhận file .pdf, .jpg, .jpeg hoặc .png."],
    [/larger than 20 MB/i, "Mỗi file tối đa 20 MB."],
    [/is empty\./i, "Có file bị rỗng, vui lòng chọn lại."],
    [/Patient profile not found/i, "Tài khoản chưa được liên kết với hồ sơ bệnh nhân."],
    [/Document not found/i, "Không tìm thấy file."],
    [/permission to view this document/i, "Bạn không có quyền xem file này."],
];

const translate = (response) => {
    if (response.success || !response.message) return response;
    const match = MESSAGES.find(([pattern]) => pattern.test(response.message));
    return match ? { ...response, message: match[1] } : response;
};

const failure = (message) => ({ success: false, message, data: null, errors: null });
const NOT_STARTED = "Lượt khám này không còn mở.";

// The patient's pages show their own message instead of leaving for the error page
const PATIENT_CALL = { skipErrorPage: true };

const listOf = (response) => (response.success ? { ...response, data: response.data ?? [] } : response);

// ---- Doctor: step 1 "Lập hồ sơ bệnh án" (queueId: the patient in the room queue) ----

// Every request of the patient, this visit and earlier ones, newest first. data: { examinationId (this visit), requests }.
export const getDocumentRequests = async (queueId) => {
    const examinationId = examinationIdOf(queueId);
    if (!examinationId) return failure(NOT_STARTED);
    const response = listOf(translate(await call(() => api.get(`/api/examinations/${examinationId}/document-requests`))));
    return response.success ? { ...response, data: { examinationId, requests: response.data } } : response;
};

// request: { documentName, note }. data: the new request (Pending); the patient is notified.
export const createDocumentRequest = async (queueId, { documentName, note }) => {
    const examinationId = examinationIdOf(queueId);
    if (!examinationId) return failure(NOT_STARTED);
    const response = translate(
        await call(() => api.post(`/api/examinations/${examinationId}/document-requests`, { documentName: documentName.trim(), note: note?.trim() || null })),
    );
    return response.success ? { ...response, message: `Đã gửi yêu cầu "${response.data.documentName}" tới bệnh nhân.` } : response;
};

export const cancelDocumentRequest = async (id) => {
    const response = translate(await call(() => api.post(`/api/document-requests/${id}/cancel`)));
    return response.success ? { ...response, message: "Đã huỷ yêu cầu bổ sung tài liệu." } : response;
};

// ---- Patient: medical book, tab "Phim và tài liệu" ----

export const getMyDocumentRequests = async (examinationId) =>
    listOf(translate(await call(() => api.get("/api/document-requests/my", { ...PATIENT_CALL, params: { examinationId } }))));

// files: File[] (already checked by the upload dialog; the backend checks again). data: the request, now Submitted.
export const submitDocumentFiles = async (id, files) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    const response = translate(
        await call(() => api.post(`/api/document-requests/${id}/files`, form, { ...PATIENT_CALL, headers: { "Content-Type": "multipart/form-data" } })),
    );
    return response.success ? { ...response, message: `Đã nộp ${files.length} file.` } : response;
};

// ---- Both: open a stored file (GET api/patient-documents/{id}/file needs the sign-in token) ----

// Opens the file in a new tab; when the browser blocks the tab it is downloaded instead. No preview inside the page.
export const openDocumentFile = async ({ fileUrl, fileName }) => {
    // The tab is opened now, while the click still counts, and gets the file once it has arrived
    const tab = window.open("", "_blank");
    try {
        const response = await api.get(fileUrl, { ...PATIENT_CALL, responseType: "blob" });
        const url = URL.createObjectURL(response.data);
        if (tab) {
            tab.location.href = url;
        } else {
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? "";
            link.click();
        }
        // Long enough for the tab to load it
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return { success: true, message: null, data: null, errors: null };
    } catch {
        tab?.close();
        return failure("Không mở được file. Vui lòng thử lại.");
    }
};

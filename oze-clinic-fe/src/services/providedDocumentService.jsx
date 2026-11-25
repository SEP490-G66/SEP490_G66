import api from "./api";
import { call } from "./receptionService";
import { examinationIdOf } from "./examinationService";

// "Cung cấp tài liệu" (ProvidedDocumentsController): documents the patient uploads from elsewhere, without a request.
// A document: { id (guid), documentName, performedOn, providerAddress, createdAt, files: [{ id, fileName, fileUrl, createdAt }] }.
// Files open through openDocumentFile (documentRequestService). Every call returns the ApiResponse shape.

const MESSAGES = [
    [/Please enter document name/i, "Nhập tên tài liệu."],
    [/Document name must be at most/i, "Tên tài liệu tối đa 200 ký tự."],
    [/Please enter provider address/i, "Nhập địa chỉ cung cấp."],
    [/Provider address must be at most/i, "Địa chỉ cung cấp tối đa 300 ký tự."],
    [/Performed date cannot be in the future/i, "Ngày thực hiện không được sau hôm nay."],
    [/choose at least one file/i, "Vui lòng chọn ít nhất một tệp."],
    [/at most 5 files/i, "Mỗi tài liệu tối đa 5 tệp."],
    [/is not a supported file/i, "Chỉ nhận tệp .pdf, .jpg, .jpeg, .png hoặc .dcm."],
    [/larger than 20 MB/i, "Mỗi tệp tối đa 20 MB."],
    [/is empty\./i, "Có tệp bị rỗng, vui lòng chọn lại."],
    [/Patient profile not found/i, "Tài khoản chưa được liên kết với hồ sơ bệnh nhân."],
    [/Document not found/i, "Không tìm thấy tài liệu."],
    [/permission to delete this document/i, "Bạn không thể xoá tài liệu này."],
    [/permission to view document requests/i, "Bạn không phụ trách lượt khám này."],
];

const translate = (response) => {
    if (response.success || !response.message) return response;
    const match = MESSAGES.find(([pattern]) => pattern.test(response.message));
    return match ? { ...response, message: match[1] } : response;
};

const PATIENT_CALL = { skipErrorPage: true };

const listOf = (response) => (response.success ? { ...response, data: response.data ?? [] } : response);

export const getMyProvidedDocuments = async () => listOf(translate(await call(() => api.get("/api/provided-documents/my", PATIENT_CALL))));

// performedOn: "yyyy-mm-dd" or "". files: File[] (already checked by the upload dialog; the backend checks again).
export const uploadProvidedDocument = async ({ documentName, performedOn, providerAddress, files }) => {
    const form = new FormData();
    form.append("documentName", documentName.trim());
    form.append("providerAddress", providerAddress.trim());
    if (performedOn) form.append("performedOn", performedOn);
    files.forEach((file) => form.append("files", file));
    const response = translate(await call(() => api.post("/api/provided-documents", form, { ...PATIENT_CALL, headers: { "Content-Type": "multipart/form-data" } })));
    return response.success ? { ...response, message: `Đã tải lên "${response.data.documentName}".` } : response;
};

export const deleteProvidedDocument = async (id) => {
    const response = translate(await call(() => api.delete(`/api/provided-documents/${id}`, PATIENT_CALL)));
    return response.success ? { ...response, message: "Đã xoá tài liệu." } : response;
};

// Doctor, step 1 of the examination: every document the patient provided.
export const getExaminationProvidedDocuments = async (queueId) => {
    const examinationId = examinationIdOf(queueId);
    if (!examinationId) return { success: false, message: "Lượt khám này không còn mở.", data: null, errors: null };
    return listOf(translate(await call(() => api.get(`/api/examinations/${examinationId}/provided-documents`))));
};

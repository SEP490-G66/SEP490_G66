import api from "./api";
import { call } from "./receptionService";
import { examinationIdOf } from "./examinationService";

// "Cung cấp tài liệu" (ProvidedDocumentsController): documents the patient uploads from elsewhere, without a request.
// They belong to the patient's record (not to one visit): every doctor reads them at every visit, and the first doctor
// who opens them marks them seen. A document: { id (guid), documentName, category, note, performedOn, providerAddress,
// seenAt, seenByDoctorName, canDelete, createdAt, files: [{ id, fileName, fileUrl, createdAt }] }.
// Files open through openDocumentFile (documentRequestService). Every call returns the ApiResponse shape.

const MESSAGES = [
    [/Please enter document name/i, "Nhập tên tài liệu."],
    [/Document name must be at most/i, "Tên tài liệu tối đa 200 ký tự."],
    [/choose the document type/i, "Chọn loại tài liệu."],
    [/Provider address must be at most/i, "Nơi thực hiện tối đa 300 ký tự."],
    [/Note must be at most/i, "Ghi chú tối đa 500 ký tự."],
    [/already seen this document/i, "Bác sĩ đã xem tài liệu này nên không xoá được."],
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

// category: a PROVIDED_DOCUMENT_CATEGORIES value. performedOn: "yyyy-mm-dd" or "". providerAddress, note: optional.
// files: File[] (already checked by the upload dialog; the backend checks again).
export const uploadProvidedDocument = async ({ documentName, category, performedOn, providerAddress, note, files }) => {
    const form = new FormData();
    form.append("documentName", documentName.trim());
    form.append("category", category);
    if (providerAddress?.trim()) form.append("providerAddress", providerAddress.trim());
    if (note?.trim()) form.append("note", note.trim());
    if (performedOn) form.append("performedOn", performedOn);
    files.forEach((file) => form.append("files", file));
    const response = translate(await call(() => api.post("/api/provided-documents", form, { ...PATIENT_CALL, headers: { "Content-Type": "multipart/form-data" } })));
    return response.success ? { ...response, message: `Đã gửi "${response.data.documentName}" cho bác sĩ.` } : response;
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

import { BOOKING_ERROR_CODE } from "../utils/messages";
import { normalizeText } from "../utils/format";
import { REFUND_REQUEST_STATUSES, normalizeInvoiceList, normalizeRefundList } from "../utils/refundRequest";
import api from "./api";
import { call } from "./receptionService";

// Manager side of refunds (api/refund-requests). The receptionist or the patient sends a request; the manager enters the
// work already done and approves (amount = paid - work done), then the receptionist pays it out (status Processed).
// Patient side: api/refund-requests/my.

export const REFUND_REQUEST_PAGE_SIZE = 5;

export const REFUND_REQUESTS_CHANGED_EVENT = "app:refund-requests-changed";

const statusFromApi = {
    Pending: REFUND_REQUEST_STATUSES.PENDING,
    Approved: REFUND_REQUEST_STATUSES.APPROVED,
    Processed: REFUND_REQUEST_STATUSES.REFUNDED,
    Rejected: REFUND_REQUEST_STATUSES.REJECTED,
};
const statusToApi = Object.fromEntries(Object.entries(statusFromApi).map(([backend, page]) => [page, backend]));

// Texts of ErrorConstants.RefundMessage that the manager page can get.
const MESSAGES = {
    "Refund request not found.": "Không tìm thấy yêu cầu hoàn tiền.",
    "Work-done amount is required before approval.": "Vui lòng nhập giá trị phần việc đã làm trước khi duyệt.",
    "Work-done amount is invalid.": "Giá trị phần việc đã làm không hợp lệ.",
    "Work-done amount cannot exceed confirmed paid amount.": "Giá trị phần việc đã làm phải nhỏ hơn số tiền đã thanh toán.",
    "Only pending refund requests can be processed.": "Yêu cầu này đã được xử lý trước đó.",
    "Please enter a rejection reason.": "Vui lòng nhập lý do từ chối.",
    "Refund request has been approved.": "Đã duyệt. Lễ tân sẽ chi tiền cho bệnh nhân.",
    "Refund request has been rejected.": "Đã từ chối yêu cầu hoàn tiền.",
    "Work-done amount has been updated.": "Đã lưu giá trị phần việc đã làm.",
    "Refund request was modified by another user. Please reload and try again.": "Yêu cầu vừa được người khác cập nhật. Vui lòng tải lại trang.",
};

const withMessage = (result) => ({ ...result, message: MESSAGES[result.message] ?? result.message });

// paidAmount: what the patient paid on the invoice. workDoneAmount: value of the work already done (entered by the
// manager, null until then). refundAmount: what is paid back = paid - work done; the backend fixes it on approval.
const toRequest = (item) => {
    const status = statusFromApi[item.status] ?? REFUND_REQUEST_STATUSES.PENDING;
    const workDoneAmount = item.workDoneAmount == null ? null : Number(item.workDoneAmount);
    const decided = status === REFUND_REQUEST_STATUSES.APPROVED || status === REFUND_REQUEST_STATUSES.REFUNDED;
    const paidAmount = decided ? Number(item.amount) + (workDoneAmount ?? 0) : Number(item.invoicePaidAmount ?? item.amount);
    return {
        id: item.id,
        code: `RF${String(item.id).padStart(6, "0")}`,
        patientName: item.patientName ?? "",
        patientCode: item.patientCode ?? "",
        requestedByName: item.requestedByName ?? "Lễ tân",
        createdAt: item.createdAt,
        processedAt: item.processedAt ?? item.approvedAt ?? null,
        invoiceNumber: item.invoiceNumber ?? "",
        serviceNames: item.serviceNames ?? "—",
        paidAmount,
        workDoneAmount,
        refundAmount: decided ? Number(item.amount) : workDoneAmount == null ? null : paidAmount - workDoneAmount,
        reason: item.reason,
        status,
        rejectReason: item.rejectionReason,
    };
};

// Waiting requests first, then the latest.
const byPendingThenDate = (a, b) => {
    const pendingOrder = Number(b.status === REFUND_REQUEST_STATUSES.PENDING) - Number(a.status === REFUND_REQUEST_STATUSES.PENDING);
    return pendingOrder || b.createdAt.localeCompare(a.createdAt);
};

const loadAll = async (status) => {
    const result = await call(() => api.get("/api/refund-requests", { params: { status: statusToApi[status] } }));
    return result.success ? { ...result, data: result.data.map(toRequest).sort(byPendingThenDate) } : withMessage(result);
};

// Search by the patient's name or code, or the invoice number (the list is small, filtered here)
export const getRefundRequests = async ({ page = 1, pageSize = REFUND_REQUEST_PAGE_SIZE, keyword = "", status = "" } = {}) => {
    const result = await loadAll(status);
    if (!result.success) return result;
    const search = normalizeText(keyword);
    const filtered = result.data.filter(
        (r) => !search || [r.patientName, r.patientCode, r.invoiceNumber].some((text) => normalizeText(text).includes(search)),
    );
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * pageSize;
    return { ...result, data: { items: filtered.slice(start, start + pageSize), page: currentPage, pageSize, totalItems, totalPages } };
};

export const getRefundRequest = async (id) => {
    const result = await loadAll("");
    if (!result.success) return result;
    const request = result.data.find((r) => r.id === id);
    return request ? { ...result, data: request } : { success: false, message: "Không tìm thấy yêu cầu hoàn tiền.", data: null, errors: null };
};

// For the dashboard and the sidebar badge.
export const pendingRefundRequests = async () => {
    const result = await loadAll(REFUND_REQUEST_STATUSES.PENDING);
    return result.success ? result.data : [];
};

const notifyChanged = () => {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new CustomEvent(REFUND_REQUESTS_CHANGED_EVENT));
};

// Approving pays the money back at once (backend status Processed). The backend needs the work-done value first,
// so it is saved before the approval when it is new or changed (0 = nothing done, the whole payment goes back).
export const confirmRefundRequest = async ({ id, workDoneAmount, savedWorkDoneAmount = null }) => {
    if (workDoneAmount !== savedWorkDoneAmount) {
        const saved = await call(() => api.put(`/api/refund-requests/${id}/work-done`, { workDoneAmount }));
        if (!saved.success) return withMessage(saved);
    }
    const result = await call(() => api.post(`/api/refund-requests/${id}/approve`));
    if (result.success) notifyChanged();
    return withMessage(result);
};

export const rejectRefundRequest = async ({ id, reason }) => {
    const result = await call(() => api.post(`/api/refund-requests/${id}/reject`, { rejectionReason: reason }));
    if (result.success) notifyChanged();
    return withMessage(result);
};

const READ = { skipErrorPage: true };
const NOT_FOUND = 404;

const abortError = () => new DOMException("Aborted", "AbortError");

const patientFailure = (result, code = null) => ({
    success: false,
    message: null,
    data: null,
    code: result.status === NOT_FOUND && !code ? BOOKING_ERROR_CODE.PROFILE_NOT_FOUND : code,
    errors: null,
});

// Texts of ErrorConstants.RefundMessage a patient can get when sending
const CREATE_ERRORS = {
    "A pending refund request already exists for this invoice.": "OPEN_REQUEST_EXISTS",
    "Invoice not found.": "INVOICE_NOT_FOUND",
    "Refunds cannot be requested on this invoice.": "INVOICE_NOT_ELIGIBLE",
    "There are no confirmed payments to refund.": "INVOICE_NOT_ELIGIBLE",
    "Please enter a reason.": "REASON_REQUIRED",
};

export const refundCreateErrorCode = (result) => {
    const fieldError = Object.keys(result?.fieldErrors ?? {}).some((key) => key.toLowerCase() === "reason");
    return CREATE_ERRORS[result?.message] ?? (fieldError ? "REASON_REQUIRED" : null);
};

export const getMyRefundRequests = async ({ signal } = {}) => {
    const result = await call(() => api.get("/api/refund-requests/my", { ...READ, signal }));
    if (signal?.aborted) throw abortError();
    if (!result.success) return patientFailure(result);
    const items = normalizeRefundList(result.data) ?? [];
    return { success: true, message: null, code: null, errors: null, data: { items, totalItems: items.length } };
};

export const getMyRefundableInvoices = async ({ signal } = {}) => {
    const result = await call(() => api.get("/api/refund-requests/my/refundable-invoices", { ...READ, signal }));
    if (signal?.aborted) throw abortError();
    if (!result.success) return patientFailure(result);
    return { success: true, message: null, code: null, errors: null, data: normalizeInvoiceList(result.data) ?? [] };
};

export const createMyRefundRequest = async ({ invoiceId, reason }, { signal } = {}) => {
    const result = await call(() => api.post("/api/refund-requests/my", { invoiceId, reason }, { ...READ, signal }));
    if (signal?.aborted) throw abortError();
    if (!result.success) {
        return patientFailure(result, refundCreateErrorCode(result));
    }
    const [created] = normalizeRefundList([result.data]) ?? [];
    if (created) notifyChanged();
    return { success: true, message: null, code: null, errors: null, data: created ?? null };
};

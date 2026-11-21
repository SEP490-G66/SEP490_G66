import api from "./api";
import { call } from "./receptionService";
import { getMyAppointments } from "./appointmentService";
import { BOOKING_ERROR_CODE } from "../utils/messages";
import { toDashboardPlans, toMedicalRecord } from "../utils/medicalBook";

const READ = { skipErrorPage: true };

const NOT_FOUND = 404;

const success = (data) => ({ success: true, message: null, data, code: null });

const failure = (code = null) => ({ success: false, message: null, data: null, code });

const abortError = () => new DOMException("Aborted", "AbortError");

const loadBook = (signal) => call(() => api.get("/api/medical-records/my", { ...READ, signal }));

const failed = (result) => failure(result.status === NOT_FOUND ? BOOKING_ERROR_CODE.PROFILE_NOT_FOUND : null);

const loadInvoices = async (signal) => {
    const result = await call(() => api.get("/api/invoices/my/details", { ...READ, signal }));
    return result.success && Array.isArray(result.data) ? result.data : [];
};

const loadAppointments = async (signal) => {
    try {
        const result = await getMyAppointments({ signal });
        return result?.success && Array.isArray(result.data) ? result.data : [];
    } catch {
        return [];
    }
};

export const getMyMedicalBook = async ({ signal } = {}) => {
    const [book, invoices, appointments] = await Promise.all([loadBook(signal), loadInvoices(signal), loadAppointments(signal)]);
    if (signal?.aborted) throw abortError();
    if (!book.success || !book.data) return failed(book);
    return success(toMedicalRecord(book.data, { invoices, appointments }));
};

export const getMyTreatmentPlans = async ({ signal } = {}) => {
    const book = await loadBook(signal);
    if (signal?.aborted) throw abortError();
    if (!book.success || !book.data) return failed(book);
    return success(toDashboardPlans(book.data));
};

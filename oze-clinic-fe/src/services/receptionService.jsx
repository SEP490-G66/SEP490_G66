import axios from "axios";
import api from "./api";
import { APPOINTMENT_ERROR_TEXT, BILLING_TEXT } from "@/utils/messages";

// Receptionist workspace calls to oze-clinic-be. Every call returns the ApiResponse body
// ({ success, message, data, errors }); a business error from the server comes back as success: false.

// Clinic date (Asia/Ho_Chi_Minh) as "yyyy-mm-dd", the same day the backend uses for ClinicClock.Today
export const clinicToday = (offsetDays = 0) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" })
        .format(new Date(Date.now() + offsetDays * 86_400_000));
    return parts;
};

export const appointmentErrorText = (result, fallback) => {
    const message = String(result?.message ?? "").toLowerCase();
    const hit = APPOINTMENT_ERROR_TEXT.find(([key]) => message.includes(key));
    return hit ? hit[1] : (fallback ?? result?.message);
};

export const PRIORITY = { NORMAL: 0, HIGH: 1, URGENT: 2 };

const REFRESH_TOKEN_URL = "/api/Auth/refresh-token";

// Shared by the other staff services so every call returns the same ApiResponse shape
export const call = async (request) => {
    try {
        const response = await request();
        return response.data;
    } catch (error) {
        const aborted = axios.isCancel(error);
        const refreshFailed = !aborted && error.config?.url === REFRESH_TOKEN_URL;
        const status = refreshFailed ? 401 : (error.response?.status ?? null);
        const noResponse = !aborted && !refreshFailed && !error.response;
        const body = error.response?.data;
        const fieldErrors = body?.errors && typeof body.errors === "object" && !Array.isArray(body.errors) ? body.errors : null;
        if (body && typeof body.success === "boolean") return { ...body, status, aborted, noResponse, fieldErrors };
        // Validation errors of [ApiController] (ProblemDetails) or no response at all
        const firstError = body?.errors && Object.values(body.errors).flat()[0];
        return {
            success: false,
            message: firstError ?? (error.response ? "Yêu cầu không hợp lệ." : "Không kết nối được máy chủ. Kiểm tra backend đang chạy."),
            data: null,
            errors: null,
            status,
            aborted,
            noResponse,
            fieldErrors,
        };
    }
};

// ----- appointments (M3, M4) -----
const TODAY_PAGE_LIMIT = 20;

export const getTodayAppointments = async (config = {}) => {
    const items = [];
    for (let page = 1; page <= TODAY_PAGE_LIMIT; page += 1) {
        const result = await call(() => api.get("/api/appointments", { ...config, params: { date: clinicToday(), pageNumber: page, pageSize: 100 } }));
        if (!result.success) return result;
        items.push(...(result.data?.items ?? []));
        if (page >= Number(result.data?.totalPages ?? 1)) return { ...result, data: { ...result.data, items } };
    }
    return { success: true, data: { items } };
};

export const confirmAppointment = (id) => call(() => api.post(`/api/appointments/${id}/confirm`));

export const checkInAppointment = (id, { doctorId } = {}) => call(() => api.post(`/api/appointments/${id}/check-in`, { doctorId: doctorId || null }));

export const cancelAppointment = (id, reason) => call(() => api.post(`/api/appointments/${id}/cancel`, { reason }));

export const markNoShow = (id, reason) => call(() => api.post(`/api/appointments/${id}/no-show`, { reason: reason || null }));

export const createWalkIn = async (request, config = {}) => {
    const result = await call(() => api.post("/api/appointments/walk-in", request, config));
    return result.success ? result : { ...result, message: appointmentErrorText(result) };
};

export const findPatientsByKeyword = (keyword) =>
    call(() => api.get("/api/patients", { params: { searchKeyword: keyword, pageSize: 5 } }));

// Records are stored as +84…, 84… or 0…; the 9 subscriber digits match all of them (the caller re-checks the phone)
export const findPatientsByPhone = (subscriber, config = {}) =>
    call(() => api.get("/api/patients", { ...config, params: { searchKeyword: subscriber, pageSize: 20 } }));

// ----- queue (M4) -----
export const getWaitingList = (config = {}) => call(() => api.get("/api/appointments/waiting-list", config));

export const setPriority = (id, { priority, reason }) =>
    call(() => api.post(`/api/appointments/${id}/priority`, { priority, reason: reason || null }));

// reason is required: it goes into the notification the patient receives
export const reassignDoctor = (id, doctorId, reason) => call(() => api.post(`/api/appointments/${id}/reassign-doctor`, { doctorId, reason }));

// ----- cashier (M8) -----
export const getInvoices = () => call(() => api.get("/api/invoices", { params: { pageSize: 50, sortBy: "createdAt", sortDescending: true } }));

// ----- follow-up (M9, receptionist only) -----
export const getFollowUps = () =>
    call(() => api.get("/api/examinations/follow-ups", { params: { fromDate: clinicToday(), toDate: clinicToday(3), pageSize: 50 } }));

export const remindFollowUp = (examinationId) => call(() => api.post(`/api/examinations/${examinationId}/remind-follow-up`));

export const remindDueFollowUps = () => call(() => api.post("/api/examinations/follow-ups/remind-due"));

// ----- reports -----
// Confirmed collections per clinic day, cash vs transfer (at most 31 days)
export const getRevenueByDay = ({ from, to }, config = {}) => call(() => api.get("/api/invoice-reports/revenue-by-day", { ...config, params: { from, to } }));

// ----- doctors on duty -----
// Doctors with a shift today: room, time and status (NotStarted, Working, Ended, OnLeave)
export const getDoctorsOnDuty = (date = clinicToday(), config = {}) =>
    call(() => api.get("/api/schedules/doctors-on-duty", { ...config, params: { date } }));

// ----- lists for the receptionist pages -----
// Appointments of a date range (or one date), newest filters on the server; pageSize up to 100
export const getAppointments = ({ fromDate, toDate, date, doctorId, patientId, status, keyword, page, pageSize = 100 } = {}, config = {}) =>
    call(() =>
        api.get("/api/appointments", {
            ...config,
            params: {
                fromDate,
                toDate,
                date,
                doctorId: doctorId || undefined,
                patientId: patientId || undefined,
                status: status || undefined,
                searchKeyword: keyword || undefined,
                pageNumber: page,
                pageSize,
            },
        }),
    );

const RANGE_PAGE_LIMIT = 20;

export const getAppointmentsInRange = async ({ fromDate, toDate, doctorId } = {}, config = {}) => {
    const items = [];
    for (let page = 1; page <= RANGE_PAGE_LIMIT; page += 1) {
        const result = await getAppointments({ fromDate, toDate, doctorId, page, pageSize: 100 }, config);
        if (!result.success) return result;
        items.push(...(result.data?.items ?? []));
        if (page >= Number(result.data?.totalPages ?? 1)) break;
    }
    return { success: true, items };
};

export const getInvoice = (id, config = {}) => call(() => api.get(`/api/invoices/${id}`, config));

export const getCashierRefunds = ({ status } = {}, config = {}) => call(() => api.get("/api/refund-requests", { ...config, params: { status: status || undefined } }));

export const payoutRefund = (id) => call(() => api.post(`/api/refund-requests/${id}/payout`));

// Free slots of one doctor on a day for the services of the appointment (ASP.NET reads repeated keys as a list)
export const getAvailableSlots = ({ date, doctorId, serviceIds = [], variantIds = [] }, config = {}) => {
    const params = new URLSearchParams({ Date: date });
    if (doctorId) params.append("DoctorId", doctorId);
    serviceIds.forEach((id) => params.append("ServiceId", id));
    variantIds.forEach((id) => params.append("VariantId", id));
    return call(() => api.get(`/api/appointments/available-slots?${params}`, config));
};

export const rescheduleAppointment = (id, { date, slotStart, doctorId, reason }) =>
    call(() => api.post(`/api/appointments/${id}/reschedule`, { date, slotStart, doctorId: doctorId || null, reason: reason || null }));

export const getPaidInvoices = async () => {
    const results = await Promise.all(
        ["PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED"].map((paymentStatus) =>
            call(() => api.get("/api/invoices", { params: { paymentStatus, pageSize: 100, sortBy: "createdAt", sortDescending: true } })),
        ),
    );
    const failed = results.find((r) => !r.success);
    if (failed) return failed;
    return { success: true, message: null, errors: null, data: { items: results.flatMap((r) => r.data.items) } };
};

// The refund amount is worked out by the system (paid minus work done); the manager approves it
export const requestRefund = (invoiceId, reason, patientId, config = {}) =>
    call(() => api.post(`/api/invoices/${invoiceId}/refund-requests`, { reason, patientId }, config));

export const patientRefundableInvoicesUrl = (patientId) => `/api/refund-requests/patients/${patientId}/refundable-invoices`;

export const getPatientRefundableInvoices = (patientId, config = {}) => call(() => api.get(patientRefundableInvoicesUrl(patientId), config));

// ----- patient debts and payment reminders -----
export const getDebts = ({ keyword, overdueOnly, ageBucket, page = 1, pageSize = 10 } = {}, config = {}) =>
    call(() =>
        api.get("/api/debts", {
            ...config,
            params: { searchKeyword: keyword || undefined, overdueOnly: overdueOnly || undefined, ageBucket: ageBucket || undefined, pageNumber: page, pageSize },
        }),
    );

export const remindPayment = (invoiceId, force = false) => call(() => api.post(`/api/debts/${invoiceId}/remind`, { force }));

export const getPaymentReminders = (invoiceId) => call(() => api.get(`/api/debts/${invoiceId}/reminders`));

// ----- follow-up care -----
export const getFollowUpList = ({ fromDate, toDate, hasAppointment, keyword, doctorId, state, page, pageSize = 100 }, config = {}) =>
    call(() =>
        api.get("/api/examinations/follow-ups", {
            ...config,
            params: {
                fromDate,
                toDate,
                hasAppointment,
                searchKeyword: keyword || undefined,
                doctorId: doctorId || undefined,
                state: state || undefined,
                pageNumber: page,
                pageSize,
            },
        }),
    );

export const recordFollowUpContact = (examinationId, { outcome, note, callBackDate, callBackTime }, config = {}) =>
    call(() =>
        api.post(
            `/api/examinations/${examinationId}/follow-up/contacts`,
            { outcome, note: note || null, callBackDate: callBackDate || null, callBackTime: callBackTime || undefined },
            config,
        ),
    );

export const getFollowUpContacts = (examinationId) => call(() => api.get(`/api/examinations/${examinationId}/follow-up/contacts`));

export const scheduleFollowUpAppointment = (examinationId, { date, slotStart, doctorId }, config = {}) =>
    call(() => api.post(`/api/examinations/${examinationId}/follow-up/schedule`, { date, slotStart, doctorId: doctorId || null }, config));

export const getDoctorOptions = (config = {}) => call(() => api.get("/api/doctors", { ...config, params: { pageSize: 100 } }));

// ----- booking on behalf (F-APT-09) -----
export const getBookableServices = (config = {}) => call(() => api.get("/api/appointments/bookable-services", config));

// patientId for a known record, or fullName + phoneNumber (+ email) for a new one; confirmed at once
export const bookForPatient = (request, config = {}) => call(() => api.post("/api/appointments/reception-booking", request, config));

// ----- patient records -----
export const getPatients = ({ keyword, gender, sortBy, sortDescending, page = 1, pageSize = 10 } = {}, config = {}) =>
    call(() =>
        api.get("/api/patients", {
            ...config,
            params: { searchKeyword: keyword || undefined, gender: gender || undefined, sortBy, sortDescending, pageNumber: page, pageSize },
        }),
    );

export const getPatient = (id, config = {}) => call(() => api.get(`/api/patients/${id}`, config));

export const createPatient = (request, config = {}) => call(() => api.post("/api/patients", request, config));

export const updatePatient = (id, request, config = {}) => call(() => api.put(`/api/patients/${id}`, request, config));

export const addMedicalProfile = (patientId, request, config = {}) =>
    call(() => api.post(`/api/patients/${patientId}/medical-profiles`, request, config));

export const getPatientAppointments = (patientId, query = { pageSize: 50, sortBy: "appointmentDate", sortDescending: true }, config = {}) =>
    call(() => api.get("/api/appointments", { ...config, params: { patientId, ...query } }));

export const getPatientInvoices = (patientId, query = { pageSize: 50 }, config = {}) =>
    call(() => api.get("/api/invoices", { ...config, params: { patientId, ...query } }));

export const getPatientTreatmentPlans = (patientId, query = {}, config = {}) =>
    call(() => api.get(`/api/patients/${patientId}/treatment-plans`, { ...config, params: query }));

// ----- consultation requests from the public site -----
export const getConsultations = ({ status, keyword, page = 1, pageSize = 10 } = {}) =>
    call(() => api.get("/api/consultation-requests", { params: { status: status || undefined, searchKeyword: keyword || undefined, pageNumber: page, pageSize } }));

export const handleConsultation = (id, { status, note }) => call(() => api.post(`/api/consultation-requests/${id}/handle`, { status, note: note || null }));

// ----- invoice list and payment history (search by day) -----
export const searchInvoices = async ({ keyword, status, collection, fromDate, toDate, page = 1, pageSize = 15 } = {}, config = {}) => {
    const result = await call(() =>
        api.get("/api/invoices", {
            ...config,
            params: {
                searchKeyword: keyword || undefined,
                paymentStatus: status || undefined,
                collection: collection || undefined,
                fromDate: fromDate || undefined,
                toDate: toDate || undefined,
                pageNumber: page,
                pageSize,
                sortBy: "createdAt",
                sortDescending: true,
            },
        }),
    );
    if (!result.success && String(result.message ?? "").startsWith("Collection must be")) return { ...result, message: BILLING_TEXT.COLLECTION_INVALID };
    return result;
};

export const getPaymentHistory = ({ keyword, method, status, fromDate, toDate, page = 1, pageSize = 15 } = {}) =>
    call(() =>
        api.get("/api/payment-history", {
            params: {
                searchKeyword: keyword || undefined,
                paymentMethod: method || undefined,
                paymentStatus: status || undefined,
                fromDate: fromDate || undefined,
                toDate: toDate || undefined,
                pageNumber: page,
                pageSize,
            },
        }),
    );

// Active entries of every room queue (Examination, Imaging, Treatment): WAITING, CALLED, IN_PROGRESS
export const getQueueEntries = (queueType, config = {}) => call(() => api.get("/api/queues", { ...config, params: { queueType: queueType || undefined } }));

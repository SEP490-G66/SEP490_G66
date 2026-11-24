import { generatePath } from "react-router-dom";
import { USER_ROLES } from "./messages";

export const ROUTES = {
    HOME: "/",
    SIGN_IN: "/login",
    REGISTER: "/register",
    ABOUT_US: "/about-us",
    FORGOT_PASSWORD: "/forgot-password",
    VERIFY_OTP: "/verify-otp",
    RESET_PASSWORD: "/reset-password",
    SERVICES: "/services",
    SERVICE_DETAIL: "/services/:serviceSlug",
    DOCTORS: "/doctors",
    SEARCH: "/search",
    ARTICLE_DETAIL: "/articles/:articleSlug",
    CONTACT: "/contact",
    PRIVACY_POLICY: "/chinh-sach-bao-mat",
    TERMS_OF_USE: "/dieu-khoan-su-dung",
    BOOK_APPOINTMENT: "/book-appointment",
    PROFILE: "/profile",
    PROFILE_VERIFY_OTP: "/profile/verify-otp",
    CHANGE_PASSWORD: "/change-password",
    DASHBOARD: "/dashboard",
    APPOINTMENTS: "/appointments",
    MEDICAL_RECORD: "/medical-history",
    APPOINTMENT_DETAIL: "/appointments/:appointmentId",
    MEDICAL_RECORD_DETAIL: "/medical-history/:examinationId",
    TREATMENT_PLANS: "/treatment-plans",
    DOCUMENTS: "/documents",
    PAYMENT_DEBTS: "/payments/debts",
    PAYMENT_HISTORY: "/payments/history",
    REFUND_REQUESTS: "/payments/refunds",
    // Staff pages use a prefix per role so they never clash with the patient pages above.
    // Shared by doctors, receptionists and imaging technicians (pages/common/WorkSchedule).
    WORK_SCHEDULE: "/common/work-schedule",
    DOCTOR_APPOINTMENTS: "/doctor/appointments",
    DOCTOR_PATIENTS: "/doctor/patients",
    DOCTOR_TREATMENT_PLANS: "/doctor/treatment-plans",
    DOCTOR_IMAGING_REQUESTS: "/doctor/imaging-requests",
    DOCTOR_EXAMINATION: "/doctor/examination",
    DOCTOR_IMAGING_REVIEWS: "/doctor/imaging-reviews",
    TECHNICIAN_IMAGING_REQUESTS: "/technician/imaging-requests",
    TECHNICIAN_IMAGING_RESULTS: "/technician/imaging-results",
    RECEPTION_APPOINTMENTS: "/reception/appointments",
    RECEPTION_CHECK_IN: "/reception/check-in",
    RECEPTION_SCHEDULE: "/reception/schedule",
    RECEPTION_PATIENTS: "/reception/patients",
    RECEPTION_CONSULTATIONS: "/reception/consultations",
    RECEPTION_INVOICES: "/reception/invoices",
    RECEPTION_CASH_HANDOVER: "/reception/cash-handover",
    RECEPTION_QUEUE: "/reception/queue",
    RECEPTION_FOLLOW_UPS: "/reception/follow-ups",
    RECEPTION_DEBTS: "/reception/debts",
    RECEPTION_INVOICE_LIST: "/reception/invoice-list",
    ADMIN_STAFF: "/admin/staff",
    ADMIN_ROLES: "/admin/roles",
    ADMIN_ROOMS: "/admin/rooms",
    ADMIN_SERVICES: "/admin/services",
    ADMIN_WORK_SHIFTS: "/admin/work-shifts",
    ADMIN_LEAVE_REQUESTS: "/admin/leave-requests",
    ADMIN_REFUNDS: "/admin/refunds",
    ADMIN_DEBTS: "/admin/debts",
    ADMIN_RECONCILIATION: "/admin/reconciliation",
    ADMIN_SYSTEM_LOGS: "/admin/system-logs",
    ADMIN_SETTINGS: "/admin/settings",
    ERROR: "/error/:code",
};

// Pages only some roles may open.
export const ROLE_ROUTES = [
    {
        roles: [USER_ROLES.PATIENT],
        paths: [ROUTES.APPOINTMENTS, ROUTES.BOOK_APPOINTMENT, ROUTES.MEDICAL_RECORD, ROUTES.TREATMENT_PLANS, ROUTES.DOCUMENTS, ROUTES.PAYMENT_DEBTS, ROUTES.PAYMENT_HISTORY, ROUTES.REFUND_REQUESTS]
    },
    {
        roles: [USER_ROLES.DOCTOR],
        paths: [
            ROUTES.DOCTOR_EXAMINATION,
            ROUTES.DOCTOR_IMAGING_REVIEWS,
            ROUTES.DOCTOR_APPOINTMENTS,
            ROUTES.DOCTOR_PATIENTS,
            ROUTES.DOCTOR_TREATMENT_PLANS,
            ROUTES.DOCTOR_IMAGING_REQUESTS,
        ]
    },
    {
        roles: [USER_ROLES.DENTAL_IMAGING_TECHNICIAN],
        paths: [ROUTES.TECHNICIAN_IMAGING_REQUESTS, ROUTES.TECHNICIAN_IMAGING_RESULTS]
    },
    {
        roles: [USER_ROLES.RECEPTIONIST],
        paths: [ROUTES.RECEPTION_SCHEDULE, ROUTES.RECEPTION_APPOINTMENTS, ROUTES.RECEPTION_CHECK_IN, ROUTES.RECEPTION_PATIENTS, ROUTES.RECEPTION_CONSULTATIONS, ROUTES.RECEPTION_INVOICES, ROUTES.RECEPTION_CASH_HANDOVER, ROUTES.RECEPTION_QUEUE, ROUTES.RECEPTION_FOLLOW_UPS, ROUTES.RECEPTION_DEBTS, ROUTES.RECEPTION_INVOICE_LIST]
    },
    {
        roles: [USER_ROLES.CLINIC_MANAGER],
        paths: [
            ROUTES.ADMIN_STAFF,
            ROUTES.ADMIN_ROLES,
            ROUTES.ADMIN_WORK_SHIFTS,
            ROUTES.ADMIN_LEAVE_REQUESTS,
            ROUTES.ADMIN_RECONCILIATION,
            ROUTES.ADMIN_ROOMS,
            ROUTES.ADMIN_SERVICES,
            ROUTES.ADMIN_REFUNDS,
            ROUTES.ADMIN_DEBTS,
            ROUTES.ADMIN_SYSTEM_LOGS,
            ROUTES.ADMIN_SETTINGS,
        ]
    },
    {
        roles: [USER_ROLES.DOCTOR, USER_ROLES.DENTAL_IMAGING_TECHNICIAN, USER_ROLES.RECEPTIONIST],
        paths: [ROUTES.WORK_SCHEDULE]
    }
];

// slug of a public service, e.g. "nieng-rang" (utils/data/publicServices.jsx)
export const getServiceDetailRoute = (serviceSlug) => generatePath(ROUTES.SERVICE_DETAIL, { serviceSlug });

export const getServiceSearchRoute = (keyword) => (keyword ? `${ROUTES.SERVICES}?q=${encodeURIComponent(keyword)}` : ROUTES.SERVICES);

export const getDoctorSearchRoute = (keyword) => (keyword ? `${ROUTES.DOCTORS}?q=${encodeURIComponent(keyword)}` : ROUTES.DOCTORS);

// Header search: services and doctors together
export const getSearchRoute = (keyword) => `${ROUTES.SEARCH}?q=${encodeURIComponent(keyword)}`;

export const getArticleDetailRoute = (articleSlug) => generatePath(ROUTES.ARTICLE_DETAIL, { articleSlug });

export const getAppointmentDetailRoute = (appointmentId) => generatePath(ROUTES.APPOINTMENT_DETAIL, { appointmentId: String(appointmentId) });

export const getTreatmentPlanRoute = (planId) => (planId != null ? `${ROUTES.TREATMENT_PLANS}/${planId}` : ROUTES.TREATMENT_PLANS);

export const getPaymentHistoryRoute = (invoiceId) => `${ROUTES.PAYMENT_HISTORY}/${invoiceId}`;

export const getPaymentDebtDetailRoute = (debtId) => `${ROUTES.PAYMENT_DEBTS}/${debtId}`;

export const getMedicalRecordDetailRoute = (examinationId) => generatePath(ROUTES.MEDICAL_RECORD_DETAIL, { examinationId: String(examinationId) });

export const getErrorRoute = (code) => generatePath(ROUTES.ERROR, { code: String(code) });

// The technician has no overview page and starts on the imaging queue.
export const getPostLoginRoute = (role) => {
    if (role === USER_ROLES.PATIENT) return ROUTES.HOME;
    if (role === USER_ROLES.DENTAL_IMAGING_TECHNICIAN) return ROUTES.TECHNICIAN_IMAGING_REQUESTS;
    return ROUTES.DASHBOARD;
};

const RECEPTION_CASH_HANDOVER_DETAIL = `${ROUTES.RECEPTION_CASH_HANDOVER}/:sessionId`;

export const getCashHandoverRoute = (sessionId) => generatePath(RECEPTION_CASH_HANDOVER_DETAIL, { sessionId: String(sessionId) });

export const RECEPTION_PATIENT_CREATE_ROUTE = `${ROUTES.RECEPTION_PATIENTS}/new`;

const RECEPTION_PATIENT_DETAIL = `${ROUTES.RECEPTION_PATIENTS}/:patientId`;

const RECEPTION_PATIENT_EDIT = `${ROUTES.RECEPTION_PATIENTS}/:patientId/edit`;

export const RECEPTION_PATIENT_QUERY = { SEARCH: "q", GENDER: "f_gender", SORT: "sort", PAGE: "page", TAB: "tab" };

export const RECEPTION_PATIENT_TABS = { INFO: "info", APPOINTMENTS: "appointments", PLANS: "plans", INVOICES: "invoices" };

export const getReceptionPatientRoute = (patientId, tab) => {
    const path = generatePath(RECEPTION_PATIENT_DETAIL, { patientId: String(patientId) });
    if (!tab || tab === RECEPTION_PATIENT_TABS.INFO) return path;
    return `${path}?${new URLSearchParams({ [RECEPTION_PATIENT_QUERY.TAB]: tab })}`;
};

export const getReceptionPatientEditRoute = (patientId) => generatePath(RECEPTION_PATIENT_EDIT, { patientId: String(patientId) });

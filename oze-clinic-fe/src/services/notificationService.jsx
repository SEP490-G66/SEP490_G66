import { generatePath } from "react-router-dom";
import api from "./api";
import { call } from "./receptionService";
import { getSessionRole } from "./sessionStore";
import { USER_ROLES } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";

// In-app notifications of the signed-in user, every role (NotificationsController: api/notifications).
// Every call returns the ApiResponse shape ({ success, message, data, errors }).

export const NOTIFICATION_PAGE_SIZE = 20;

const { PATIENT, DOCTOR, DENTAL_IMAGING_TECHNICIAN, RECEPTIONIST, CLINIC_MANAGER } = USER_ROLES;

// Page to open for a notification, by the backend's ReferenceType (NotificationConstants.Reference) and the user's role.
// A function gets the ReferenceId. Missing: the header says the content cannot be opened.
const REFERENCE_PAGES = {
    Appointment: {
        [PATIENT]: (id) => generatePath(ROUTES.APPOINTMENT_DETAIL, { appointmentId: id }),
        [DOCTOR]: ROUTES.DOCTOR_APPOINTMENTS,
        [RECEPTIONIST]: ROUTES.RECEPTION_APPOINTMENTS,
    },
    ImagingRequest: {
        [DENTAL_IMAGING_TECHNICIAN]: ROUTES.TECHNICIAN_IMAGING_REQUESTS,
        [DOCTOR]: ROUTES.DOCTOR_IMAGING_REQUESTS,
    },
    Examination: {
        [PATIENT]: (id) => generatePath(ROUTES.MEDICAL_RECORD_DETAIL, { examinationId: id }),
        [DOCTOR]: ROUTES.DOCTOR_IMAGING_REVIEWS,
    },
    TreatmentPlan: {
        [PATIENT]: ROUTES.MEDICAL_RECORD,
        [DOCTOR]: ROUTES.DOCTOR_TREATMENT_PLANS,
    },
    Invoice: {
        [PATIENT]: ROUTES.PAYMENT_DEBTS,
        [RECEPTIONIST]: ROUTES.RECEPTION_INVOICE_LIST,
    },
    Payment: {
        [PATIENT]: ROUTES.PAYMENT_HISTORY,
        [RECEPTIONIST]: ROUTES.RECEPTION_INVOICE_LIST,
    },
    RefundRequest: {
        [PATIENT]: ROUTES.REFUND_REQUESTS,
        [CLINIC_MANAGER]: ROUTES.ADMIN_REFUNDS,
    },
    LeaveRequest: {
        [DOCTOR]: ROUTES.WORK_SCHEDULE,
        [DENTAL_IMAGING_TECHNICIAN]: ROUTES.WORK_SCHEDULE,
        [RECEPTIONIST]: ROUTES.WORK_SCHEDULE,
        [CLINIC_MANAGER]: ROUTES.ADMIN_LEAVE_REQUESTS,
    },
    WorkShift: {
        [DOCTOR]: ROUTES.WORK_SCHEDULE,
        [DENTAL_IMAGING_TECHNICIAN]: ROUTES.WORK_SCHEDULE,
        [RECEPTIONIST]: ROUTES.WORK_SCHEDULE,
        [CLINIC_MANAGER]: ROUTES.ADMIN_WORK_SHIFTS,
    },
    ConsultationRequest: {
        [RECEPTIONIST]: ROUTES.RECEPTION_CONSULTATIONS,
    },
    CashSession: {
        [RECEPTIONIST]: ROUTES.RECEPTION_CASH_HANDOVER,
        [CLINIC_MANAGER]: ROUTES.ADMIN_RECONCILIATION,
    },
};

const relatedPathOf = (referenceType, referenceId) => {
    const page = REFERENCE_PAGES[referenceType]?.[getSessionRole()];
    if (typeof page !== "function") return page ?? null;
    return referenceId ? page(referenceId) : null;
};

// The header reads { id, title, content, createdAt, isRead, relatedPath }.
const toNotification = (item) => ({
    id: item.id,
    title: item.title,
    content: item.message,
    createdAt: item.createdAt,
    isRead: item.isRead,
    relatedPath: relatedPathOf(item.referenceType, item.referenceId),
});

// data: { items, page, pageSize, totalItems, totalPages, unreadCount }
export const getNotifications = async ({ page = 1, pageSize = NOTIFICATION_PAGE_SIZE } = {}) => {
    const response = await call(() => api.get("/api/notifications", { params: { page, pageSize } }));
    if (!response.success) return response;
    const data = response.data ?? {};
    return {
        ...response,
        data: {
            items: (data.items ?? []).map(toNotification),
            page: data.page ?? page,
            pageSize: data.pageSize ?? pageSize,
            totalItems: data.totalItems ?? 0,
            totalPages: Math.max(1, data.totalPages ?? 1),
            unreadCount: data.unreadCount ?? 0,
        },
    };
};

// data: { unreadCount } for the three calls below
export const markNotificationAsRead = (id) => call(() => api.post(`/api/notifications/${id}/read`));

export const markAllNotificationsAsRead = () => call(() => api.post("/api/notifications/read-all"));

export const getUnreadNotificationCount = () => call(() => api.get("/api/notifications/unread-count"));

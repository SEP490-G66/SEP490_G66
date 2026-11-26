import api from "./api";
import { getBookingDays, getBookingSlots } from "./bookingService";
import { call } from "./receptionService";
import { loadCatalog } from "./dentalService";
import { BOOKING_ERROR_CODE } from "../utils/messages";

const READ = { skipErrorPage: true };

const PAGE_SIZE = 100;

const NO_PROFILE = "no patient profile is linked";

export const APPOINTMENT_ACTION_CODE = {
    NOT_ALLOWED: "NOT_ALLOWED",
    SLOT_TAKEN: "SLOT_TAKEN",
    DATE_INVALID: "DATE_INVALID",
    NOT_FOUND: "NOT_FOUND",
    // The patient is in the middle of a treatment plan: a visit outside the plan cannot be moved
    ACTIVE_PLAN: "ACTIVE_PLAN",
    GENERIC: "GENERIC",
};

const ACTION_ERRORS = [
    ["pending or confirmed", APPOINTMENT_ACTION_CODE.NOT_ALLOWED],
    ["already confirmed", APPOINTMENT_ACTION_CODE.NOT_ALLOWED],
    ["too close to the appointment time", APPOINTMENT_ACTION_CODE.NOT_ALLOWED],
    ["no longer available", APPOINTMENT_ACTION_CODE.SLOT_TAKEN],
    ["cannot be in the past", APPOINTMENT_ACTION_CODE.DATE_INVALID],
    ["too far in advance", APPOINTMENT_ACTION_CODE.DATE_INVALID],
    ["undergoing a treatment plan", APPOINTMENT_ACTION_CODE.ACTIVE_PLAN],
];

const success = (data) => ({ success: true, message: null, data, code: null });

const failure = (code = APPOINTMENT_ACTION_CODE.GENERIC) => ({ success: false, message: null, data: null, code });

const messageOf = (result) => String(result?.message ?? "").toLowerCase();

const serviceLabel = (line) => (line.variantName ? `${line.serviceName} · ${line.variantName}` : line.serviceName);

// The general exam is in every appointment, so the patient's screens show only the services the patient picked
const loadMandatoryIds = async () => new Set(((await loadCatalog()) ?? []).filter((service) => service.isMandatory).map((service) => service.serviceId));

const toAppointment = (item, mandatoryIds = new Set()) => {
    const services = (item.services ?? []).map((line) => ({ serviceId: line.serviceId, variantId: line.variantId ?? null, label: serviceLabel(line) }));
    const picked = services.filter((line) => !mandatoryIds.has(line.serviceId));
    // Only the general exam booked: that is what the patient sees
    const shown = picked.length ? picked : services;
    return {
        id: item.id,
        appointmentCode: item.appointmentCode ?? "",
        appointmentDate: item.appointmentDate ?? "",
        timeSlotStart: item.timeSlotStart ?? null,
        timeSlotEnd: item.timeSlotEnd ?? null,
        status: item.status,
        doctorId: item.doctorId ?? null,
        doctorName: item.doctorName ?? "",
        services,
        serviceName: shown.length ? shown.map((line) => line.label).join(", ") : (item.serviceName ?? ""),
        checkInAt: item.checkInAt ?? null,
        roomName: item.roomName ?? "",
        cancellationReason: item.cancellationReason ?? "",
        examinationId: item.examinationId ?? null,
        examinationStatus: item.examinationStatus ?? null,
        queue: Number.isInteger(item.queueNumber) ? { queueNumber: item.queueNumber } : null,
        notes: item.notes ?? "",
        createdAt: item.createdAt ?? null,
        parentAppointmentId: item.parentAppointmentId ?? null,
    };
};

const loadPage = (pageNumber, signal) =>
    call(() => api.get("/api/appointments/my", { ...READ, signal, params: { PageNumber: pageNumber, PageSize: PAGE_SIZE } }));

export const getMyAppointments = async ({ signal } = {}) => {
    const items = [];
    for (let pageNumber = 1; ; pageNumber++) {
        const result = await loadPage(pageNumber, signal);
        if (!result.success) return failure(messageOf(result).includes(NO_PROFILE) ? BOOKING_ERROR_CODE.PROFILE_NOT_FOUND : APPOINTMENT_ACTION_CODE.GENERIC);
        const rows = result.data?.items ?? [];
        items.push(...rows);
        if (!rows.length || items.length >= (result.data?.totalCount ?? 0)) break;
    }
    const mandatoryIds = await loadMandatoryIds();
    return success(items.map((item) => toAppointment(item, mandatoryIds)));
};

const toDetail = async (result) => {
    if (result.success) return success({ appointment: toAppointment(result.data ?? {}, await loadMandatoryIds()) });
    return result.status === 404 ? success(null) : failure();
};

export const getMyAppointmentDetail = async (appointmentId) => toDetail(await call(() => api.get(`/api/appointments/${appointmentId}`, READ)));

const toActionResult = async (result) => {
    if (result.success) return success({ appointment: toAppointment(result.data ?? {}, await loadMandatoryIds()) });
    if (result.status === 404) return failure(APPOINTMENT_ACTION_CODE.NOT_FOUND);
    const message = messageOf(result);
    const known = ACTION_ERRORS.find(([text]) => message.includes(text));
    return failure(known ? known[1] : APPOINTMENT_ACTION_CODE.GENERIC);
};

export const cancelMyAppointment = async (appointmentId, { reason }) =>
    toActionResult(await call(() => api.post(`/api/appointments/${appointmentId}/cancel`, { reason: reason.trim() }, READ)));

// services: { ServiceId, VariantId } when the patient changed them; left out keeps the services of the appointment
export const rescheduleMyAppointment = async (appointmentId, { date, slotStart, doctorId, services }) =>
    toActionResult(
        await call(() =>
            api.post(
                `/api/appointments/${appointmentId}/reschedule`,
                { date, slotStart, doctorId: doctorId ? Number(doctorId) : null, ...(services && { serviceId: services.ServiceId, variantId: services.VariantId }) },
                READ
            )
        )
    );

// The services of an appointment as booking parameters (the general exam is left out by the server)
export const appointmentServiceParams = (appointment) => ({
    ServiceId: [...new Set(appointment.services.filter((line) => line.variantId === null).map((line) => line.serviceId))],
    VariantId: [...new Set(appointment.services.filter((line) => line.variantId !== null).map((line) => line.variantId))],
});

export const getRescheduleSlots = (services, { date, doctorId }) =>
    getBookingSlots({ date, doctorId: doctorId ? Number(doctorId) : null, services });

// Free-slot count per day for the reschedule week view (same data as the booking page).
export const getRescheduleDays = (services, { from, to, doctorId, signal }) =>
    getBookingDays({ from, to, doctorId: doctorId ? Number(doctorId) : null, services, signal });

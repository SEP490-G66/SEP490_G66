import api from "./api";
import { getBookingSlots } from "./bookingService";
import { call } from "./receptionService";
import { BOOKING_ERROR_CODE } from "../utils/messages";

const READ = { skipErrorPage: true };

const PAGE_SIZE = 100;

const NO_PROFILE = "no patient profile is linked";

export const APPOINTMENT_ACTION_CODE = {
    NOT_ALLOWED: "NOT_ALLOWED",
    SLOT_TAKEN: "SLOT_TAKEN",
    DATE_INVALID: "DATE_INVALID",
    NOT_FOUND: "NOT_FOUND",
    GENERIC: "GENERIC",
};

const ACTION_ERRORS = [
    ["pending or confirmed", APPOINTMENT_ACTION_CODE.NOT_ALLOWED],
    ["already confirmed", APPOINTMENT_ACTION_CODE.NOT_ALLOWED],
    ["too close to the appointment time", APPOINTMENT_ACTION_CODE.NOT_ALLOWED],
    ["no longer available", APPOINTMENT_ACTION_CODE.SLOT_TAKEN],
    ["cannot be in the past", APPOINTMENT_ACTION_CODE.DATE_INVALID],
    ["too far in advance", APPOINTMENT_ACTION_CODE.DATE_INVALID],
];

const success = (data) => ({ success: true, message: null, data, code: null });

const failure = (code = APPOINTMENT_ACTION_CODE.GENERIC) => ({ success: false, message: null, data: null, code });

const messageOf = (result) => String(result?.message ?? "").toLowerCase();

const serviceLabel = (line) => (line.variantName ? `${line.serviceName} · ${line.variantName}` : line.serviceName);

const toAppointment = (item) => {
    const services = (item.services ?? []).map((line) => ({ serviceId: line.serviceId, variantId: line.variantId ?? null, label: serviceLabel(line) }));
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
        serviceName: services.length ? services.map((line) => line.label).join(", ") : (item.serviceName ?? ""),
        checkInAt: item.checkInAt ?? null,
        roomName: item.roomName ?? "",
        cancellationReason: item.cancellationReason ?? "",
        examinationId: item.examinationId ?? null,
        examinationStatus: item.examinationStatus ?? null,
        queue: Number.isInteger(item.queueNumber) ? { queueNumber: item.queueNumber } : null,
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
    return success(items.map(toAppointment));
};

const toDetail = (result) => {
    if (result.success) return success({ appointment: toAppointment(result.data ?? {}) });
    return result.status === 404 ? success(null) : failure();
};

export const getMyAppointmentDetail = async (appointmentId) => toDetail(await call(() => api.get(`/api/appointments/${appointmentId}`, READ)));

const toActionResult = (result) => {
    if (result.success) return success({ appointment: toAppointment(result.data ?? {}) });
    if (result.status === 404) return failure(APPOINTMENT_ACTION_CODE.NOT_FOUND);
    const message = messageOf(result);
    const known = ACTION_ERRORS.find(([text]) => message.includes(text));
    return failure(known ? known[1] : APPOINTMENT_ACTION_CODE.GENERIC);
};

export const cancelMyAppointment = async (appointmentId, { reason }) =>
    toActionResult(await call(() => api.post(`/api/appointments/${appointmentId}/cancel`, { reason: reason.trim() }, READ)));

export const rescheduleMyAppointment = async (appointmentId, { date, slotStart, doctorId }) =>
    toActionResult(await call(() => api.post(`/api/appointments/${appointmentId}/reschedule`, { date, slotStart, doctorId: doctorId ? Number(doctorId) : null }, READ)));

const toServiceParams = (appointment) => ({
    ServiceId: [...new Set(appointment.services.filter((line) => line.variantId === null).map((line) => line.serviceId))],
    VariantId: [...new Set(appointment.services.filter((line) => line.variantId !== null).map((line) => line.variantId))],
});

export const getRescheduleSlots = (appointment, { date, doctorId }) =>
    getBookingSlots({ date, doctorId: doctorId ? Number(doctorId) : null, services: toServiceParams(appointment) });

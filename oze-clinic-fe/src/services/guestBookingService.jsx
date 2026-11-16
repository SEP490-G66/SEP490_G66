import api from "./api";
import { call } from "./receptionService";
import { addDays, parseDateOnly, toDateOnly } from "../utils/format";
import { BOOKING_ERROR_CODE, GUEST_BOOKING_TEXT } from "../utils/messages";

// Booking for a guest (no account) on /book-appointment, with the real API. Every function returns the same
// shape as bookingService.jsx (the patient booking), so the same form (useBookingForm) runs both pages.

// The screen handles every error itself, no global error page
const READ = { skipErrorPage: true };

// Requests at the same time when checking the free slots of every day in the range
const DAY_REQUESTS_AT_ONCE = 6;

const failure = (code = BOOKING_ERROR_CODE.GENERIC, extra = {}) => ({ success: false, message: null, data: null, code, ...extra });

const listOf = (data) => (Array.isArray(data) ? data : (data?.items ?? []));

// The server writes errors in English; these are the booking ones the form reacts to (ErrorConstants.AppointmentMessage).
const SERVER_ERRORS = [
    ["no longer available", BOOKING_ERROR_CODE.SLOT_NOT_AVAILABLE],
    ["cannot be in the past", BOOKING_ERROR_CODE.PAST_DATE],
    ["too far in advance", BOOKING_ERROR_CODE.TOO_FAR_AHEAD],
    ["variant is not available", BOOKING_ERROR_CODE.VARIANT_INACTIVE],
    ["service is not available", BOOKING_ERROR_CODE.VARIANT_INACTIVE],
];

// Errors only a guest can get: shown as a message above the button (with the hotline after it)
const GUEST_ERRORS = [
    ["already has an account", GUEST_BOOKING_TEXT.ERROR_PHONE_HAS_ACCOUNT],
    ["not finished", GUEST_BOOKING_TEXT.ERROR_HAS_UNFINISHED],
    ["more than one patient record", GUEST_BOOKING_TEXT.ERROR_MULTIPLE_RECORDS],
    ["phone number is invalid", GUEST_BOOKING_TEXT.ERROR_PHONE],
    ["email is invalid", GUEST_BOOKING_TEXT.ERROR_EMAIL],
];

const toFailure = (result) => {
    const message = String(result?.message ?? "").toLowerCase();
    const known = result?.code && Object.values(BOOKING_ERROR_CODE).includes(result.code) ? result.code : null;
    if (known) return failure(known);
    const server = SERVER_ERRORS.find(([text]) => message.includes(text));
    if (server) return failure(server[1]);
    const guest = GUEST_ERRORS.find(([text]) => message.includes(text));
    return guest ? failure(null, { submitError: guest[1] }) : failure();
};

const toService = (service) => ({
    id: service.serviceId,
    name: service.serviceName,
    isMandatory: Boolean(service.isMandatory),
    variants: (service.variants ?? []).map((variant) => ({ id: variant.variantId, name: variant.variantName })),
});

export const getGuestBookingContext = async ({ signal } = {}) => {
    const [services, doctors] = await Promise.all([
        call(() => api.get("/api/appointments/bookable-services", { ...READ, signal })),
        call(() => api.get("/api/home/doctors", { ...READ, signal, params: { PageSize: 100 } })),
    ]);
    if (!services.success || !doctors.success) return failure();
    return {
        success: true,
        message: null,
        code: null,
        data: {
            patient: null,
            unfinished: null,
            services: listOf(services.data).map(toService),
            doctors: listOf(doctors.data).map((doctor) => ({ doctorId: doctor.id, doctorName: doctor.fullName })),
        },
    };
};

// One row per doctor comes back; the form needs each start once, in order.
const uniqueSlots = (rows) => {
    const byStart = new Map();
    rows.forEach((row) => {
        if (!byStart.has(row.slotStart)) byStart.set(row.slotStart, { slotStart: row.slotStart, slotEnd: row.slotEnd });
    });
    return [...byStart.values()].sort((a, b) => a.slotStart.localeCompare(b.slotStart));
};

const loadSlots = (date, doctorId, signal) =>
    call(() => api.get("/api/appointments/available-slots", { ...READ, signal, params: { Date: date, DoctorId: doctorId ?? undefined } }));

export const getGuestBookingSlots = async ({ date, doctorId, signal } = {}) => {
    const result = await loadSlots(date, doctorId, signal);
    return result.success ? { success: true, message: null, code: null, data: uniqueSlots(listOf(result.data)) } : failure();
};

// No "free slots per day" API yet (BE-G2), so every day of the range is asked one by one, a few at a time.
// A day the server refuses (e.g. past its booking limit) counts as having no free slot.
export const getGuestBookingDays = async ({ from, to, doctorId, signal } = {}) => {
    const dates = [];
    for (let date = from; date <= to; date = toDateOnly(addDays(parseDateOnly(date), 1))) dates.push(date);
    const days = new Array(dates.length);
    let next = 0;
    let broken = false;
    const worker = async () => {
        while (next < dates.length && !broken) {
            const index = next++;
            const result = await loadSlots(dates[index], doctorId, signal);
            if (result.aborted || result.noResponse || (result.status ?? 0) >= 500) {
                broken = true;
                return;
            }
            const slots = result.success ? uniqueSlots(listOf(result.data)) : [];
            days[index] = { date: dates[index], freeSlotCount: slots.length, isWorkingDay: slots.length > 0, firstSlotStart: slots[0]?.slotStart ?? null };
        }
    };
    await Promise.all(Array.from({ length: Math.min(DAY_REQUESTS_AT_ONCE, dates.length) }, worker));
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return broken ? failure() : { success: true, message: null, code: null, data: days };
};

// payload: the same booking payload as a patient (buildBookingPayload) plus the guest's details.
export const createGuestBooking = async (payload) => {
    const result = await call(() => api.post("/api/appointments/guest-booking", payload, READ));
    if (!result.success) return toFailure(result);
    const appointment = result.data ?? {};
    return {
        success: true,
        message: null,
        code: null,
        data: {
            id: appointment.id ?? null,
            code: appointment.appointmentCode ?? "",
            status: appointment.status,
            date: appointment.appointmentDate,
            slotStart: appointment.timeSlotStart,
            slotEnd: appointment.timeSlotEnd,
            doctorName: appointment.doctorName,
            services: (appointment.services ?? []).map((line) => (line.variantName ? `${line.serviceName} · ${line.variantName}` : line.serviceName)),
            note: appointment.notes,
        },
    };
};

export const GUEST_BOOKING_API = {
    getContext: getGuestBookingContext,
    getDays: getGuestBookingDays,
    getSlots: getGuestBookingSlots,
    create: createGuestBooking,
};

import api from "./api";
import { call } from "./receptionService";
import { getClinicToday } from "../utils/format";
import { APPOINTMENT_STATUS, BOOKING_ERROR_CODE, GUEST_BOOKING_TEXT } from "../utils/messages";

const READ = { skipErrorPage: true };

const LIST_PARAMS = { indexes: null };

const PAGE_SIZE = 100;

const NO_PROFILE = "no patient profile is linked";

const UNFINISHED_STATUSES = new Set([APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_SERVICE]);

const failure = (code = BOOKING_ERROR_CODE.GENERIC, extra = {}) => ({ success: false, message: null, data: null, code, ...extra });

const success = (data) => ({ success: true, message: null, code: null, data });

const abortError = () => new DOMException("Aborted", "AbortError");

const listOf = (data) => (Array.isArray(data) ? data : (data?.items ?? []));

const toLocalPhone = (phone) => (phone ?? "").replace(/^\+84/, "0");

const SERVER_ERRORS = [
    ["no longer available", BOOKING_ERROR_CODE.SLOT_NOT_AVAILABLE],
    ["cannot be in the past", BOOKING_ERROR_CODE.PAST_DATE],
    ["too far in advance", BOOKING_ERROR_CODE.TOO_FAR_AHEAD],
    ["variant is not available", BOOKING_ERROR_CODE.VARIANT_INACTIVE],
    ["service is not available", BOOKING_ERROR_CODE.VARIANT_INACTIVE],
];

const PATIENT_ERRORS = [
    ["not finished", BOOKING_ERROR_CODE.HAS_UNFINISHED],
    [NO_PROFILE, BOOKING_ERROR_CODE.PROFILE_NOT_FOUND],
    ["verify your phone number", BOOKING_ERROR_CODE.PHONE_NOT_VERIFIED],
];

const GUEST_ERRORS = [
    ["already has an account", GUEST_BOOKING_TEXT.ERROR_PHONE_HAS_ACCOUNT],
    ["not finished", GUEST_BOOKING_TEXT.ERROR_HAS_UNFINISHED],
    ["more than one patient record", GUEST_BOOKING_TEXT.ERROR_MULTIPLE_RECORDS],
    ["phone number is invalid", GUEST_BOOKING_TEXT.ERROR_PHONE],
    ["email is invalid", GUEST_BOOKING_TEXT.ERROR_EMAIL],
];

const toFailure = (result, { codes = [], texts = [] } = {}) => {
    const message = String(result?.message ?? "").toLowerCase();
    const known = result?.code && Object.values(BOOKING_ERROR_CODE).includes(result.code) ? result.code : null;
    if (known) return failure(known);
    const coded = [...SERVER_ERRORS, ...codes].find(([text]) => message.includes(text));
    if (coded) return failure(coded[1]);
    const text = texts.find(([part]) => message.includes(part));
    return text ? failure(null, { submitError: text[1] }) : failure();
};

const toService = (service) => ({
    id: service.serviceId,
    name: service.serviceName,
    isMandatory: Boolean(service.isMandatory),
    variants: (service.variants ?? []).map((variant) => ({ id: variant.variantId, name: variant.variantName })),
});

const toDoctor = (doctor) => ({ doctorId: doctor.id, doctorName: doctor.fullName });

const loadDoctors = (signal) => call(() => api.get("/api/home/doctors", { ...READ, signal, params: { PageSize: PAGE_SIZE } }));

export const getBookingDoctors = async ({ signal } = {}) => {
    const result = await loadDoctors(signal);
    return result.success ? success(listOf(result.data).map(toDoctor)) : failure();
};

const loadSharedContext = async (signal) => {
    const [services, doctors] = await Promise.all([call(() => api.get("/api/appointments/bookable-services", { ...READ, signal })), loadDoctors(signal)]);
    if (signal?.aborted) throw abortError();
    if (!services.success || !doctors.success) return null;
    return {
        services: listOf(services.data).map(toService),
        doctors: listOf(doctors.data).map(toDoctor),
    };
};

const uniqueSlots = (rows) => {
    const byStart = new Map();
    rows.forEach((row) => {
        if (!byStart.has(row.slotStart)) byStart.set(row.slotStart, { slotStart: row.slotStart, slotEnd: row.slotEnd });
    });
    return [...byStart.values()].sort((a, b) => a.slotStart.localeCompare(b.slotStart));
};

const loadSlots = (date, doctorId, services, signal) =>
    call(() =>
        api.get("/api/appointments/available-slots", {
            ...READ,
            signal,
            paramsSerializer: LIST_PARAMS,
            params: { Date: date, DoctorId: doctorId ?? undefined, ServiceId: services?.ServiceId, VariantId: services?.VariantId },
        })
    );

export const getBookingSlots = async ({ date, doctorId, services, signal } = {}) => {
    const result = await loadSlots(date, doctorId, services, signal);
    return result.success ? success(uniqueSlots(listOf(result.data))) : failure();
};

// Free-slot count of every day from..to in ONE request (GET api/appointments/available-days); the backend reads the
// shifts and appointments of the whole range at once. days: [{ date, freeSlotCount, isWorkingDay, firstSlotStart }].
export const getBookingDays = async ({ from, to, doctorId, services, signal } = {}) => {
    const result = await call(() =>
        api.get("/api/appointments/available-days", {
            ...READ,
            signal,
            paramsSerializer: LIST_PARAMS,
            params: { From: from, To: to, DoctorId: doctorId ?? undefined, ServiceId: services?.ServiceId, VariantId: services?.VariantId },
        })
    );
    if (signal?.aborted) throw abortError();
    if (!result.success) return failure();
    return success(
        listOf(result.data).map((day) => ({
            date: day.date,
            freeSlotCount: Number(day.freeSlotCount) || 0,
            isWorkingDay: Boolean(day.isWorkingDay),
            firstSlotStart: day.firstSlotStart ?? null,
        }))
    );
};

const toBooked = (appointment = {}) => ({
    id: appointment.id ?? null,
    code: appointment.appointmentCode ?? "",
    status: appointment.status,
    date: appointment.appointmentDate,
    slotStart: appointment.timeSlotStart,
    slotEnd: appointment.timeSlotEnd,
    doctorName: appointment.doctorName,
    services: (appointment.services ?? []).map((line) => (line.variantName ? `${line.serviceName} · ${line.variantName}` : line.serviceName)),
    note: appointment.notes,
});

export const getGuestBookingContext = async ({ signal } = {}) => {
    const shared = await loadSharedContext(signal);
    return shared ? success({ ...shared, patient: null, unfinished: null }) : failure();
};

export const createGuestBooking = async (payload) => {
    const result = await call(() => api.post("/api/appointments/guest-booking", payload, READ));
    return result.success ? success(toBooked(result.data)) : toFailure(result, { texts: GUEST_ERRORS });
};

const toPatient = (me) => ({
    fullName: me.fullName ?? "",
    gender: (me.gender ?? "").toLowerCase(),
    birthdate: me.dateOfBirth ?? "",
    phone: toLocalPhone(me.phoneNumber),
    email: me.email ?? "",
});

const startOf = (row) => `${row.appointmentDate} ${row.timeSlotStart ?? ""}`;

const toUnfinished = (rows, today) => {
    const row = rows
        .filter((item) => item.appointmentDate >= today && UNFINISHED_STATUSES.has(item.status))
        .sort((a, b) => startOf(a).localeCompare(startOf(b)))[0];
    return row
        ? {
              id: row.id,
              code: row.appointmentCode,
              date: row.appointmentDate,
              slotStart: row.timeSlotStart,
              slotEnd: row.timeSlotEnd ?? null,
              status: row.status,
              serviceName: row.serviceName ?? "",
              doctorName: row.doctorName ?? "",
          }
        : null;
};

const isProfileMissing = (result) => String(result?.message ?? "").toLowerCase().includes(NO_PROFILE);

export const getPatientBookingContext = async ({ signal } = {}) => {
    const today = getClinicToday();
    const [me, mine, shared] = await Promise.all([
        call(() => api.get("/api/me", { ...READ, signal })),
        call(() => api.get("/api/appointments/my", { ...READ, signal, params: { FromDate: today, PageSize: PAGE_SIZE } })),
        loadSharedContext(signal),
    ]);
    if (signal?.aborted) throw abortError();
    if (!mine.success && isProfileMissing(mine)) return failure(BOOKING_ERROR_CODE.PROFILE_NOT_FOUND);
    if (!me.success || !mine.success || !me.data || !shared) return failure();
    if (me.data.phoneNumberConfirmed !== true) return failure(BOOKING_ERROR_CODE.PHONE_NOT_VERIFIED);
    return success({ ...shared, patient: toPatient(me.data), unfinished: toUnfinished(listOf(mine.data), today) });
};

export const createPatientBooking = async (payload) => {
    const result = await call(() => api.post("/api/appointments", payload, READ));
    return result.success ? success(toBooked(result.data)) : toFailure(result, { codes: PATIENT_ERRORS });
};

export const GUEST_BOOKING_API = {
    getContext: getGuestBookingContext,
    getDays: getBookingDays,
    getSlots: getBookingSlots,
    create: createGuestBooking,
};

export const PATIENT_BOOKING_API = {
    getContext: getPatientBookingContext,
    getDays: getBookingDays,
    getSlots: getBookingSlots,
    create: createPatientBooking,
};

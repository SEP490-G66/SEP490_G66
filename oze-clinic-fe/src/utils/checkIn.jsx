import { hhmm } from "./calendar";
import { norm } from "./medicalRecord";

export const EMPTY_CHECK_IN_FILTERS = { keyword: "", slot: "", doctor: "", status: "" };

export const STATE_ORDER = ["notyet", "checkedin", "serving", "done", "noshow", "cancelled"];

const STATE_OF = { PENDING: "notyet", CONFIRMED: "notyet", CHECKED_IN: "checkedin", IN_SERVICE: "serving", COMPLETED: "done", NO_SHOW: "noshow", CANCELLED: "cancelled" };

const CALL_NOTE = { CallBack: "callback", Unreachable: "noanswer" };

export const stateOf = (appointment) => STATE_OF[appointment.status] ?? "notyet";

export const confirmNoteOf = (appointment) => (appointment.status === "PENDING" ? (CALL_NOTE[appointment.confirmCallOutcome] ?? "pending") : null);

export const slotOf = (appointment) => (appointment.timeSlotStart ? `${hhmm(appointment.timeSlotStart)} – ${hhmm(appointment.timeSlotEnd)}` : "");

export const serviceNames = (appointment) => {
    const list = appointment.services?.length ? appointment.services : appointment.serviceName ? [{ serviceName: appointment.serviceName }] : [];
    const sorted = [...list].sort((a, b) => Number(Boolean(a.isMandatory)) - Number(Boolean(b.isMandatory)));
    return sorted.map((s) => (s.variantName ? `${s.serviceName} · ${s.variantName}` : s.serviceName));
};

export const allergiesOf = (appointment) => (appointment.patientAllergies ?? []).filter(Boolean);

export const matchesKeyword = (appointment, keyword) => {
    const q = keyword.trim();
    if (!q) return true;
    const digits = q.replace(/\D/g, "");
    const phone = String(appointment.patientPhoneNumber ?? "").replace(/\D/g, "").replace(/^84/, "0");
    return (
        norm(appointment.patientName).includes(norm(q)) ||
        norm(appointment.patientCode).includes(norm(q)) ||
        (digits.length >= 3 && phone.includes(digits.replace(/^84/, "0")))
    );
};

export const isFilteredCheckIn = (filters) => Object.keys(EMPTY_CHECK_IN_FILTERS).some((key) => filters[key] !== EMPTY_CHECK_IN_FILTERS[key]);

export const sortCheckIn = (list) =>
    [...list].sort(
        (a, b) => STATE_ORDER.indexOf(stateOf(a)) - STATE_ORDER.indexOf(stateOf(b)) || (a.timeSlotStart ?? "99").localeCompare(b.timeSlotStart ?? "99"),
    );

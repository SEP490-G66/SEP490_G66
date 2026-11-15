import { hhmm } from "./calendar";
import { norm } from "./medicalRecord";
import { DASHBOARD_TEXT } from "./messages";

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

// Slots that still have someone to check in come first, then by time, then by state.
export const sortCheckIn = (list) => {
    const pending = new Set(list.filter((a) => stateOf(a) === "notyet").map((a) => a.timeSlotStart ?? ""));
    const rank = (a) => (pending.has(a.timeSlotStart ?? "") ? 0 : 1);
    return [...list].sort(
        (a, b) =>
            rank(a) - rank(b) ||
            (a.timeSlotStart ?? "99").localeCompare(b.timeSlotStart ?? "99") ||
            STATE_ORDER.indexOf(stateOf(a)) - STATE_ORDER.indexOf(stateOf(b)),
    );
};

// The slot is over and the patient has not come yet. now: "HH:mm" clinic time.
export const isLate = (appointment, now) => stateOf(appointment) === "notyet" && Boolean(appointment.timeSlotEnd) && hhmm(appointment.timeSlotEnd) <= now;

// The "⋯" menu of an appointment row. open(type) returns the click handler that opens that dialog.
export const appointmentMenu = (appointment, { isToday, late, open }) => {
    const unconfirmed = appointment.status === "PENDING";
    const text = DASHBOARD_TEXT;
    return [
        ...(unconfirmed && isToday && !late ? [{ label: text.ACT_CONFIRM, onSelect: open("confirm") }] : []),
        ...(unconfirmed && !late ? [{ label: text.ACT_CALL, onSelect: open("call") }] : []),
        ...(late ? [{ label: text.ACT_NO_SHOW, onSelect: open("noShow") }] : []),
        ...(appointment.timeSlotStart ? [{ label: text.ACT_RESCHEDULE, onSelect: open("reschedule") }] : []),
        null,
        { label: text.ACT_CANCEL, danger: true, onSelect: open("cancel") },
    ];
};

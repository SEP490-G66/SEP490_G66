import { fromMinutes, hhmm, slotEnd, toMinutes } from "./calendar";

export const SCHEDULE_SLOTS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];

export const NOON = "12:00";

export const CELL_KEYS = ["done", "noshow", "cancelled", "serving", "checkedin", "notyet", "pending", "confirmed", "callback", "noanswer"];

export const CELL_DOT = {
    done: "bg-success",
    noshow: "bg-danger",
    cancelled: "bg-placeholder",
    serving: "bg-primary",
    checkedin: "bg-chart-3",
    notyet: "bg-muted",
    pending: "bg-warning",
    confirmed: "bg-success",
    callback: "bg-chart-7",
    noanswer: "bg-danger",
};

export const LEGEND = { past: ["done", "noshow", "cancelled"], today: ["serving", "checkedin", "notyet"], future: ["pending", "confirmed", "callback", "noanswer"] };

const TODAY_KEYS = { COMPLETED: "done", NO_SHOW: "noshow", CANCELLED: "cancelled", IN_SERVICE: "serving", CHECKED_IN: "checkedin", PENDING: "notyet", CONFIRMED: "notyet" };

const CALL_KEYS = { CallBack: "callback", Unreachable: "noanswer" };

export const rowOf = (time) => fromMinutes(Math.floor(toMinutes(time) / 30) * 30);

export const cellKeyOf = (appointment, today) => {
    if (appointment.appointmentDate <= today) return TODAY_KEYS[appointment.status] ?? "notyet";
    if (appointment.status === "CANCELLED") return "cancelled";
    if (appointment.status === "PENDING") return CALL_KEYS[appointment.confirmCallOutcome] ?? "pending";
    return "confirmed";
};

export const scheduleRows = (appointments) => {
    const extra = appointments.filter((a) => a.timeSlotStart).map((a) => rowOf(a.timeSlotStart));
    return [...new Set([...SCHEDULE_SLOTS, ...extra])].sort();
};

export const slotPhase = (day, time, today, now) => {
    if (day < today) return "past";
    if (day > today) return "future";
    if (slotEnd(time) <= now) return "past";
    return time <= now ? "now" : "future";
};

export const currentRow = (rows, now) => rows.filter((t) => t <= now).pop() ?? null;

export const slotLabel = (appointment) => `${hhmm(appointment.timeSlotStart)} – ${hhmm(appointment.timeSlotEnd)}`;

export const hasService = (appointment, serviceId) =>
    !serviceId || (appointment.services ?? []).some((s) => String(s.serviceId) === String(serviceId)) || String(appointment.serviceId) === String(serviceId);

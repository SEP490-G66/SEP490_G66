import { fromMinutes, hhmm, slotEnd, toMinutes } from "./calendar";

export const CELL_KEYS = ["done", "noshow", "cancelled", "serving", "checkedin", "notyet", "pending", "confirmed"];

export const CELL_DOT = {
    done: "bg-success",
    noshow: "bg-danger",
    cancelled: "bg-placeholder",
    serving: "bg-primary",
    checkedin: "bg-chart-3",
    notyet: "bg-muted",
    pending: "bg-warning",
    confirmed: "bg-success",
};

const TODAY_KEYS = { COMPLETED: "done", NO_SHOW: "noshow", CANCELLED: "cancelled", IN_SERVICE: "serving", CHECKED_IN: "checkedin", PENDING: "notyet", CONFIRMED: "notyet" };

const DEFAULT_STEP = 30;

export const slotStep = (times) => {
    const sorted = [...new Set(times)].sort().map(toMinutes);
    const gaps = sorted.slice(1).map((m, i) => m - sorted[i]).filter((g) => g > 0);
    return gaps.length ? Math.min(...gaps) : DEFAULT_STEP;
};

export const rowOf = (time, step = DEFAULT_STEP) => fromMinutes(Math.floor(toMinutes(time) / step) * step);

export const cellKeyOf = (appointment, today) => {
    if (appointment.appointmentDate <= today) return TODAY_KEYS[appointment.status] ?? "notyet";
    if (appointment.status === "CANCELLED") return "cancelled";
    if (appointment.status === "PENDING") return "pending";
    return "confirmed";
};

// Rows come from the clinic's real slots (free slots of the week) plus every booked time
const MIN_BREAK = 60;

export const scheduleRows = (appointments, freeTimes, step) => {
    const booked = appointments.filter((a) => a.timeSlotStart).map((a) => rowOf(a.timeSlotStart, step));
    const known = [...new Set([...freeTimes.map((t) => rowOf(t, step)), ...booked])].sort().map(toMinutes);
    const rows = [];
    known.forEach((m, i) => {
        const prev = known[i - 1];
        if (prev != null && m - prev - step < MIN_BREAK) for (let t = prev + step; t < m; t += step) rows.push(t);
        rows.push(m);
    });
    return rows.map(fromMinutes);
};

// A break sits between two rows further apart than one slot
export const breakBefore = (rows, index, step) => {
    if (index === 0) return null;
    const from = toMinutes(rows[index - 1]) + step;
    const to = toMinutes(rows[index]);
    return to - from >= MIN_BREAK ? { from: fromMinutes(from), to: rows[index], lunch: from <= 12 * 60 && to >= 12 * 60 } : null;
};

export const slotPhase = (day, time, today, now, step = DEFAULT_STEP) => {
    if (day < today) return "past";
    if (day > today) return "future";
    if (slotEnd(time, step) <= now) return "past";
    return time <= now ? "now" : "future";
};

const CLOSED_STATUSES = ["CANCELLED", "NO_SHOW"];

export const isLiveAppointment = (appointment) => !CLOSED_STATUSES.includes(appointment.status);

export const legendGroups = (appointments, today) =>
    [
        ["past", appointments.filter((a) => a.appointmentDate < today)],
        ["today", appointments.filter((a) => a.appointmentDate === today)],
        ["future", appointments.filter((a) => a.appointmentDate > today)],
    ]
        .map(([group, list]) => [group, CELL_KEYS.filter((key) => list.some((a) => cellKeyOf(a, today) === key))])
        .filter(([, keys]) => keys.length > 0);

export const currentRow = (rows, now) => rows.filter((t) => t <= now).pop() ?? null;

export const slotLabel = (appointment) => `${hhmm(appointment.timeSlotStart)} – ${hhmm(appointment.timeSlotEnd)}`;

export const hasService = (appointment, serviceId) =>
    !serviceId || (appointment.services ?? []).some((s) => String(s.serviceId) === String(serviceId)) || String(appointment.serviceId) === String(serviceId);

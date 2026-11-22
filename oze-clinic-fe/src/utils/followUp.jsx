import { FOLLOW_UP_TEXT as TEXT } from "./messages";
import { addDays } from "./calendar";

export const FOLLOW_UP_PAGE_SIZE = 10;

export const REMIND_LOCK_MS = 4 * 60 * 60 * 1000;

export const EMPTY_FILTERS = { keyword: "", due: "", state: "need", doctorId: "", page: 1 };

export const STATE_CHIPS = {
    PENDING: [TEXT.STATE_OPTIONS.PENDING, "badge-warning"],
    CONFIRMED: [TEXT.STATE_OPTIONS.CONFIRMED, "badge-success"],
    NONE: [TEXT.STATE_OPTIONS.NONE, "badge-neutral"],
    MISSED: [TEXT.STATE_OPTIONS.MISSED, "badge-danger"],
    ARRIVED: [TEXT.ARRIVED, "badge-info"],
    DONE: [TEXT.STATE_OPTIONS.DONE, "badge-success"],
};

export const followUpQuery = (filters, today) => {
    const query = { keyword: filters.keyword.trim(), doctorId: filters.doctorId, state: filters.state, page: filters.page, pageSize: FOLLOW_UP_PAGE_SIZE };
    if (filters.due === "today") Object.assign(query, { fromDate: today, toDate: today });
    if (filters.due === "week") Object.assign(query, { fromDate: today, toDate: addDays(today, 7) });
    return query;
};

export const rowState = (item, today) => {
    const status = item.followUpAppointmentId ? item.followUpAppointmentStatus : null;
    if (status === "CHECKED_IN" || status === "IN_SERVICE") return "ARRIVED";
    if (status === "COMPLETED") return "DONE";
    if (status === "CONFIRMED") return "CONFIRMED";
    if (status === "PENDING") return item.followUpAppointmentDate >= today ? "PENDING" : "MISSED";
    if (status === "NO_SHOW") return "MISSED";
    return item.followUpDate && item.followUpDate >= today ? "NONE" : "MISSED";
};

export const hasLiveAppointment = (state) => state === "PENDING" || state === "CONFIRMED";

const usesAppointment = (item, state) => Boolean(item.followUpAppointmentId) && item.followUpAppointmentStatus !== "CANCELLED" && state !== "NONE";

export const doctorOf = (item, state) => (usesAppointment(item, state) && item.followUpDoctorName) || item.doctorName;

export const dueDateOf = (item, state) => (usesAppointment(item, state) ? item.followUpAppointmentDate : item.followUpDate);

export const slotOf = (item, state) => (usesAppointment(item, state) ? item.followUpTimeSlotStart : null);

export const remindUnlockAt = (item, now = Date.now()) => {
    if (!item.lastRemindedAt) return null;
    const until = new Date(item.lastRemindedAt).getTime() + REMIND_LOCK_MS;
    return until > now ? new Date(until).toISOString() : null;
};

export const isFiltered = (filters) => Boolean(filters.keyword.trim() || filters.due || filters.state !== EMPTY_FILTERS.state || filters.doctorId);

export const remindedText = (item, last) =>
    item.reminderCount ? [TEXT.REMIND_COUNT(item.reminderCount), last && TEXT.REMIND_LAST(last.day, last.time)].filter(Boolean).join(" · ") : TEXT.NOT_REMINDED;

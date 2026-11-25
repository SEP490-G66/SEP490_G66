import { FOLLOW_UP_TEXT as TEXT } from "./messages";

export const FOLLOW_UP_PAGE_SIZE = 10;

export const REMIND_LOCK_MS = 4 * 60 * 60 * 1000;

export const OPEN_STATE = "OPEN";

export const ALL_STATE = "all";

export const DEFAULT_STATE = "PENDING";

export const FILTER_STATES = Object.keys(TEXT.STATE_OPTIONS);

export const STATE_CHIPS = {
    PENDING: [TEXT.STATE_LABELS.PENDING, "badge-warning"],
    CONFIRMED: [TEXT.STATE_LABELS.CONFIRMED, "badge-success"],
    NONE: [TEXT.STATE_LABELS.NONE, "badge-neutral"],
    MISSED: [TEXT.STATE_LABELS.MISSED, "badge-danger"],
    ARRIVED: [TEXT.ARRIVED, "badge-info"],
    DONE: [TEXT.STATE_LABELS.DONE, "badge-success"],
};

export const dateFromUrl = (raw) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw ?? "")) return "";
    const date = new Date(`${raw}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw ? raw : "";
};

export const followUpQuery = ({ keyword, from, to, state, page }) => ({
    keyword,
    fromDate: from || undefined,
    toDate: to || undefined,
    state: state === ALL_STATE ? OPEN_STATE : state,
    page,
    pageSize: FOLLOW_UP_PAGE_SIZE,
});

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


export const remindedText = (item, last) =>
    item.reminderCount ? [TEXT.REMIND_COUNT(item.reminderCount), last && TEXT.REMIND_LAST(last.day, last.time)].filter(Boolean).join(" · ") : TEXT.NOT_REMINDED;

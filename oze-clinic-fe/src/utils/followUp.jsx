import { FOLLOW_UP_TEXT as TEXT } from "./messages";

export const FOLLOW_UP_PAGE_SIZE = 10;

export const EMPTY_FILTERS = { keyword: "", due: "", status: "", doctorId: "", page: 1 };

const CONTACT_STATUS = { none: "None", noanswer: "Unreachable", callback: "CallBack", booked: "Booked" };

export const OUTCOME_OF_CHOICE = { noanswer: "Unreachable", callback: "CallBack" };

export const STATUS_CHIPS = {
    none: [TEXT.STATUS_OPTIONS.none, "badge-neutral"],
    noanswer: [TEXT.STATUS_OPTIONS.noanswer, "badge-danger"],
    callback: [TEXT.STATUS_OPTIONS.callback, "badge-info"],
    booked: [TEXT.STATUS_OPTIONS.booked, "badge-success"],
};

const pad = (n) => String(n).padStart(2, "0");

const toKey = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

const fromKey = (key) => new Date(`${key}T00:00:00Z`);

export const addDays = (key, n) => {
    const date = fromKey(key);
    date.setUTCDate(date.getUTCDate() + n);
    return toKey(date);
};

export const weekdayIndex = (key) => (fromKey(key).getUTCDay() + 6) % 7;

export const mondayOf = (key) => addDays(key, -weekdayIndex(key));

export const ddmm = (key) => (key ? `${key.slice(8, 10)}/${key.slice(5, 7)}` : "");

export const dmy = (key) => (key ? `${ddmm(key)}/${key.slice(0, 4)}` : "");

export const shortDay = (key) => `${TEXT.WEEKDAYS_SHORT[weekdayIndex(key)]} ${ddmm(key)}`;

export const isSunday = (key) => weekdayIndex(key) === 6;

export const hhmm = (time) => (time ? String(time).slice(0, 5) : "");

export const slotEnd = (start, minutes = 30) => {
    const [h, m] = hhmm(start).split(":").map(Number);
    const total = h * 60 + m + minutes;
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

export const followUpQuery = (filters, today) => {
    const query = { keyword: filters.keyword.trim(), doctorId: filters.doctorId, page: filters.page, pageSize: FOLLOW_UP_PAGE_SIZE };
    if (filters.due === "late") query.toDate = addDays(today, -1);
    if (filters.due === "today") Object.assign(query, { fromDate: today, toDate: today });
    if (filters.due === "week") Object.assign(query, { fromDate: addDays(today, 1), toDate: addDays(today, 7) });
    if (filters.status) {
        query.contactStatus = CONTACT_STATUS[filters.status];
        query.hasAppointment = filters.status === "booked";
    }
    return query;
};

export const hasBooking = (item) => Boolean(item.followUpAppointmentId) && !["CANCELLED", "NO_SHOW"].includes(item.followUpAppointmentStatus);

export const contactStatusOf = (item) => {
    if (hasBooking(item)) return "booked";
    if (item.lastContactOutcome === "Unreachable") return "noanswer";
    if (item.lastContactOutcome === "CallBack") return "callback";
    return "none";
};

export const isFiltered = (filters) => Boolean(filters.keyword.trim() || filters.due || filters.status || filters.doctorId);

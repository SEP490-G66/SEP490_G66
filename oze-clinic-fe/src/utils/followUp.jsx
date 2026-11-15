import { FOLLOW_UP_TEXT as TEXT } from "./messages";
import { addDays, ddmm, weekdayIndex } from "./calendar";

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

export const shortDay = (key) => `${TEXT.WEEKDAYS_SHORT[weekdayIndex(key)]} ${ddmm(key)}`;

export const isSunday = (key) => weekdayIndex(key) === 6;

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

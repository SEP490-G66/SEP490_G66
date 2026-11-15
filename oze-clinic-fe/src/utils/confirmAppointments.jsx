import { addDays, ddmm, hhmm, weekdayIndex } from "./calendar";
import { SCHEDULE_TEXT } from "./messages";

export const confirmDefaults = (today) => ({ from: addDays(today, 1), to: addDays(today, 7), slot: "", doctor: "", status: "", keyword: "" });

export const CONFIRM_STATES = ["pending", "confirmed", "callback", "noanswer", "cancelled"];

const CALL_STATE = { CallBack: "callback", Unreachable: "noanswer" };

export const confirmStateOf = (appointment) => {
    if (appointment.status === "CANCELLED") return "cancelled";
    if (appointment.status === "PENDING") return CALL_STATE[appointment.confirmCallOutcome] ?? "pending";
    return "confirmed";
};

export const shortDate = (date) => `${SCHEDULE_TEXT.WEEKDAYS_SHORT[weekdayIndex(date)]} ${ddmm(date)}`;

export const longDate = (date) => `${SCHEDULE_TEXT.WEEKDAYS[weekdayIndex(date)]} ${date.split("-").reverse().join("/")}`;

export const callBackText = (appointment) => {
    const at = appointment.confirmCallBackAt;
    if (!at) return null;
    const [date, time] = String(at).split("T");
    return `${ddmm(date)} ${hhmm(time ?? "")}`.trim();
};

export const isConfirmFiltered = (filters, defaults) => Object.keys(defaults).some((key) => filters[key] !== defaults[key]);

export const sortByVisit = (list) =>
    [...list].sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate) || (a.timeSlotStart ?? "").localeCompare(b.timeSlotStart ?? ""));

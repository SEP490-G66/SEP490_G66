import { addDays, ddmm, weekdayIndex } from "./calendar";
import { SCHEDULE_TEXT } from "./messages";

export const confirmDefaults = (today) => ({ from: today, to: addDays(today, 7), slot: "", doctor: "", status: "pending", keyword: "" });

export const CONFIRM_STATES = ["pending", "confirmed", "cancelled"];

const STATE_OF = { PENDING: "pending", CONFIRMED: "confirmed", CANCELLED: "cancelled" };

export const isConfirmListed = (appointment) => Boolean(STATE_OF[appointment.status]);

export const confirmStateOf = (appointment) => STATE_OF[appointment.status] ?? "confirmed";

export const matchesConfirmState = (appointment, status) => !status || confirmStateOf(appointment) === status;

export const shortDate = (date) => `${SCHEDULE_TEXT.WEEKDAYS_SHORT[weekdayIndex(date)]} ${ddmm(date)}`;

export const longDate = (date) => `${SCHEDULE_TEXT.WEEKDAYS[weekdayIndex(date)]} ${date.split("-").reverse().join("/")}`;

export const isConfirmFiltered = (filters, defaults) => Object.keys(defaults).some((key) => filters[key] !== defaults[key]);

export const sortByVisit = (list) =>
    [...list].sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate) || (a.timeSlotStart ?? "").localeCompare(b.timeSlotStart ?? ""));

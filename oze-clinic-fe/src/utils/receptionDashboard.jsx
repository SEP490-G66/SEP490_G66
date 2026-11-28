import { timeOf } from "./cashShift";
import { addDays, ddmm, hhmm, mondayOf } from "./calendar";

// The five groups an appointment falls into on the dashboard chart, in stacking order (bottom first)
export const CHART_STATES = [
    { key: "done", color: "var(--color-success-solid)" },
    { key: "serving", color: "var(--color-warning-solid)" },
    { key: "in", color: "var(--color-primary)" },
    { key: "notyet", color: "var(--color-placeholder)" },
    { key: "off", color: "var(--color-danger-solid)" },
];

const GROUP_OF = { COMPLETED: "done", IN_SERVICE: "serving", CHECKED_IN: "in", PENDING: "notyet", CONFIRMED: "notyet", NO_SHOW: "off", CANCELLED: "off" };

export const chartStateOf = (appointment) => GROUP_OF[appointment.status] ?? "notyet";

export const countStates = (appointments) => {
    const counts = Object.fromEntries(CHART_STATES.map((s) => [s.key, 0]));
    appointments.forEach((a) => (counts[chartStateOf(a)] += 1));
    return counts;
};

export const totalOf = (counts) => CHART_STATES.reduce((sum, s) => sum + (counts[s.key] ?? 0), 0);

// Hour of the visit: the booked slot, or for a walk-in the time they checked in (else when it was created)
export const hourOf = (appointment) => {
    const time = appointment.timeSlotStart ? hhmm(appointment.timeSlotStart) : timeOf(appointment.checkInAt ?? appointment.createdAt);
    return time ? Number(time.slice(0, 2)) : null;
};

const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const WEEKDAY_FULL = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

// The seven days (Mon–Sun) of the week holding today. todays replaces the range's copy of today (it is fresher).
export const weekDays = (today, rangeItems, todays) => {
    const monday = mondayOf(today);
    return WEEKDAY_SHORT.map((short, i) => {
        const key = addDays(monday, i);
        const items = key === today ? todays : rangeItems.filter((a) => a.appointmentDate === key);
        return { key, short, full: `${WEEKDAY_FULL[i]} ${ddmm(key)}`, today: key === today, items, counts: countStates(items) };
    });
};

// One column per hour that has an appointment that day
export const hourColumns = (items) => {
    const byHour = new Map();
    items.forEach((a) => {
        const hour = hourOf(a);
        if (hour == null) return;
        if (!byHour.has(hour)) byHour.set(hour, []);
        byHour.get(hour).push(a);
    });
    return [...byHour.entries()]
        .sort(([a], [b]) => a - b)
        .map(([hour, list]) => ({ hour, label: `${String(hour).padStart(2, "0")}h`, items: list, counts: countStates(list) }));
};

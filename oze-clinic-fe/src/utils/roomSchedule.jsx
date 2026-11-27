import { fromMinutes, hhmm, toMinutes } from "./calendar";

// Day × room appointment grid of the front desk (spec "Quản lý lịch hẹn"). Pure helpers, no React.
// Rooms and doctors come from the shift plan (api/schedules/doctors-on-duty), free slots from api/appointments/available-slots.

export const ROOM_TYPES = { GENERAL: "GeneralTreatment", SURGERY: "MinorSurgery", XRAY: "XRay" };

const DEFAULT_STEP = 30;
// A gap this long between two working rows is a break (lunch), not empty rows
const MIN_BREAK = 60;
const NOON = 12 * 60;
const LUNCH_END = 13 * 60;
const ON_LEAVE = "OnLeave";

// ----- slot size -----
// The slot size setting is read by the clinic manager only, so it is read off the clinic's own free slots and shift starts
export const slotStepOf = (times) => {
    const sorted = [...new Set(times.filter(Boolean).map(hhmm))].sort().map(toMinutes);
    const gaps = sorted.slice(1).map((m, i) => m - sorted[i]).filter((g) => g > 0);
    return gaps.length ? Math.min(...gaps) : DEFAULT_STEP;
};

const rowOf = (minutes, step) => Math.floor(minutes / step) * step;

// ----- rooms and shifts -----
// Rooms that take appointments: every room with a shift somewhere in the week, without the X-ray room (R9)
export const roomsOf = (dutyByDay) => {
    const rooms = new Map();
    Object.values(dutyByDay).forEach((duty) =>
        (duty ?? []).forEach((d) => {
            if (d.roomId == null || d.roomType === ROOM_TYPES.XRAY || rooms.has(d.roomId)) return;
            rooms.set(d.roomId, { id: d.roomId, name: d.roomName ?? `#${d.roomId}`, type: d.roomType });
        }),
    );
    const rank = (r) => (r.type === ROOM_TYPES.SURGERY ? 1 : 0);
    return [...rooms.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "vi", { numeric: true }));
};

const shiftOf = (d) => ({
    doctorId: d.doctorId,
    doctorName: d.doctorName,
    start: toMinutes(d.shiftStart),
    end: toMinutes(d.shiftEnd),
    onLeave: d.status === ON_LEAVE,
});

export const shiftsOfRoom = (duty, roomId) => (duty ?? []).filter((d) => d.roomId === roomId).map(shiftOf).sort((a, b) => a.start - b.start);

// The working shift of the room at a time (a doctor on leave does not work it)
export const shiftAt = (shifts, minutes) => shifts.find((s) => !s.onLeave && s.start <= minutes && minutes < s.end) ?? null;

// Header lines: "Cả ngày · BS. X", or one line per session ("Sáng" before noon, "Chiều" after)
export const doctorLines = (shifts) => {
    // A shift that runs past lunch belongs to both sessions
    const morning = shifts.filter((s) => s.start < NOON);
    const afternoon = shifts.filter((s) => s.end > LUNCH_END);
    const names = (list) => list.map((s) => ({ name: s.doctorName, onLeave: s.onLeave }));
    const sameDoctor =
        morning.length === 1 && afternoon.length === 1 && morning[0].doctorId === afternoon[0].doctorId && !morning[0].onLeave && !afternoon[0].onLeave;
    if (sameDoctor) return [{ session: "day", doctors: names(morning) }];
    return [
        { session: "am", doctors: names(morning) },
        { session: "pm", doctors: names(afternoon) },
    ];
};

// ----- rows -----
// One row per slot from the first shift start to the last shift end of the day; long gaps become a break row
export const dayRows = (duty, rooms, step) => {
    const roomIds = new Set(rooms.map((r) => r.id));
    const shifts = (duty ?? []).filter((d) => roomIds.has(d.roomId)).map(shiftOf);
    if (!shifts.length) return [];
    const covered = (m) => shifts.some((s) => s.start <= m && m < s.end);
    const first = rowOf(Math.min(...shifts.map((s) => s.start)), step);
    const last = Math.max(...shifts.map((s) => s.end));
    const rows = [];
    let gapFrom = null;
    for (let m = first; m < last; m += step) {
        if (covered(m)) {
            if (gapFrom != null) {
                if (m - gapFrom >= MIN_BREAK && rows.length) rows.push({ type: "break", from: fromMinutes(gapFrom), to: fromMinutes(m), lunch: gapFrom <= NOON && m >= NOON });
                else for (let g = gapFrom; g < m; g += step) rows.push({ type: "slot", minutes: g, time: fromMinutes(g) });
                gapFrom = null;
            }
            rows.push({ type: "slot", minutes: m, time: fromMinutes(m) });
        } else if (gapFrom == null) gapFrom = m;
    }
    return rows;
};

// ----- appointments -----
export const isOnGrid = (a) => Boolean(a.timeSlotStart) && a.status !== "CANCELLED";

// The room an appointment sits in: the room the API gives, else the room of its doctor's shift at that time
export const roomIdOf = (a, duty) => {
    if (a.roomId != null) return a.roomId;
    const start = toMinutes(a.timeSlotStart);
    const shift = (duty ?? []).find((d) => d.doctorId === a.doctorId && toMinutes(d.shiftStart) <= start && start < toMinutes(d.shiftEnd));
    return shift?.roomId ?? null;
};

const endOf = (a, step) => (a.timeSlotEnd ? toMinutes(a.timeSlotEnd) : toMinutes(a.timeSlotStart) + step);

// The doctor already has an appointment in [from, to)
export const doctorBusy = (appointments, doctorId, from, to) =>
    appointments.some((a) => a.doctorId === doctorId && toMinutes(a.timeSlotStart) < to && from < endOf(a, to - from));

// Grid cells of one room: { [minutes]: { kind: "appointments", items, span } | { kind: "covered", owner } }.
// A long appointment spans every row its held time covers, inside one block of rows (never across a break).
// Appointments that overlap in the same room (should not happen, but old data may) share one cell, so none is hidden.
export const placeAppointments = (rows, appointments, step) => {
    const cells = {};
    const rowAt = new Map(rows.map((r, index) => [r, index]).filter(([r]) => r.type === "slot").map(([r, index]) => [r.minutes, index]));
    const sorted = [...appointments].sort((a, b) => toMinutes(a.timeSlotStart) - toMinutes(b.timeSlotStart));
    sorted.forEach((a) => {
        const start = rowOf(toMinutes(a.timeSlotStart), step);
        if (!rowAt.has(start)) return;
        const ownerStart = cells[start]?.kind === "covered" ? cells[start].owner : start;
        const owner = cells[ownerStart] ?? (cells[ownerStart] = { kind: "appointments", items: [], span: 1 });
        owner.items.push(a);
        const ownerIndex = rowAt.get(ownerStart);
        const end = endOf(a, step);
        for (let m = ownerStart + owner.span * step; m < end; m += step) {
            if (rowAt.get(m) !== ownerIndex + owner.span) break;
            cells[m] = { kind: "covered", owner: ownerStart };
            owner.span += 1;
        }
    });
    return cells;
};

// ----- display state (R10) -----
// done | noshow | serving | checkedin | late | notyet | pending | confirmed | open
export const displayStateOf = (a, today, now) => {
    if (a.status === "COMPLETED") return "done";
    if (a.status === "NO_SHOW") return "noshow";
    if (a.appointmentDate < today) return "open";
    if (a.appointmentDate === today) {
        if (a.status === "IN_SERVICE") return "serving";
        if (a.status === "CHECKED_IN") return "checkedin";
        return hhmm(a.timeSlotStart) < now ? "late" : "notyet";
    }
    return a.status === "PENDING" ? "pending" : "confirmed";
};

export const ALERT_STATES = ["late", "open"];
export const DIM_STATES = ["done", "noshow"];

// Left bar and label colour of each display state (only tokens of styles/index.css)
export const STATE_BAR = {
    late: "border-l-danger-solid",
    open: "border-l-danger-solid",
    notyet: "border-l-border-strong",
    checkedin: "border-l-chart-3",
    serving: "border-l-primary",
    pending: "border-l-warning-solid",
    confirmed: "border-l-success-solid",
    done: "border-l-success-solid",
    noshow: "border-l-danger-solid",
};

export const STATE_TEXT = {
    late: "text-danger",
    open: "text-danger",
    notyet: "text-muted",
    // chart-3 is too light for small text on white: the bar carries the colour, the label stays readable
    checkedin: "text-success",
    serving: "text-primary",
    pending: "text-warning",
    confirmed: "text-success",
    done: "text-success",
    noshow: "text-danger",
};

export const STATE_DOT = {
    late: "bg-danger-solid",
    open: "bg-danger-solid",
    notyet: "bg-border-strong",
    checkedin: "bg-chart-3",
    serving: "bg-primary",
    pending: "bg-warning-solid",
    confirmed: "bg-success-solid",
    done: "bg-success-solid",
    noshow: "bg-danger-solid",
};

// ----- free slots -----
// Free general-room slots of a day as "doctorId|HH:mm" keys (the API already applies shifts, bookings and the booking window)
export const freeKeysOf = (slots) => new Set((slots ?? []).map((s) => `${s.doctorId}|${hhmm(s.slotStart)}`));

export const isFreeGeneral = (freeKeys, doctorId, time) => freeKeys.has(`${doctorId}|${time}`);

// Free general slots of a room on a day
export const freeCountOfRoom = (room, duty, freeKeys) => {
    if (room.type !== ROOM_TYPES.GENERAL) return 0;
    const shifts = shiftsOfRoom(duty, room.id);
    return [...freeKeys].filter((key) => {
        const [doctorId, time] = key.split("|");
        return shiftAt(shifts, toMinutes(time))?.doctorId === Number(doctorId);
    }).length;
};

// Free general slots of the whole day (the "Còn N chỗ" of the day strip; only general rooms count)
export const freeCountOfDay = (rooms, duty, freeKeys) =>
    rooms.reduce((n, room) => n + freeCountOfRoom(room, duty, freeKeys), 0);

export const hasWorkingShift = (shifts) => shifts.some((s) => !s.onLeave);

// ----- links -----
export const withAppointment = (path, id) => `${path}?${new URLSearchParams({ appointment: String(id) })}`;

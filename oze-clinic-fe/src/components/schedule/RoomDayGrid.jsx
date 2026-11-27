import { useMemo } from "react";
import { ddmm, toMinutes, weekdayIndex } from "@/utils/calendar";
import { SCHEDULE_TEXT as TEXT } from "@/utils/messages";
import {
    ROOM_TYPES,
    displayStateOf,
    doctorBusy,
    doctorLines,
    freeCountOfRoom,
    hasWorkingShift,
    isFreeGeneral,
    placeAppointments,
    roomIdOf,
    shiftAt,
    shiftsOfRoom,
} from "@/utils/roomSchedule";
import { cx } from "@/utils/cx";
import AppointmentCard from "./AppointmentCard";

// Cells outside every shift: striped and not clickable
const OFF_CELL = "bg-[repeating-linear-gradient(135deg,var(--color-surface-tint)_0_8px,var(--color-surface-muted)_8px_9px)]";
const CELL = "h-11 border-l border-t border-l-surface-muted border-t-border p-1 align-top";

// The badge under the doctors of a room: Còn N chỗ / Kín lịch / Hết ca / Không có ca / Chưa mở lịch / Theo kế hoạch điều trị
const roomBadge = ({ room, shifts, free, day, today, now, duty }) => {
    if (!hasWorkingShift(shifts)) return { text: TEXT.NO_SHIFT, tone: "off" };
    if (room.type === ROOM_TYPES.SURGERY) return { text: TEXT.ROOM_SURGERY, tone: "off" };
    if (free.state === "notOpen") return { text: TEXT.NOT_OPEN, tone: "off" };
    if (free.state !== "ok") return null;
    const n = freeCountOfRoom(room, duty, free.keys);
    if (n > 0) return { text: TEXT.ROOM_FREE(n), tone: "free" };
    const ended = day < today || (day === today && shifts.every((s) => s.onLeave || s.end <= toMinutes(now)));
    return ended ? { text: TEXT.ROOM_ENDED, tone: "off" } : { text: TEXT.ROOM_FULL, tone: "full" };
};

const BADGE_TONE = {
    free: "bg-canvas text-primary",
    off: "bg-on-primary/20 text-on-primary",
    full: "bg-danger-solid text-on-primary",
};

const RoomHeader = ({ room, shifts, badge }) => (
    <th scope="col" className="border-l border-on-primary/20 bg-primary p-3 text-left align-top font-medium text-on-primary">
        <div className="mb-1.5 flex items-center gap-2">
            <b className="truncate font-heading text-[15px] font-bold text-on-primary">{room.name}</b>
            {room.type === ROOM_TYPES.SURGERY && <span className="shrink-0 rounded-full bg-on-primary/20 px-2 text-caption font-semibold">{TEXT.SURGERY_TAG}</span>}
        </div>
        <div className="flex flex-col gap-0.5 text-caption">
            {doctorLines(shifts).map(({ session, doctors }) => (
                <span key={session} className="flex min-w-0 gap-1.5">
                    <i className="min-w-11 shrink-0 not-italic text-primary-soft">{TEXT.SESSION[session]}</i>
                    <span className={cx("truncate", !doctors.length && "text-primary-soft")}>
                        {doctors.length ? doctors.map((d) => (d.onLeave ? TEXT.ON_LEAVE(d.name) : d.name)).join(", ") : TEXT.NO_SHIFT}
                    </span>
                </span>
            ))}
        </div>
        {badge && <span className={cx("mt-2 inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-caption font-semibold", BADGE_TONE[badge.tone])}>{badge.text}</span>}
    </th>
);

// Day × room grid. Columns: rooms that take appointments; rows: slots of the day (lunch as one band).
// free: { state: "ok", keys } | { state: "notOpen" } | { state: "error" } — free general-room slots from the API.
// pick: a treatment plan session being given a time ({ doctorId, roomType, keys }): only the cells of its doctor, in its
// kind of room, where it fits are offered (keys from the API; null = worked out here: a free slot in the future).
const RoomDayGrid = ({ rooms, rows, step, day, today, now, duty, appointments, free, pick = null, flashId, onOpen, onFree }) => {
    const nowMinutes = toMinutes(now);
    const freeKeys = free.state === "ok" ? free.keys : new Set();
    const dayName = `${TEXT.WEEKDAYS[weekdayIndex(day)]} ${ddmm(day)}`;

    const columns = useMemo(
        () =>
            rooms.map((room) => {
                const shifts = shiftsOfRoom(duty, room.id);
                const mine = appointments.filter((a) => roomIdOf(a, duty) === room.id);
                return { room, shifts, cells: placeAppointments(rows, mine, step) };
            }),
        [rooms, rows, step, duty, appointments],
    );

    const isNowRow = (row) => day === today && row.minutes <= nowMinutes && nowMinutes < row.minutes + step;
    const isFuture = (minutes) => day > today || (day === today && minutes > nowMinutes);

    const cellOf = ({ room, shifts, cells }, row) => {
        const placed = cells[row.minutes];
        const nowLine = isNowRow(row) && "shadow-[inset_0_2px_0_var(--color-warning-solid)]";
        if (placed?.kind === "covered") return null;
        if (placed?.kind === "appointments") {
            return (
                <td key={room.id} rowSpan={placed.span} className={cx(CELL, nowLine)}>
                    <div className="flex h-full flex-col gap-1">
                        {placed.items.map((a) => (
                            <AppointmentCard
                                key={a.id}
                                appointment={a}
                                state={displayStateOf(a, today, now)}
                                tall={placed.span > 1 && placed.items.length === 1}
                                flash={a.id === flashId}
                                onOpen={onOpen}
                            />
                        ))}
                    </div>
                </td>
            );
        }
        const shift = shiftAt(shifts, row.minutes);
        if (!shift) return <td key={room.id} className={cx(CELL, OFF_CELL, nowLine)} />;
        let content = null;
        if (pick) {
            const fits =
                shift.doctorId === pick.doctorId &&
                room.type === pick.roomType &&
                (pick.keys ? pick.keys.has(`${shift.doctorId}|${row.time}`) : isFuture(row.minutes) && !doctorBusy(appointments, shift.doctorId, row.minutes, row.minutes + step));
            content = fits && (
                <button
                    type="button"
                    aria-label={TEXT.PICK_LABEL(room.name, dayName, row.time)}
                    onClick={() => onFree({ room, shift, time: row.time })}
                    className="flex h-full min-h-9 w-full items-center justify-center rounded-lg border-[1.5px] border-primary bg-primary-soft text-caption font-semibold text-primary hover:bg-primary hover:text-on-primary focus-visible:bg-primary focus-visible:text-on-primary"
                >
                    {row.time}
                </button>
            );
        } else if (room.type === ROOM_TYPES.GENERAL && isFreeGeneral(freeKeys, shift.doctorId, row.time)) {
            content = (
                <button
                    type="button"
                    aria-label={TEXT.FREE_LABEL(room.name, dayName, row.time)}
                    onClick={() => onFree({ room, shift, time: row.time })}
                    className="group flex h-full min-h-9 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-primary-softer text-caption font-medium text-primary hover:border-solid hover:border-primary hover:bg-primary hover:text-on-primary focus-visible:border-solid focus-visible:border-primary focus-visible:bg-primary focus-visible:text-on-primary"
                >
                    {TEXT.FREE(row.time)}
                    <span className="hidden group-hover:inline group-focus-visible:inline">{TEXT.FREE_HOVER}</span>
                </button>
            );
        } else if (room.type === ROOM_TYPES.SURGERY && isFuture(row.minutes) && !doctorBusy(appointments, shift.doctorId, row.minutes, row.minutes + step)) {
            // Minor surgery is booked from the doctor's treatment plan, not from a free cell (R8)
            content = (
                <span className="flex h-full min-h-9 w-full items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-tint text-caption text-muted">
                    {TEXT.FREE(row.time)}
                </span>
            );
        }
        return (
            <td key={room.id} className={cx(CELL, room.type === ROOM_TYPES.SURGERY && "bg-surface-tint/40", nowLine)}>
                {content}
            </td>
        );
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] table-fixed border-separate border-spacing-0">
                <thead>
                    <tr>
                        <th className="w-16 bg-primary" aria-hidden="true" />
                        {columns.map((column) => (
                            <RoomHeader
                                key={column.room.id}
                                room={column.room}
                                shifts={column.shifts}
                                badge={roomBadge({ ...column, free, day, today, now, duty })}
                            />
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        if (row.type === "break") {
                            return (
                                <tr key={`break-${row.from}`}>
                                    <th className="border-t border-border bg-canvas" aria-hidden="true" />
                                    <td colSpan={columns.length} className="border-t border-border bg-surface-tint p-1.5 text-center text-caption text-muted">
                                        {TEXT.BREAK(row.lunch, row.from, row.to)}
                                    </td>
                                </tr>
                            );
                        }
                        const nowRow = isNowRow(row);
                        const fullHour = row.time.endsWith(":00");
                        return (
                            <tr key={row.time}>
                                    <th
                                        scope="row"
                                        className={cx(
                                            "num bg-canvas pr-2.5 pt-1 text-right align-top text-caption font-medium text-muted",
                                            fullHour ? "border-t border-border" : "border-t border-transparent",
                                        )}
                                    >
                                        {nowRow ? (
                                            <span className="rounded-full bg-warning-solid px-2 py-0.5 text-on-primary" title={TEXT.NOW}>
                                                {now}
                                            </span>
                                        ) : (
                                            <span className={cx(!fullHour && "sr-only")}>{row.time}</span>
                                        )}
                                    </th>
                                    {columns.map((column) => cellOf(column, row))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default RoomDayGrid;

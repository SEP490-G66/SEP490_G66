import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import BookingDialog from "@/components/reception/BookingDialog";
import { RescheduleDialog } from "@/components/reception/shared";
import { clinicClock } from "@/components/reception/receptionUtils";
import AppointmentPopover from "@/components/schedule/AppointmentPopover";
import RoomDayGrid from "@/components/schedule/RoomDayGrid";
import ScheduleToolbar from "@/components/schedule/ScheduleToolbar";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { clinicToday, getAppointmentsInRange, getAvailableSlots, getDoctorsOnDuty } from "@/services/receptionService";
import { addDays, ddmm, hhmm, mondayOf, weekdayIndex } from "@/utils/calendar";
import { SCHEDULE_TEXT as TEXT } from "@/utils/messages";
import {
    dayRows,
    displayStateOf,
    freeCountOfDay,
    freeKeysOf,
    hasWorkingShift,
    isOnGrid,
    roomIdOf,
    roomsOf,
    shiftsOfRoom,
    slotStepOf,
    withAppointment,
} from "@/utils/roomSchedule";
import { RECEPTION_PATIENT_TABS, ROUTES, getReceptionPatientRoute } from "@/utils/routes";
import { cx } from "@/utils/cx";

// "Quản lý lịch hẹn" (spec spec-man-quan-ly-lich-hen): the clinic's working day by room, to find a free time and book or move
// an appointment. Status work (check-in, confirm, queue) stays on its own pages; each appointment only links there.

const READ = { skipErrorPage: true };
const CLOCK_TICK_MS = 60_000;
const FLASH_MS = 2_500;
const TOO_FAR = "too far in advance";
const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.TITLE }];
const MOVABLE = ["late", "notyet", "pending", "confirmed"];

const freeOf = (response) => {
    if (!response) return { state: "past" };
    if (response.aborted) return null;
    if (!response.success) return { state: String(response.message ?? "").toLowerCase().includes(TOO_FAR) ? "notOpen" : "error" };
    const slots = Array.isArray(response.data) ? response.data : [];
    return { state: "ok", keys: freeKeysOf(slots), starts: slots.map((s) => s.slotStart) };
};

// The whole week of the picked day: appointments, the shift plan of each day, and free general slots of each open day
const loadWeek = async (week, today, config) => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
    const [appointments, duty, free] = await Promise.all([
        getAppointmentsInRange({ fromDate: week, toDate: days[6] }, config),
        Promise.all(days.map((d) => getDoctorsOnDuty(d, config))),
        Promise.all(days.map((d) => (d >= today ? getAvailableSlots({ date: d }, config) : null))),
    ]);
    if (appointments.aborted || duty.some((r) => r.aborted) || free.some((r) => r?.aborted)) return null;
    return {
        ok: appointments.success && duty.every((r) => r.success),
        appointments: appointments.success ? appointments.items.filter(isOnGrid) : [],
        duty: Object.fromEntries(days.map((d, i) => [d, duty[i].success && Array.isArray(duty[i].data) ? duty[i].data : []])),
        free: Object.fromEntries(days.map((d, i) => [d, freeOf(free[i])])),
    };
};

const ReceptionSchedule = () => {
    const [clock, setClock] = useState(() => ({ today: clinicToday(), now: clinicClock() }));
    const [day, setDay] = useState(clinicToday);
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [booking, setBooking] = useState(null);
    const [moving, setMoving] = useState(null);
    const [detail, setDetail] = useState(null);
    const [flashId, setFlashId] = useState(null);
    const flashTimer = useRef(null);

    usePageTitle(TEXT.DOC_TITLE);

    useEffect(() => {
        const timer = setInterval(() => setClock({ today: clinicToday(), now: clinicClock() }), CLOCK_TICK_MS);
        return () => clearInterval(timer);
    }, []);

    const { today, now } = clock;
    const week = mondayOf(day);
    const requestKey = `${week}|${reload}`;

    useEffect(() => {
        const controller = new AbortController();
        loadWeek(week, clinicToday(), { ...READ, signal: controller.signal }).then((loaded) => {
            if (!loaded || controller.signal.aborted) return;
            setClock({ today: clinicToday(), now: clinicClock() });
            setResult({ key: requestKey, ...loaded });
        });
        return () => controller.abort();
    }, [week, requestKey]);

    // The appointment just booked or moved flashes once it is on the grid
    useEffect(() => {
        if (!flashId || flashTimer.current || !result?.appointments.some((a) => a.id === flashId)) return;
        flashTimer.current = setTimeout(() => {
            flashTimer.current = null;
            setFlashId(null);
        }, FLASH_MS);
    }, [flashId, result]);
    useEffect(() => () => clearTimeout(flashTimer.current), []);

    const current = result?.key === requestKey ? result : null;
    // A reload of the same week keeps the old grid on screen until the new one is in
    const shown = current ?? (result?.key.startsWith(`${week}|`) ? result : null);
    const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
    const rooms = useMemo(() => roomsOf(shown?.duty ?? {}), [shown]);
    const step = useMemo(() => {
        if (!shown) return 30;
        const starts = Object.values(shown.free).flatMap((f) => f?.starts ?? []);
        const shifts = Object.values(shown.duty).flatMap((list) => list.map((d) => d.shiftStart));
        return slotStepOf([...starts, ...shifts]);
    }, [shown]);
    const duty = useMemo(() => shown?.duty[day] ?? [], [shown, day]);
    const dayAppointments = useMemo(() => (shown?.appointments ?? []).filter((a) => a.appointmentDate === day), [shown, day]);
    const rows = useMemo(() => dayRows(duty, rooms, step), [duty, rooms, step]);
    const free = shown?.free[day] ?? { state: "error" };

    const strip = Object.fromEntries(
        days.map((d) => {
            if (!shown) return [d, null];
            const count = shown.appointments.filter((a) => a.appointmentDate === d).length;
            if (d < today) return [d, { text: TEXT.DAY_COUNT(count) }];
            const f = shown.free[d];
            if (f?.state === "notOpen") return [d, { text: TEXT.NOT_OPEN }];
            if (f?.state !== "ok") return [d, { text: TEXT.UNKNOWN }];
            const dayDuty = shown.duty[d];
            if (!rooms.some((r) => hasWorkingShift(shiftsOfRoom(dayDuty, r.id)))) return [d, { text: TEXT.NO_SHIFT }];
            const n = freeCountOfDay(rooms, dayDuty, f.keys);
            return [d, n ? { text: TEXT.DAY_FREE(n) } : { text: TEXT.DAY_FULL, full: true }];
        }),
    );

    const roomName = (a) => rooms.find((r) => r.id === roomIdOf(a, shown?.duty[a.appointmentDate]))?.name ?? a.roomName;

    const openDetail = useRef(null);
    useEffect(() => {
        openDetail.current = detail;
    }, [detail]);
    const closeDetail = useCallback((returnFocus) => {
        const open = openDetail.current;
        setDetail(null);
        if (open && returnFocus) open.anchor.focus();
    }, []);

    const actionsOf = (a, state) => {
        const list = [];
        if (state === "late" || state === "notyet") {
            // Check-in takes only confirmed appointments; one still waiting to be confirmed goes to the confirm page first
            list.push(
                a.status === "PENDING"
                    ? { label: TEXT.OPEN_CONFIRM, to: withAppointment(ROUTES.RECEPTION_APPOINTMENTS, a.id), primary: true }
                    : { label: TEXT.OPEN_CHECK_IN, to: withAppointment(ROUTES.RECEPTION_CHECK_IN, a.id), primary: true },
            );
        }
        if (state === "checkedin" || state === "serving") list.push({ label: TEXT.OPEN_QUEUE, to: withAppointment(ROUTES.RECEPTION_QUEUE, a.id), primary: true });
        if (state === "pending") list.push({ label: TEXT.OPEN_CONFIRM, to: withAppointment(ROUTES.RECEPTION_APPOINTMENTS, a.id), primary: true });
        // The confirm page lists only today and later, so a past day still open is settled from the patient's appointments
        if (state === "open") list.push({ label: TEXT.OPEN_CLOSE_OUT, to: getReceptionPatientRoute(a.patientId, RECEPTION_PATIENT_TABS.APPOINTMENTS), primary: true });
        if (MOVABLE.includes(state)) {
            list.push({
                label: TEXT.RESCHEDULE,
                onClick: () => {
                    setDetail(null);
                    setMoving(a);
                },
            });
        }
        if (state !== "open") list.push({ label: TEXT.PATIENT_RECORD, to: getReceptionPatientRoute(a.patientId) });
        return list;
    };

    const showOn = (saved) => {
        flashTimer.current && clearTimeout(flashTimer.current);
        flashTimer.current = null;
        setFlashId(saved.id ?? null);
        if (saved.appointmentDate) setDay(saved.appointmentDate);
        setReload((n) => n + 1);
    };

    const detailState = detail && displayStateOf(detail.appointment, today, now);

    return (
        <div className="app-content min-h-full space-y-4">
            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-64 flex-1">
                    <Breadcrumb items={CRUMBS} className="mb-2" />
                    <h1 className="page-title">{TEXT.TITLE}</h1>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => setBooking({ date: day >= today ? day : today })}>
                    {TEXT.BOOK}
                </button>
            </div>

            <ScheduleToolbar
                day={day}
                today={today}
                days={{ week: days, prev: addDays(day, -1), next: addDays(day, 1) }}
                strip={strip}
                dayCount={dayAppointments.length}
                onChange={(next) => {
                    setDetail(null);
                    setDay(next);
                }}
            />

            {current && !current.ok && (
                <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                    <span className="flex-1">{TEXT.LOAD_ERROR}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={() => setReload((n) => n + 1)}>
                        {TEXT.RETRY}
                    </button>
                </div>
            )}

            <section
                className={cx("overflow-hidden rounded-xl border border-border bg-canvas", !current && "opacity-60")}
                aria-busy={!current ? "true" : undefined}
            >
                {!shown || rows.length === 0 ? (
                    <p className="px-6 py-10 text-center text-body-sm text-muted">{shown ? TEXT.EMPTY_DAY : TEXT.LOADING}</p>
                ) : (
                    <RoomDayGrid
                        rooms={rooms}
                        rows={rows}
                        step={step}
                        day={day}
                        today={today}
                        now={now}
                        duty={duty}
                        appointments={dayAppointments}
                        free={free}
                        flashId={flashId}
                        onOpen={(appointment, anchor) => setDetail((open) => (open?.appointment.id === appointment.id ? null : { appointment, anchor }))}
                        onFree={({ shift, time }) => setBooking({ date: day, slotStart: `${time}:00`, doctorId: shift.doctorId })}
                    />
                )}
            </section>

            {detail && (
                <AppointmentPopover
                    appointment={detail.appointment}
                    anchor={detail.anchor}
                    state={detailState}
                    roomName={roomName(detail.appointment)}
                    actions={actionsOf(detail.appointment, detailState)}
                    onClose={closeDetail}
                />
            )}

            {booking && (
                <BookingDialog
                    initial={booking}
                    onClose={() => setBooking(null)}
                    onBooked={(a) => {
                        const when = `${TEXT.WEEKDAYS_SHORT[weekdayIndex(a.appointmentDate)]} ${ddmm(a.appointmentDate)}`;
                        // The booking answer has no room yet: it is the room of the doctor's shift at that time
                        toast.success(TEXT.BOOKED(a.patientName, when, hhmm(a.timeSlotStart), roomName(a)), { role: "status" });
                        setBooking(null);
                        showOn(a);
                    }}
                />
            )}

            {moving && (
                <RescheduleDialog
                    appointment={moving}
                    onClose={() => setMoving(null)}
                    onDone={(saved) => {
                        setMoving(null);
                        showOn({ ...saved, id: saved.id ?? moving.id });
                    }}
                />
            )}
        </div>
    );
};

export default ReceptionSchedule;

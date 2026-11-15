import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { DialogActions } from "./shared";
import { clinicToday, getAvailableSlots, recordFollowUpContact, scheduleFollowUpAppointment } from "@/services/receptionService";
import { FOLLOW_UP_TEXT as TEXT } from "@/utils/messages";
import { addDays, ddmm, hhmm, isSunday, mondayOf, shortDay, slotEnd, weekdayIndex } from "@/utils/followUp";
import { cx } from "@/utils/cx";

const READ = { skipErrorPage: true };
const NOON = "12:00";

const firstDay = (item, today) => (item.followUpDate && item.followUpDate > today ? item.followUpDate : today);

const uniqueTimes = (slots) => [...new Set(slots.map((s) => hhmm(s.slotStart)))].sort();

const FollowUpBookDialog = ({ item, doctors, onClose, onBooked }) => {
    const [today] = useState(clinicToday);
    const [doctorId, setDoctorId] = useState(String(item.doctorId ?? ""));
    const [week, setWeek] = useState(() => mondayOf(firstDay(item, today)));
    const [day, setDay] = useState(() => firstDay(item, today));
    const [pick, setPick] = useState(null);
    const [weekData, setWeekData] = useState(null);
    const [busy, setBusy] = useState(false);
    const [alert, setAlert] = useState(null);

    const weekKey = `${week}|${doctorId}`;
    const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

    useEffect(() => {
        const controller = new AbortController();
        const open = Array.from({ length: 7 }, (_, i) => addDays(week, i)).filter((d) => d >= today && !isSunday(d));
        Promise.all(
            open.map((d) => getAvailableSlots({ date: d, doctorId: doctorId || undefined }, { ...READ, signal: controller.signal }).then((r) => [d, r])),
        ).then((results) => {
            if (controller.signal.aborted || results.some(([, r]) => r.aborted)) return;
            const byDay = {};
            let failed = false;
            results.forEach(([d, r]) => {
                if (r.success) byDay[d] = Array.isArray(r.data) ? r.data : [];
                else failed = true;
            });
            setWeekData({ key: `${week}|${doctorId}`, byDay, failed });
        });
        return () => controller.abort();
    }, [week, doctorId, today]);

    const loaded = weekData?.key === weekKey ? weekData : null;
    const slotsOf = (d) => loaded?.byDay[d] ?? [];
    const freeCount = (d) => uniqueTimes(slotsOf(d)).length;
    const bookable = (d) => d >= today && !isSunday(d) && freeCount(d) > 0;
    const selectedDay = days.includes(day) && (!loaded || bookable(day)) ? day : (days.find(bookable) ?? (days.includes(day) ? day : null));
    const times = selectedDay ? uniqueTimes(slotsOf(selectedDay)) : [];

    const goWeek = (monday) => {
        setWeek(monday);
        setDay(monday < today ? today : monday);
        setPick(null);
    };

    const submit = async () => {
        if (!pick) return;
        setBusy(true);
        setAlert(null);
        const result = await scheduleFollowUpAppointment(item.examinationId, { date: pick.date, slotStart: pick.slotStart, doctorId: pick.doctorId }, READ);
        if (!result.success) {
            setBusy(false);
            setAlert(TEXT.GENERIC_ERROR);
            return;
        }
        await recordFollowUpContact(item.examinationId, { outcome: "Booked", note: TEXT.BOOKED_NOTE(ddmm(pick.date), hhmm(pick.slotStart)) }, READ);
        setBusy(false);
        onBooked(TEXT.BOOKED(item.patientName, shortDay(pick.date), hhmm(pick.slotStart)));
    };

    const dayCard = (d) => {
        const closed = isSunday(d);
        const past = d < today;
        const count = freeCount(d);
        const label = closed ? TEXT.CLOSED : past ? TEXT.PAST : !loaded ? TEXT.LOADING : count ? TEXT.FREE_SLOTS(count) : TEXT.FULL;
        const disabled = closed || past || !loaded || !count;
        const on = d === selectedDay;
        return (
            <button
                key={d}
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => {
                    setDay(d);
                    setPick(null);
                }}
                className={cx(
                    "flex flex-col items-center gap-0.5 rounded-xl border px-1.5 py-3",
                    on ? "border-2 border-primary bg-primary-soft" : "border-border bg-canvas hover:border-primary",
                    disabled && "cursor-not-allowed bg-surface-tint hover:border-border",
                )}
            >
                <span className={cx("text-caption", on ? "text-primary" : "text-muted")}>{TEXT.WEEKDAYS[weekdayIndex(d)]}</span>
                <span className={cx("num text-title font-semibold", on ? "text-primary" : disabled ? "text-muted" : "text-ink")}>{ddmm(d)}</span>
                <span className={cx("text-caption font-medium", !disabled && count ? "font-semibold text-success" : "text-muted")}>{label}</span>
            </button>
        );
    };

    const slotGroup = (title, list) => (
        <div className="space-y-2">
            <div className="flex items-baseline gap-2">
                <span className="text-label font-semibold text-ink">{title}</span>
                <span className="text-caption text-muted">{TEXT.FREE_SLOTS(list.length)}</span>
            </div>
            {list.length ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {list.map((time) => {
                        const on = pick?.date === selectedDay && hhmm(pick?.slotStart) === time;
                        return (
                            <button
                                key={time}
                                type="button"
                                aria-pressed={on}
                                onClick={() => {
                                    const slot = slotsOf(selectedDay).find((s) => hhmm(s.slotStart) === time);
                                    setPick({ date: selectedDay, slotStart: slot.slotStart, doctorId: doctorId ? Number(doctorId) : slot.doctorId });
                                }}
                                className={cx(
                                    "num h-11 rounded-lg border text-body-sm font-semibold",
                                    on ? "border-primary bg-primary text-white" : "border-border bg-canvas text-ink hover:border-primary",
                                )}
                            >
                                {time} – {slotEnd(time)}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <p className="text-body-sm text-muted">{TEXT.NO_SLOT}</p>
            )}
        </div>
    );

    return (
        <Modal title={TEXT.BOOK_TITLE} description={TEXT.BOOK_SUB(item.patientName, item.followUpDate ? ddmm(item.followUpDate) : "")} size="lg" onClose={onClose} closeDisabled={busy}>
            <form
                className="mt-5 space-y-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!busy) submit();
                }}
            >
                <div className="field max-w-xs">
                    <label className="label" htmlFor="fu-book-doctor">
                        {TEXT.DOCTOR}
                    </label>
                    <select
                        id="fu-book-doctor"
                        className="input"
                        value={doctorId}
                        onChange={(event) => {
                            setDoctorId(event.target.value);
                            setPick(null);
                        }}
                    >
                        <option value="">{TEXT.ANY_DOCTOR}</option>
                        {doctors.map((d) => (
                            <option key={d.id} value={String(d.id)}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                </div>
                <section className="space-y-3">
                    <h3 className="text-label font-semibold text-ink">{TEXT.DAY}</h3>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <label className="relative flex h-10 min-w-60 items-center rounded-lg border border-border-strong bg-canvas px-3 text-body-sm text-ink">
                            <span>{TEXT.WEEK(ddmm(days[0]), ddmm(days[6]))}</span>
                            <input
                                type="date"
                                aria-label={TEXT.PICK_DATE}
                                className="absolute inset-y-1 right-1 w-32 border-0 bg-transparent text-transparent"
                                min={today}
                                value={selectedDay ?? ""}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    if (!value) return;
                                    const target = value < today ? today : value;
                                    setWeek(mondayOf(target));
                                    setDay(target);
                                    setPick(null);
                                }}
                            />
                        </label>
                        <span className="flex-1" />
                        <button type="button" className="btn btn-secondary" disabled={week <= mondayOf(today)} onClick={() => goWeek(addDays(week, -7))}>
                            {TEXT.PREV_WEEK}
                        </button>
                        <button type="button" className={cx("btn", week === mondayOf(today) ? "btn-primary" : "btn-secondary")} onClick={() => goWeek(mondayOf(today))}>
                            {TEXT.THIS_WEEK}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => goWeek(addDays(week, 7))}>
                            {TEXT.NEXT_WEEK}
                        </button>
                    </div>
                    <div className="grid grid-cols-7 gap-2.5">{days.map(dayCard)}</div>
                </section>
                <section className="space-y-3 border-t border-border pt-4">
                    <h3 className="text-label font-semibold text-ink">{TEXT.SLOT(selectedDay ? `${TEXT.WEEKDAYS[weekdayIndex(selectedDay)]} ${ddmm(selectedDay)}` : "")}</h3>
                    {loaded?.failed && (
                        <p role="alert" className="alert alert-danger">
                            {TEXT.SLOTS_ERROR}
                        </p>
                    )}
                    {selectedDay && isSunday(selectedDay) ? (
                        <p className="text-body-sm text-muted">{TEXT.SUNDAY_CLOSED}</p>
                    ) : !loaded ? (
                        <p className="text-body-sm text-muted">{TEXT.LOADING}</p>
                    ) : (
                        <div className="space-y-4">
                            {slotGroup(TEXT.MORNING, times.filter((t) => t < NOON))}
                            {slotGroup(TEXT.AFTERNOON, times.filter((t) => t >= NOON))}
                        </div>
                    )}
                </section>
                {alert && (
                    <p role="alert" className="alert alert-danger">
                        {alert}
                    </p>
                )}
                <DialogActions
                    onClose={onClose}
                    submitLabel={pick ? TEXT.BOOK_SUBMIT_AT(shortDay(pick.date), hhmm(pick.slotStart)) : TEXT.BOOK_SUBMIT}
                    busy={busy}
                    disabled={!pick}
                    closeDisabled={busy}
                    closeLabel={TEXT.CANCEL}
                />
            </form>
        </Modal>
    );
};

export default FollowUpBookDialog;

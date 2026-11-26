import { useEffect, useState } from "react";
import { getRescheduleDays, getRescheduleSlots } from "@/services/appointmentService";
import { BOOKING_IDS, addDaysToDate, dayStatus, getRange, monthOf, pickWeekDay, shiftMonth, toDayMap, weekBounds, weekStartOf } from "@/utils/booking";

const ABORT = "AbortError";

const focusWeekButton = () => document.getElementById(BOOKING_IDS.WEEK_BUTTON)?.focus();

// Week calendar for the reschedule popup: same data as the booking page (free-slot count per day,
// then the free slots of the chosen day), scoped to the services chosen in the popup ({ ServiceId, VariantId }) and the chosen doctor.
// The shown day is derived: the patient's pick, else the preferred date, else the first free day of the week.
const useRescheduleWeek = (services, { today, preferredDate, doctorId }) => {
    const servicesKey = JSON.stringify(services ?? null);
    const bounds = weekBounds(today);
    const [weekStart, setWeekStart] = useState(() => weekStartOf(preferredDate));
    const [calendar, setCalendar] = useState(() => ({ open: false, month: monthOf(weekStartOf(preferredDate)) }));
    const [picked, setPicked] = useState(null);
    const [range, setRange] = useState({ key: null, days: null, error: false });
    const [slots, setSlots] = useState({ key: null, data: null, error: false });
    const [rangeVersion, setRangeVersion] = useState(0);
    const [slotsVersion, setSlotsVersion] = useState(0);

    const rangeKey = `${doctorId}|${servicesKey}|${rangeVersion}`;

    useEffect(() => {
        if (!services) return undefined;
        const controller = new AbortController();
        const { from, to } = getRange(today);
        getRescheduleDays(JSON.parse(servicesKey), { from, to, doctorId, signal: controller.signal }).then(
            (result) => setRange({ key: rangeKey, days: result.success ? toDayMap(result.data) : null, error: !result.success, servicesError: result.servicesError ?? null }),
            (error) => error?.name !== ABORT && setRange({ key: rangeKey, days: null, error: true, servicesError: null })
        );
        return () => controller.abort();
        // services is read through servicesKey, so a new object with the same services does not reload
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [servicesKey, today, doctorId, rangeKey]);

    const rangeBusy = range.key !== rangeKey;
    const rangeError = !rangeBusy && range.error;
    const days = rangeBusy || rangeError ? null : range.days;
    const isFreeInWeek = (date) => Boolean(date) && date >= weekStart && date <= addDaysToDate(weekStart, 6) && dayStatus(date, today, days).kind === "free";
    let day = null;
    if (days) day = [picked, preferredDate].find(isFreeInWeek) ?? pickWeekDay(weekStart, today, days);

    const slotsKey = day ? `${day}|${doctorId}|${slotsVersion}|${servicesKey}` : null;

    useEffect(() => {
        if (!slotsKey) return undefined;
        let alive = true;
        const [date] = slotsKey.split("|");
        getRescheduleSlots(JSON.parse(servicesKey), { date, doctorId }).then(
            (result) => alive && setSlots({ key: slotsKey, data: result.success ? result.data : null, error: !result.success }),
            () => alive && setSlots({ key: slotsKey, data: null, error: true })
        );
        return () => {
            alive = false;
        };
    }, [servicesKey, doctorId, slotsKey]);

    const slotsBusy = Boolean(slotsKey) && slots.key !== slotsKey;
    const slotsError = !slotsBusy && Boolean(slotsKey) && slots.error;
    const slotList = slotsKey && !slotsBusy && !slotsError ? (slots.data ?? []) : null;

    const goWeek = (next) => {
        setWeekStart(next);
        setCalendar((current) => ({ ...current, open: false }));
    };

    const actions = {
        toggleCalendar: () => setCalendar((current) => ({ open: !current.open, month: monthOf(weekStart) })),
        changeMonth: (step) => setCalendar((current) => ({ ...current, month: shiftMonth(current.month, step) })),
        closeCalendar: (returnFocus) => {
            setCalendar((current) => ({ ...current, open: false }));
            if (returnFocus) focusWeekButton();
        },
        pickWeek: (next) => {
            goWeek(next);
            focusWeekButton();
        },
        prevWeek: () => goWeek(addDaysToDate(weekStart, -7)),
        thisWeek: () => goWeek(bounds.first),
        nextWeek: () => goWeek(addDaysToDate(weekStart, 7)),
        selectDay: setPicked,
        retryDays: () => setRangeVersion((version) => version + 1),
        reloadSlots: () => setSlotsVersion((version) => version + 1),
    };

    // The chosen services cannot go in one appointment (different rooms, a variant missing): why, instead of "no slot"
    const servicesError = rangeError ? range.servicesError : null;

    return { bounds, weekStart, calendar, days, rangeBusy, rangeError, servicesError, day, slots: slotList, slotsBusy, slotsError, actions };
};

export default useRescheduleWeek;

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BookingDayStrip from "@/components/booking/BookingDayStrip";
import BookingSlotGrid from "@/components/booking/BookingSlotGrid";
import { getAvailableSlots, getDoctorsOnDuty } from "@/services/receptionService";
import { DAYS_PER_WEEK, addDaysToDate, dayText, getRange, slotRange, weekRangeText, weekStartOf } from "@/utils/booking";
import { SLOT_PICKER_TEXT as TEXT } from "@/utils/messages";

const READ = { skipErrorPage: true };
const TOO_FAR = "too far in advance";

const toSlots = (rows) => {
    const byStart = new Map();
    rows.forEach((row) => {
        const slot = byStart.get(row.slotStart) ?? { slotStart: row.slotStart, slotEnd: row.slotEnd, doctorIds: [] };
        if (row.doctorId != null) slot.doctorIds.push(row.doctorId);
        byStart.set(row.slotStart, slot);
    });
    return [...byStart.values()].sort((a, b) => a.slotStart.localeCompare(b.slotStart));
};

const loadDay = async (date, doctorId, config) => {
    const free = await getAvailableSlots({ date, doctorId: doctorId || undefined }, config);
    if (free.aborted) return null;
    if (!free.success) return { kind: String(free.message ?? "").toLowerCase().includes(TOO_FAR) ? "closed" : "error", slots: [] };
    const slots = toSlots(Array.isArray(free.data) ? free.data : []);
    if (slots.length) return { kind: "free", slots };
    const duty = await getDoctorsOnDuty(date, config);
    if (duty.aborted) return null;
    const shift = !duty.success || (duty.data ?? []).some((d) => (!doctorId || String(d.doctorId) === String(doctorId)) && d.status !== "OnLeave");
    return { kind: shift ? "full" : "off", slots: [] };
};

const datesFrom = (start, end) => {
    const list = [];
    for (let date = start; date <= end && list.length < DAYS_PER_WEEK; date = addDaysToDate(date, 1)) list.push(date);
    return list;
};

const CompactSlotPicker = ({ today, minDate, doctorId, initialDate, showEarliest = false, value, onChange, slotError }) => {
    const maxDate = getRange(today).to;
    const startDate = initialDate && initialDate >= minDate && initialDate <= maxDate ? initialDate : minDate;
    const [pickedWeek, setWeekStart] = useState(undefined);
    const [pickedDay, setDay] = useState(undefined);
    const [days, setDays] = useState({});
    const [earliest, setEarliest] = useState(undefined);
    const [retry, setRetry] = useState(0);
    const cache = useRef(new Map());
    const controller = useRef(null);

    const fetchDay = useCallback(
        (date) => {
            if (!cache.current.has(date)) {
                const request = loadDay(date, doctorId, { ...READ, signal: controller.current.signal }).then((status) => {
                    if (status) setDays((prev) => ({ ...prev, [date]: status }));
                    if ((!status || status.kind === "error") && cache.current.get(date) === request) cache.current.delete(date);
                    return status;
                });
                cache.current.set(date, request);
            }
            return cache.current.get(date);
        },
        [doctorId],
    );

    useEffect(() => {
        const own = new AbortController();
        controller.current = own;
        cache.current = new Map();
        return () => own.abort();
    }, []);

    const autoDay = (() => {
        if (initialDate && days[startDate]?.kind === "free") return startDate;
        return days[startDate] && earliest ? earliest.date : null;
    })();
    const day = pickedDay === undefined ? autoDay : pickedDay;
    const weekStart = pickedWeek ?? weekStartOf(day ?? startDate);

    useEffect(() => {
        const first = weekStart < minDate ? minDate : weekStart;
        datesFrom(first, addDaysToDate(weekStart, DAYS_PER_WEEK - 1) > maxDate ? maxDate : addDaysToDate(weekStart, DAYS_PER_WEEK - 1)).forEach(fetchDay);
    }, [weekStart, retry, fetchDay, minDate, maxDate]);

    useEffect(() => {
        if (!showEarliest && !initialDate) return;
        let stopped = false;
        const scan = async () => {
            for (let start = minDate; start <= maxDate && !stopped; start = addDaysToDate(start, DAYS_PER_WEEK)) {
                const batch = datesFrom(start, maxDate);
                const results = await Promise.all(batch.map(fetchDay));
                if (stopped || results.some((r) => r === null)) return;
                const index = results.findIndex((r) => r?.kind === "free");
                if (index >= 0) return { date: batch[index], slot: results[index].slots[0] };
            }
            return null;
        };
        scan().then((found) => {
            if (stopped || found === undefined) return;
            setEarliest(found);
        });
        return () => {
            stopped = true;
        };
    }, [retry, fetchDay, minDate, maxDate, initialDate, showEarliest]);

    const statusOf = (date) => {
        if (date < minDate) return { kind: "past", text: date < today ? TEXT.DAY_PAST : "" };
        if (date > maxDate) return { kind: "closed", text: TEXT.DAY_CLOSED };
        const status = days[date];
        if (!status) return { kind: "unknown", text: "" };
        if (status.kind === "free") return { kind: "free", text: TEXT.DAY_FREE(status.slots.length) };
        if (status.kind === "full") return { kind: "full", text: TEXT.DAY_FULL };
        if (status.kind === "off") return { kind: "off", text: TEXT.DAY_OFF };
        if (status.kind === "closed") return { kind: "closed", text: TEXT.DAY_CLOSED };
        return { kind: "error", text: "" };
    };

    const weekEnd = addDaysToDate(weekStart, DAYS_PER_WEEK - 1);
    const weekHasError = datesFrom(weekStart, weekEnd).some((date) => days[date]?.kind === "error");
    const weekBusy = datesFrom(weekStart, weekEnd).some((date) => statusOf(date).kind === "unknown");
    const current = day ? days[day] : null;

    const pick = (date, slotStart) => {
        const slot = days[date]?.slots.find((s) => s.slotStart === slotStart);
        if (!slot) return;
        onChange({ date, slotStart: slot.slotStart, slotEnd: slot.slotEnd, doctorId: doctorId ?? slot.doctorIds[0] ?? null });
    };

    const selectDay = (date) => {
        setDay(date);
        if (value?.date !== date) onChange(null);
    };

    const goWeek = (step) => {
        setWeekStart(addDaysToDate(weekStart, step * DAYS_PER_WEEK));
        setDay(null);
        onChange(null);
    };

    const pickEarliest = () => {
        setWeekStart(weekStartOf(earliest.date));
        setDay(earliest.date);
        pick(earliest.date, earliest.slot.slotStart);
    };

    const retryAll = () => {
        setDays((prev) => Object.fromEntries(Object.entries(prev).filter(([, status]) => status.kind !== "error")));
        setRetry((n) => n + 1);
    };

    const earliestPicked = earliest && value?.date === earliest.date && value?.slotStart === earliest.slot.slotStart;

    return (
        <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
                <button type="button" className="btn btn-secondary btn-icon" aria-label={TEXT.PREV_WEEK} disabled={weekStart <= weekStartOf(minDate)} onClick={() => goWeek(-1)}>
                    <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <span className="num text-label font-semibold text-ink">{weekRangeText(weekStart)}</span>
                <button type="button" className="btn btn-secondary btn-icon" aria-label={TEXT.NEXT_WEEK} disabled={addDaysToDate(weekStart, DAYS_PER_WEEK) > maxDate} onClick={() => goWeek(1)}>
                    <ChevronRight className="size-4" aria-hidden="true" />
                </button>
            </div>
            <BookingDayStrip weekStart={weekStart} today={today} busy={weekBusy} error={weekHasError} selected={day} getStatus={statusOf} onSelect={selectDay} onRetry={retryAll} />
            {showEarliest && earliest !== undefined && (
                <div className="mt-3.5 flex flex-wrap items-center gap-2.5 rounded-md border border-border bg-canvas py-2 pr-2 pl-3">
                    <p className="min-w-0 flex-1 basis-55 text-body-sm text-body">
                        {earliest ? (
                            <>
                                {TEXT.EARLIEST}{" "}
                                <strong className="font-semibold text-ink">
                                    <span className="whitespace-nowrap">{dayText(earliest.date)}</span> · <span className="num whitespace-nowrap">{slotRange(earliest.slot.slotStart, earliest.slot.slotEnd)}</span>
                                </strong>
                            </>
                        ) : (
                            TEXT.NO_EARLIEST
                        )}
                    </p>
                    {earliest &&
                        (earliestPicked ? (
                            <span className="badge badge-info">{TEXT.PICKED}</span>
                        ) : (
                            <button type="button" className="btn btn-secondary" onClick={pickEarliest}>
                                {TEXT.PICK_EARLIEST}
                            </button>
                        ))}
                </div>
            )}
            {day && current?.kind !== "error" ? (
                <BookingSlotGrid
                    slots={current?.slots ?? []}
                    busy={!current}
                    error={false}
                    selected={value?.date === day ? value.slotStart : null}
                    slotError={slotError}
                    onSelect={(slotStart) => pick(day, slotStart)}
                />
            ) : (
                <>
                    <p className="mt-4 text-body-sm text-muted">{TEXT.PICK_DAY}</p>
                    {slotError && <p className="mt-2 text-body-sm font-medium text-danger">{slotError}</p>}
                </>
            )}
        </div>
    );
};

export default CompactSlotPicker;

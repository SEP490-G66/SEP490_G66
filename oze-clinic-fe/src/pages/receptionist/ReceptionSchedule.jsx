import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import LabeledSelect from "@/components/ui/LabeledSelect";
import BookingDialog from "@/components/reception/BookingDialog";
import { Card } from "@/components/reception/shared";
import { clinicClock } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { clinicToday, getAppointmentsInRange, getAvailableSlots, getBookableServices, getDoctorOptions } from "@/services/receptionService";
import { addDays, ddmm, dmy, hhmm, isSunday, mondayOf, weekdayIndex } from "@/utils/calendar";
import { CELL_DOT, CELL_KEYS, LEGEND, breakBefore, cellKeyOf, currentRow, hasService, rowOf, scheduleRows, slotLabel, slotPhase, slotStep } from "@/utils/appointmentSchedule";
import { SCHEDULE_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import { cx } from "@/utils/cx";

const READ = { skipErrorPage: true };
const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.TITLE }];

const ReceptionSchedule = () => {
    const navigate = useNavigate();
    const [clock, setClock] = useState(() => ({ today: clinicToday(), now: clinicClock() }));
    const [week, setWeek] = useState(() => mondayOf(clinicToday()));
    const [doctorId, setDoctorId] = useState("");
    const [serviceId, setServiceId] = useState("");
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [services, setServices] = useState([]);
    const [booking, setBooking] = useState(null);

    usePageTitle(TEXT.DOC_TITLE);

    const requestKey = `${week}|${doctorId}|${reload}`;

    useEffect(() => {
        const controller = new AbortController();
        const config = { ...READ, signal: controller.signal };
        const open = Array.from({ length: 7 }, (_, i) => addDays(week, i)).filter((d) => d >= clinicToday() && !isSunday(d));
        Promise.all([
            getAppointmentsInRange({ fromDate: week, toDate: addDays(week, 6), doctorId }, config),
            ...open.map((date) => getAvailableSlots({ date, doctorId: doctorId || undefined }, config)),
        ]).then(([response, ...free]) => {
            if (controller.signal.aborted || response.aborted) return;
            setClock({ today: clinicToday(), now: clinicClock() });
            setResult({
                key: requestKey,
                ok: response.success,
                items: response.success ? response.items : [],
                free: free.flatMap((r) => (r.success && Array.isArray(r.data) ? r.data.map((x) => hhmm(x.slotStart)) : [])),
            });
        });
        return () => controller.abort();
    }, [week, doctorId, requestKey]);

    useEffect(() => {
        const controller = new AbortController();
        const config = { ...READ, signal: controller.signal };
        getDoctorOptions(config).then((response) => {
            if (!response.success || controller.signal.aborted) return;
            const items = Array.isArray(response.data) ? response.data : (response.data?.items ?? []);
            setDoctors(items.map((d) => [String(d.id), d.fullName]));
        });
        getBookableServices(config).then((response) => {
            if (!response.success || controller.signal.aborted) return;
            setServices((response.data ?? []).filter((s) => !s.isMandatory).map((s) => [String(s.serviceId), s.serviceName]));
        });
        return () => controller.abort();
    }, []);

    const { today, now } = clock;
    const current = result?.key === requestKey ? result : null;
    const appointments = (current?.items ?? result?.items ?? []).filter((a) => a.timeSlotStart && hasService(a, serviceId));
    const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
    const free = current?.free ?? result?.free ?? [];
    const step = slotStep([...free, ...appointments.map((a) => hhmm(a.timeSlotStart))]);
    const rows = scheduleRows(appointments, free, step);
    const nowRow = week === mondayOf(today) ? currentRow(rows, now) : null;
    const inCell = (day, time) => appointments.filter((a) => a.appointmentDate === day && rowOf(a.timeSlotStart, step) === time);
    const dayName = (day) => `${TEXT.WEEKDAYS[weekdayIndex(day)]} ${ddmm(day)}`;

    const openCell = (day, time, items) => {
        const slot = slotLabel(items[0]) || time;
        if (day === today) navigate(ROUTES.RECEPTION_CHECK_IN, { state: { slot, doctor: doctorId } });
        else navigate(ROUTES.RECEPTION_APPOINTMENTS, { state: { from: day, to: day, slot, doctor: doctorId, status: "" } });
    };

    const cell = (day, time) => {
        if (isSunday(day)) return <td key={day} className="h-14 border-b border-l border-border bg-surface-tint p-1" />;
        const items = inCell(day, time);
        const phase = slotPhase(day, time, today, now, step);
        const label = `${dayName(day)}, ${time}`;
        const tdClass = cx("h-14 border-b border-l border-border p-1 align-top", day === today && "bg-primary-softer", day === today && phase === "now" && "bg-warning-soft");
        if (!items.length) {
            return (
                <td key={day} className={tdClass}>
                    {phase === "future" && (
                        <button
                            type="button"
                            aria-label={TEXT.ADD_LABEL(dayName(day), time)}
                            onClick={() => setBooking({ date: day })}
                            className="grid h-full min-h-12 w-full place-items-center rounded-lg border border-dashed border-transparent text-title text-transparent hover:border-border-strong hover:bg-canvas hover:text-primary focus-visible:border-border-strong focus-visible:text-primary"
                        >
                            +
                        </button>
                    )}
                </td>
            );
        }
        const counts = CELL_KEYS.map((key) => [key, items.filter((a) => cellKeyOf(a, today) === key).length]).filter(([, n]) => n > 0);
        const lines = counts.map(([key, n]) => (
            <span key={key} className="flex items-center gap-1.5 whitespace-nowrap text-caption text-body">
                <i aria-hidden className={cx("size-2 shrink-0 rounded-full", CELL_DOT[key])} />
                {n} {TEXT.STATUS[key].toLowerCase()}
            </span>
        ));
        const boxClass = "flex h-full min-h-12 w-full flex-col gap-0.5 rounded-lg border px-2 py-1.5 text-left";
        if (day < today) {
            return (
                <td key={day} className={tdClass}>
                    <div aria-label={TEXT.CELL_LABEL(dayName(day), time, items.length)} className={cx(boxClass, "border-border bg-surface-tint")}>
                        {lines}
                    </div>
                </td>
            );
        }
        return (
            <td key={day} className={tdClass}>
                <button
                    type="button"
                    aria-label={TEXT.CELL_LABEL(dayName(day), time, items.length)}
                    title={label}
                    onClick={() => openCell(day, time, items)}
                    className={cx(
                        boxClass,
                        phase === "past" ? "border-border bg-surface-tint" : "border-primary bg-primary-soft hover:bg-canvas",
                        day === today && phase === "now" && "border-warning ring-1 ring-warning",
                    )}
                >
                    {lines}
                </button>
            </td>
        );
    };

    return (
        <div className="app-content min-h-full space-y-5">
            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-64 flex-1">
                    <Breadcrumb items={CRUMBS} className="mb-2" />
                    <h1 className="page-title">{TEXT.TITLE}</h1>
                    <p className="page-description">{TEXT.DESCRIPTION}</p>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => setBooking({})}>
                    {TEXT.BOOK}
                </button>
            </div>
            <Card>
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                    <div className="flex items-center gap-2.5 self-center">
                        <button type="button" className="btn btn-secondary btn-icon" aria-label={TEXT.PREV_WEEK} onClick={() => setWeek(addDays(week, -7))}>
                            <ChevronLeft className="size-4" aria-hidden="true" />
                        </button>
                        <b className="num whitespace-nowrap text-ink">
                            {dmy(days[0])} – {dmy(days[6])}
                        </b>
                        <button type="button" className="btn btn-secondary btn-icon" aria-label={TEXT.NEXT_WEEK} onClick={() => setWeek(addDays(week, 7))}>
                            <ChevronRight className="size-4" aria-hidden="true" />
                        </button>
                        {week !== mondayOf(today) && (
                            <button type="button" className="btn btn-secondary h-8 px-3 text-label" onClick={() => setWeek(mondayOf(today))}>
                                {TEXT.THIS_WEEK}
                            </button>
                        )}
                    </div>
                    <span className="flex-1" />
                    <LabeledSelect id="sch-doctor" label={TEXT.DOCTOR} value={doctorId} options={[["", TEXT.ALL_DOCTORS], ...doctors]} onChange={setDoctorId} />
                    <LabeledSelect id="sch-service" label={TEXT.SERVICE} value={serviceId} options={[["", TEXT.ALL_SERVICES], ...services]} onChange={setServiceId} />
                </div>
            </Card>
            {result && !result.ok && result.key === requestKey && (
                <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                    <span className="flex-1">{TEXT.LOAD_ERROR}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={() => setReload((n) => n + 1)}>
                        {TEXT.RETRY}
                    </button>
                </div>
            )}
            <Card>
                <div className={cx("overflow-x-auto", !current && "opacity-60")} aria-busy={!current ? "true" : undefined}>
                    <table className="w-full min-w-4xl table-fixed border-separate border-spacing-0">
                        <thead>
                            <tr>
                                <th className="w-16 border-b border-border bg-surface-tint" />
                                {days.map((day) => (
                                    <th
                                        key={day}
                                        className={cx(
                                            "border-b border-l border-border px-1.5 py-2.5 text-center font-medium",
                                            day === today ? "bg-primary-soft" : "bg-surface-tint",
                                        )}
                                    >
                                        <small className="block text-caption text-muted">{TEXT.WEEKDAYS_SHORT[weekdayIndex(day)]}</small>
                                        <b className={cx("num text-title", day === today ? "text-primary" : "text-ink")}>{day.slice(8)}</b>
                                        {(day === today || isSunday(day)) && (
                                            <em className={cx("block text-caption not-italic", day === today ? "text-primary" : "text-muted")}>
                                                {day === today ? TEXT.TODAY : TEXT.CLOSED}
                                            </em>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((time, index) => {
                                const gap = breakBefore(rows, index, step);
                                return (
                                <Fragment key={time}>
                                    {gap && (
                                        <tr>
                                            <th className="border-b border-border" />
                                            <td colSpan={7} className="border-b border-l border-border bg-surface-tint p-1.5 text-center text-caption text-muted">
                                                {TEXT.BREAK(gap.lunch, gap.from, gap.to)}
                                            </td>
                                        </tr>
                                    )}
                                    <tr>
                                        <th
                                            scope="row"
                                            className={cx("num border-b border-border p-2 text-right align-top text-caption font-medium", time === nowRow ? "font-bold text-warning" : "text-muted")}
                                        >
                                            {hhmm(time)}
                                        </th>
                                        {days.map((day) => cell(day, time))}
                                    </tr>
                                </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-caption text-muted">
                    {[
                        [TEXT.LEGEND_PAST, LEGEND.past],
                        [TEXT.LEGEND_TODAY, LEGEND.today],
                        [TEXT.LEGEND_FUTURE, LEGEND.future],
                    ].map(([title, keys]) => (
                        <span key={title} className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
                            <b className="font-semibold text-ink">{title}</b>
                            {keys.map((key) => (
                                <span key={key} className="inline-flex items-center gap-1.5">
                                    <i aria-hidden className={cx("size-2 rounded-full", CELL_DOT[key])} />
                                    {TEXT.STATUS[key]}
                                </span>
                            ))}
                        </span>
                    ))}
                </div>
            </Card>
            {booking && (
                <BookingDialog
                    initial={booking}
                    onClose={() => setBooking(null)}
                    onBooked={(a) => {
                        toast.success(TEXT.BOOKED(a.patientName, `${TEXT.WEEKDAYS_SHORT[weekdayIndex(a.appointmentDate)]} ${ddmm(a.appointmentDate)}`, hhmm(a.timeSlotStart)), { role: "status" });
                        setBooking(null);
                        setWeek(mondayOf(a.appointmentDate));
                        setReload((n) => n + 1);
                    }}
                />
            )}
        </div>
    );
};

export default ReceptionSchedule;

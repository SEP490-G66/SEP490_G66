import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import LabeledSelect from "@/components/ui/LabeledSelect";
import BookingDialog from "@/components/reception/BookingDialog";
import RowActions from "@/components/reception-dashboard/RowActions";
import ConfirmAppointmentDialog from "@/components/reception/ConfirmAppointmentDialog";
import ConfirmCallDialog from "@/components/reception/ConfirmCallDialog";
import ServiceCell from "@/components/reception/ServiceCell";
import { Card, CancelDialog, RescheduleDialog } from "@/components/reception/shared";
import { phoneText, report, usePaging } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import {
    cancelAppointment,
    clinicToday,
    confirmAppointment,
    getAppointmentsInRange,
    getDoctorOptions,
    recordConfirmCall,
} from "@/services/receptionService";
import { addDays, ddmm, hhmm } from "@/utils/calendar";
import { allergiesOf, appointmentMenu, matchesKeyword, serviceNames, slotOf } from "@/utils/checkIn";
import { CONFIRM_STATES, callBackText, confirmDefaults, confirmStateOf, isConfirmFiltered, matchesConfirmState, shortDate, sortByVisit } from "@/utils/confirmAppointments";
import { CONFIRM_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const READ = { skipErrorPage: true };
const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.TITLE }];
const STATUS_OPTIONS = [["need", TEXT.NEEDS_CONFIRM], ["", TEXT.ALL_STATUSES], ...CONFIRM_STATES.map((key) => [key, TEXT.STATES[key][0]])];
const WIDTHS = ["128px", "", "136px", "190px", "", "150px", "150px"];

const ReceptionConfirm = () => {
    const { state: navState } = useLocation();
    const [today] = useState(clinicToday);
    const defaults = confirmDefaults(today);
    const [filters, setFilters] = useState(() => ({
        ...defaults,
        ...Object.fromEntries(["from", "to", "slot", "doctor", "status"].filter((k) => navState?.[k] != null).map((k) => [k, navState[k]])),
    }));
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [doctorList, setDoctorList] = useState([]);
    const [dialog, setDialog] = useState(null);
    const [filtersOpen, setFiltersOpen] = useState(false);

    usePageTitle(TEXT.DOC_TITLE);

    const requestKey = `${filters.from}|${filters.to}|${reload}`;

    useEffect(() => {
        const controller = new AbortController();
        getAppointmentsInRange({ fromDate: filters.from, toDate: filters.to }, { ...READ, signal: controller.signal }).then((response) => {
            if (controller.signal.aborted || response.aborted) return;
            setResult({ key: requestKey, ok: response.success, items: response.success ? response.items : [] });
        });
        return () => controller.abort();
    }, [filters.from, filters.to, requestKey]);

    useEffect(() => {
        const controller = new AbortController();
        getDoctorOptions({ ...READ, signal: controller.signal }).then((response) => {
            if (!response.success || controller.signal.aborted) return;
            const items = Array.isArray(response.data) ? response.data : (response.data?.items ?? []);
            setDoctorList(items.map((d) => [String(d.id), d.fullName]));
        });
        return () => controller.abort();
    }, []);

    const current = result?.key === requestKey ? result : null;
    const appointments = (current?.items ?? result?.items ?? []).filter((a) => a.appointmentDate > today);
    const slotOptions = [["", TEXT.ALL_SLOTS], ...[...new Set(appointments.map(slotOf).filter(Boolean))].sort().map((s) => [s, s])];
    const known = new Map(doctorList);
    appointments.forEach((a) => a.doctorId && !known.has(String(a.doctorId)) && known.set(String(a.doctorId), a.doctorName));
    const doctorOptions = [["", TEXT.ALL_DOCTORS], ...known.entries()];

    const shown = sortByVisit(
        appointments.filter(
            (a) =>
                matchesKeyword(a, filters.keyword) &&
                (!filters.slot || slotOf(a) === filters.slot) &&
                (!filters.doctor || String(a.doctorId) === filters.doctor) &&
                matchesConfirmState(a, filters.status),
        ),
    );
    const { pageItems, footer, setPage } = usePaging(shown, 10);
    const filtered = isConfirmFiltered(filters, defaults);

    const setFilter = (key) => (value) => {
        setFilters((f) => {
            const next = { ...f, [key]: value };
            if (key === "from" && next.to < value) next.to = value;
            if (key === "to" && next.from > value) next.from = value;
            return next;
        });
        setPage(1);
    };
    const clearFilters = () => {
        setFilters(defaults);
        setPage(1);
    };

    const act = async (request, successText) => {
        if (report(await request, successText)) {
            setDialog(null);
            setReload((n) => n + 1);
        }
    };

    const close = () => setDialog(null);
    const a = dialog?.item;

    const actions = (row, state) => {
        if (state === "cancelled") return null;
        const open = (type) => () => setDialog({ type, item: row });
        return (
            <RowActions
                name={row.patientName}
                primary={state !== "confirmed" ? { label: TEXT.CONFIRM, onClick: open("confirm") } : null}
                items={appointmentMenu(row, { open })}
            />
        );
    };

    const body = () => {
        if (!result) return <p className="px-6 py-10 text-center text-body-sm text-muted">{TEXT.LOADING}</p>;
        if (!shown.length)
            return (
                <p className="px-6 py-10 text-center text-body-sm text-muted">
                    {TEXT.EMPTY}{" "}
                    {filtered && (
                        <button type="button" className="btn-link" onClick={clearFilters}>
                            {TEXT.CLEAR_FILTERS}
                        </button>
                    )}
                </p>
            );
        return (
            <div className={cx("table-wrap rounded-none border-0", !current && "opacity-60")} aria-busy={!current ? "true" : undefined}>
                <table className="table table-stack table-fixed-acts [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle [&_th]:px-3">
                    <colgroup>
                        {WIDTHS.map((w, i) => (
                            <col key={i} style={w ? { width: w } : undefined} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            {TEXT.COLUMNS.map((c, i) => (
                                <th key={c}>{i === TEXT.COLUMNS.length - 1 ? <span className="sr-only">{c}</span> : c}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pageItems.map((row) => {
                            const state = confirmStateOf(row);
                            const [label, badge] = TEXT.STATES[state];
                            const allergies = allergiesOf(row);
                            const when = state === "callback" ? callBackText(row) : null;
                            return (
                                <tr key={row.id} className={state === "cancelled" ? "opacity-60" : undefined}>
                                    <td data-label={TEXT.COLUMNS[0]} className="num whitespace-nowrap [overflow-wrap:normal]">
                                        <div>
                                            <span className="font-semibold text-ink">{shortDate(row.appointmentDate)}</span>
                                            {row.timeSlotStart && <small className="block text-caption text-muted">{TEXT.SLOT_LINE(slotOf(row))}</small>}
                                        </div>
                                    </td>
                                    <td data-primary>
                                        <span className="cell-primary block">{row.patientName}</span>
                                        {row.patientCode && <small className="block text-caption text-muted">{row.patientCode}</small>}
                                        {allergies.length > 0 && <span className="badge badge-danger mt-1 flex w-fit whitespace-normal">{TEXT.ALLERGY(allergies.join(", "))}</span>}
                                    </td>
                                    <td data-label={TEXT.COLUMNS[2]} className="num whitespace-nowrap [overflow-wrap:normal]">
                                        {phoneText(row.patientPhoneNumber)}
                                    </td>
                                    <td data-label={TEXT.COLUMNS[3]}>{row.doctorName ?? TEXT.NO_DOCTOR}</td>
                                    <td data-label={TEXT.COLUMNS[4]}>
                                        <ServiceCell names={serviceNames(row)} />
                                    </td>
                                    <td data-label={TEXT.COLUMNS[5]}>
                                        <div>
                                            <span className={cx("badge", badge, state === "cancelled" && "line-through")}>{label}</span>
                                            {when && <small className="block pt-0.5 text-caption text-muted">{TEXT.CALL_BACK_AT(when)}</small>}
                                        </div>
                                    </td>
                                    <td data-actions>{actions(row, state)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
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
                <button type="button" className="btn btn-primary max-md:w-full" onClick={() => setDialog({ type: "book" })}>
                    {TEXT.BOOK}
                </button>
            </div>
            <Card>
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                    <button type="button" className="btn btn-secondary w-full md:hidden" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
                        {TEXT.FILTERS}
                    </button>
                    <div className={cx("contents", !filtersOpen && "max-md:hidden")}>
                        {[
                            ["from", TEXT.FROM],
                            ["to", TEXT.TO],
                        ].map(([key, label]) => (
                            <div key={key} className="flex flex-col gap-1">
                                <label htmlFor={`cf-${key}`} className="text-caption text-muted">
                                    {label}
                                </label>
                                <input
                                    id={`cf-${key}`}
                                    type="date"
                                    className="input w-auto"
                                    min={addDays(today, 1)}
                                    value={filters[key]}
                                    onChange={(e) => e.target.value && setFilter(key)(e.target.value)}
                                />
                            </div>
                        ))}
                        <LabeledSelect id="cf-slot" label={TEXT.SLOT} value={filters.slot} options={slotOptions} onChange={setFilter("slot")} />
                        <LabeledSelect id="cf-doctor" label={TEXT.DOCTOR} value={filters.doctor} options={doctorOptions} onChange={setFilter("doctor")} />
                        <LabeledSelect id="cf-status" label={TEXT.STATUS} value={filters.status} options={STATUS_OPTIONS} onChange={setFilter("status")} />
                    </div>
                    <div className="flex min-w-48 flex-1 flex-col gap-1">
                        <label htmlFor="cf-search" className="text-caption text-muted">
                            {TEXT.PATIENT}
                        </label>
                        <input
                            id="cf-search"
                            type="search"
                            className="input"
                            placeholder={TEXT.SEARCH_PLACEHOLDER}
                            value={filters.keyword}
                            onChange={(e) => setFilter("keyword")(e.target.value)}
                        />
                    </div>
                    {filtered && (
                        <button type="button" className="btn-link h-control" onClick={clearFilters}>
                            {TEXT.CLEAR_FILTERS}
                        </button>
                    )}
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
                {body()}
                {footer}
            </Card>

            {dialog?.type === "confirm" && <ConfirmAppointmentDialog appointment={a} onClose={close} onSubmit={() => act(confirmAppointment(a.id), TEXT.CONFIRMED(a.patientName))} />}
            {dialog?.type === "call" && (
                <ConfirmCallDialog
                    appointment={a}
                    today={today}
                    onClose={close}
                    onSubmit={(v) => {
                        const when = `${ddmm(v.callBackDate)} ${v.callBackTime}`;
                        return act(recordConfirmCall(a.id, v), v.outcome === "CallBack" ? TEXT.WILL_CALL_BACK(a.patientName, when) : TEXT.NO_ANSWER(a.patientName, when));
                    }}
                />
            )}
            {dialog?.type === "reschedule" && (
                <RescheduleDialog
                    appointment={a}
                    onClose={close}
                    onDone={() => {
                        setDialog(null);
                        setReload((n) => n + 1);
                    }}
                />
            )}
            {dialog?.type === "cancel" && <CancelDialog appointment={a} onClose={close} onSubmit={(reason) => act(cancelAppointment(a.id, reason), TEXT.CANCELLED(a.patientName))} />}
            {dialog?.type === "book" && (
                <BookingDialog
                    initial={{ date: addDays(today, 1) }}
                    onClose={close}
                    onBooked={(booked) => {
                        toast.success(TEXT.BOOKED(booked.patientName, shortDate(booked.appointmentDate), hhmm(booked.timeSlotStart)), { role: "status" });
                        setDialog(null);
                        setReload((n) => n + 1);
                    }}
                />
            )}
        </div>
    );
};

export default ReceptionConfirm;

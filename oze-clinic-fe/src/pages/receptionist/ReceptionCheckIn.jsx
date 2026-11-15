import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import LabeledSelect from "@/components/ui/LabeledSelect";
import BookingDialog from "@/components/reception/BookingDialog";
import ConfirmActionDialog from "@/components/billing/ConfirmActionDialog";
import RowActions from "@/components/reception-dashboard/RowActions";
import CheckInDialog from "@/components/reception/CheckInDialog";
import ConfirmAppointmentDialog from "@/components/reception/ConfirmAppointmentDialog";
import ConfirmCallDialog from "@/components/reception/ConfirmCallDialog";
import ServiceCell from "@/components/reception/ServiceCell";
import { Card, CancelDialog, RescheduleDialog, WalkInDialog } from "@/components/reception/shared";
import { clinicClock, phoneText, report, useDoctorsOnDuty, usePaging, weekdayDate } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import {
    cancelAppointment,
    checkInAppointment,
    clinicToday,
    confirmAppointment,
    createWalkIn,
    getDoctorOptions,
    getTodayAppointments,
    getWaitingList,
    markNoShow,
    recordConfirmCall,
    rescheduleAppointment,
} from "@/services/receptionService";
import { ddmm, hhmm } from "@/utils/calendar";
import {
    EMPTY_CHECK_IN_FILTERS,
    STATE_ORDER,
    allergiesOf,
    appointmentMenu,
    confirmNoteOf,
    isLate,
    isFilteredCheckIn,
    matchesKeyword,
    serviceNames,
    slotOf,
    sortCheckIn,
    stateOf,
} from "@/utils/checkIn";
import { CHECK_IN_TEXT as TEXT, CONFIRM_TEXT, DASHBOARD_TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.TITLE }];
const ENDED = ["Ended", "OnLeave"];
const STATUS_OPTIONS = [["", TEXT.ALL_STATUSES], ...STATE_ORDER.map((key) => [key, TEXT.STATES[key][0]])];
const WIDTHS = ["120px", "", "136px", "180px", "", "150px", "150px"];

const ReceptionCheckIn = () => {
    const { state: navState } = useLocation();
    const [result, setResult] = useState(null);
    const [version, setVersion] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [waiting, setWaiting] = useState([]);
    const [doctorList, setDoctorList] = useState([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filters, setFilters] = useState(() => ({ ...EMPTY_CHECK_IN_FILTERS, slot: navState?.slot ?? "", doctor: navState?.doctor ?? "" }));
    const { doctors, available } = useDoctorsOnDuty(version);
    const endedIds = new Set(doctors.filter((d) => ENDED.includes(d.status)).map((d) => d.id));

    usePageTitle(TEXT.DOC_TITLE);

    useEffect(() => {
        let active = true;
        Promise.all([getTodayAppointments(), getWaitingList()]).then(([today, queue]) => {
            if (!active) return;
            setResult({ ok: today.success, items: today.success ? (today.data?.items ?? []) : [] });
            setWaiting(queue.success && Array.isArray(queue.data) ? queue.data : []);
        });
        return () => {
            active = false;
        };
    }, [version]);

    useEffect(() => {
        const controller = new AbortController();
        getDoctorOptions({ skipErrorPage: true, signal: controller.signal }).then((response) => {
            if (!response.success || controller.signal.aborted) return;
            const items = Array.isArray(response.data) ? response.data : (response.data?.items ?? []);
            setDoctorList(items.map((d) => [String(d.id), d.fullName]));
        });
        return () => controller.abort();
    }, []);

    const reload = useCallback(() => setVersion((v) => v + 1), []);
    const act = async (request, successText) => {
        if (report(await request, successText)) {
            setDialog(null);
            reload();
        }
    };

    const appointments = result?.items ?? [];
    const now = clinicClock();
    const pendingCount = appointments.filter((a) => stateOf(a) === "notyet").length;
    const slotOptions = [["", TEXT.ALL_SLOTS], ...[...new Set(appointments.map(slotOf).filter(Boolean))].sort().map((s) => [s, s])];
    const known = new Map(doctorList);
    appointments.forEach((a) => a.doctorId && !known.has(String(a.doctorId)) && known.set(String(a.doctorId), a.doctorName));
    const doctorOptions = [["", TEXT.ALL_DOCTORS], ...known.entries()];

    const shown = sortCheckIn(
        appointments.filter(
            (a) =>
                matchesKeyword(a, filters.keyword) &&
                (!filters.slot || slotOf(a) === filters.slot) &&
                (!filters.doctor || String(a.doctorId) === filters.doctor) &&
                (!filters.status || stateOf(a) === filters.status),
        ),
    );
    const { pageItems, footer, setPage } = usePaging(shown, 10);
    const filtered = isFilteredCheckIn(filters);
    const setFilter = (key) => (value) => {
        setFilters((current) => ({ ...current, [key]: value }));
        setPage(1);
    };
    const clearFilters = () => {
        setFilters(EMPTY_CHECK_IN_FILTERS);
        setPage(1);
    };

    const body = () => {
        if (!result) return <p className="px-6 py-10 text-center text-body-sm text-muted">{TEXT.LOADING}</p>;
        if (!shown.length)
            return (
                <p className="px-6 py-10 text-center text-body-sm text-muted">
                    {appointments.length ? TEXT.EMPTY_FILTERED : TEXT.EMPTY_DAY}{" "}
                    {filtered && (
                        <button type="button" className="btn-link" onClick={clearFilters}>
                            {TEXT.CLEAR_FILTERS}
                        </button>
                    )}
                </p>
            );
        return (
            <div className="table-wrap rounded-none border-0">
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
                        {pageItems.map((a) => {
                            const state = stateOf(a);
                            const note = confirmNoteOf(a);
                            const [label, badge] = TEXT.STATES[state];
                            const allergies = allergiesOf(a);
                            const late = isLate(a, now);
                            return (
                                <tr key={a.id} className={state === "cancelled" ? "opacity-60" : undefined}>
                                    <td data-label={TEXT.COLUMNS[0]} className="num whitespace-nowrap [overflow-wrap:normal]">
                                        <div>
                                            <span className="font-semibold text-ink">{slotOf(a) || TEXT.WALK_IN_SLOT}</span>
                                            {late && <small className="block text-caption font-semibold text-warning">{TEXT.LATE}</small>}
                                        </div>
                                    </td>
                                    <td data-primary>
                                        <span className="cell-primary block">{a.patientName}</span>
                                        {a.patientCode && <small className="block text-caption text-muted">{a.patientCode}</small>}
                                        {allergies.length > 0 && <span className="badge badge-danger mt-1 flex w-fit whitespace-normal">{TEXT.ALLERGY(allergies.join(", "))}</span>}
                                    </td>
                                    <td data-label={TEXT.COLUMNS[2]} className="num whitespace-nowrap [overflow-wrap:normal]">
                                        {phoneText(a.patientPhoneNumber)}
                                    </td>
                                    <td data-label={TEXT.COLUMNS[3]}>
                                        <div>
                                            {a.doctorName ?? TEXT.NO_DOCTOR}
                                            {state === "notyet" && endedIds.has(a.doctorId) && <small className="block text-caption text-danger">{TEXT.DOCTOR_ENDED}</small>}
                                        </div>
                                    </td>
                                    <td data-label={TEXT.COLUMNS[4]}>
                                        <ServiceCell names={serviceNames(a)} />
                                    </td>
                                    <td data-label={TEXT.COLUMNS[5]}>
                                        <div>
                                            <span className={cx("badge", badge)}>{label}</span>
                                            {state === "notyet" && note && <small className="block pt-0.5 text-caption text-muted">{TEXT.CONFIRM_NOTE[note]}</small>}
                                        </div>
                                    </td>
                                    <td data-actions>
                                        {state === "notyet" && (
                                            <RowActions
                                                name={a.patientName}
                                                primary={{ label: TEXT.CHECK_IN, onClick: () => setDialog({ type: "checkIn", item: a }) }}
                                                items={appointmentMenu(a, { isToday: true, late, open: (type) => () => setDialog({ type, item: a }) })}
                                            />
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    const a = dialog?.item;

    return (
        <div className="app-content min-h-full space-y-5">
            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-64 flex-1">
                    <Breadcrumb items={CRUMBS} className="mb-2" />
                    <h1 className="page-title">{TEXT.TITLE}</h1>
                    <p className="page-description first-letter:uppercase">{TEXT.DESCRIPTION(weekdayDate(clinicToday()), pendingCount)}</p>
                </div>
                <div className="flex gap-3 max-md:w-full max-md:[&>*]:flex-1">
                    <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "book" })}>
                        {TEXT.BOOK}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => setDialog({ type: "walkIn" })} disabled={available.length === 0}>
                        {TEXT.WALK_IN}
                    </button>
                </div>
            </div>
            <Card>
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                    <button type="button" className="btn btn-secondary w-full md:hidden" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
                        {TEXT.FILTERS}
                    </button>
                    <div className={cx("contents", !filtersOpen && "max-md:hidden")}>
                        <LabeledSelect id="ci-slot" label={TEXT.SLOT} value={filters.slot} options={slotOptions} onChange={setFilter("slot")} />
                        <LabeledSelect id="ci-doctor" label={TEXT.DOCTOR} value={filters.doctor} options={doctorOptions} onChange={setFilter("doctor")} />
                        <LabeledSelect id="ci-status" label={TEXT.STATUS} value={filters.status} options={STATUS_OPTIONS} onChange={setFilter("status")} />
                    </div>
                    <div className="flex min-w-64 flex-1 flex-col gap-1">
                        <label htmlFor="ci-search" className="text-caption text-muted">
                            {TEXT.PATIENT}
                        </label>
                        <input
                            id="ci-search"
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
            {result && !result.ok && (
                <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                    <span className="flex-1">{TEXT.LOAD_ERROR}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={reload}>
                        {TEXT.RETRY}
                    </button>
                </div>
            )}
            <Card>
                {body()}
                {footer}
            </Card>

            {dialog?.type === "checkIn" && (
                <CheckInDialog
                    appointment={a}
                    doctors={doctors}
                    waiting={waiting}
                    onClose={() => setDialog(null)}
                    onSubmit={(v) => act(checkInAppointment(a.id, v), TEXT.CHECKED_IN(a.patientName, v.room))}
                />
            )}
            {dialog?.type === "confirm" && (
                <ConfirmAppointmentDialog appointment={a} onClose={() => setDialog(null)} onSubmit={() => act(confirmAppointment(a.id), CONFIRM_TEXT.CONFIRMED(a.patientName))} />
            )}
            {dialog?.type === "call" && (
                <ConfirmCallDialog
                    appointment={a}
                    today={clinicToday()}
                    onClose={() => setDialog(null)}
                    onSubmit={(v) => {
                        const when = `${ddmm(v.callBackDate)} ${v.callBackTime}`;
                        return act(recordConfirmCall(a.id, v), v.outcome === "CallBack" ? CONFIRM_TEXT.WILL_CALL_BACK(a.patientName, when) : CONFIRM_TEXT.NO_ANSWER(a.patientName, when));
                    }}
                />
            )}
            {dialog?.type === "noShow" && (
                <ConfirmActionDialog
                    title={DASHBOARD_TEXT.NO_SHOW_TITLE}
                    description={DASHBOARD_TEXT.NO_SHOW_SUB(a.patientName, hhmm(a.timeSlotStart))}
                    body={DASHBOARD_TEXT.NO_SHOW_BODY(slotOf(a), a.doctorName)}
                    closeLabel={TEXT.CLOSE}
                    submitLabel={DASHBOARD_TEXT.ACT_NO_SHOW}
                    onClose={() => setDialog(null)}
                    onSubmit={() => act(markNoShow(a.id), DASHBOARD_TEXT.NO_SHOW_DONE(a.patientName))}
                />
            )}
            {dialog?.type === "reschedule" && (
                <RescheduleDialog appointment={a} onClose={() => setDialog(null)} onSubmit={(v) => act(rescheduleAppointment(a.id, v), TEXT.RESCHEDULED(a.patientName))} />
            )}
            {dialog?.type === "cancel" && (
                <CancelDialog appointment={a} onClose={() => setDialog(null)} onSubmit={(reason) => act(cancelAppointment(a.id, reason), TEXT.CANCELLED(a.patientName))} />
            )}
            {dialog?.type === "walkIn" && (
                <WalkInDialog doctors={available} onClose={() => setDialog(null)} onSubmit={(request) => act(createWalkIn(request), TEXT.WALKED_IN(request.fullName))} />
            )}
            {dialog?.type === "book" && (
                <BookingDialog
                    initial={{ date: clinicToday() }}
                    onClose={() => setDialog(null)}
                    onBooked={(booked) => {
                        toast.success(TEXT.BOOKED(booked.patientName, hhmm(booked.timeSlotStart)), { role: "status" });
                        setDialog(null);
                        reload();
                    }}
                />
            )}
        </div>
    );
};

export default ReceptionCheckIn;

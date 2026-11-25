import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import LabeledSelect from "@/components/ui/LabeledSelect";
import BookingDialog from "@/components/reception/BookingDialog";
import RowActions from "@/components/reception-dashboard/RowActions";
import CheckInDialog from "@/components/reception/CheckInDialog";
import ServiceCell from "@/components/reception/ServiceCell";
import { Card, CancelDialog, RescheduleDialog, WalkInDialog } from "@/components/reception/shared";
import { clinicClock, clockOf, phoneText, report, useDoctorsOnDuty, usePaging, weekdayDate } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import {
    cancelAppointment,
    checkInAppointment,
    clinicToday,
    createWalkIn,
    getDoctorOptions,
    getTodayAppointments,
    getWaitingList,
} from "@/services/receptionService";
import { hhmm } from "@/utils/calendar";
import {
    EMPTY_CHECK_IN_FILTERS,
    STATE_ORDER,
    allergiesOf,
    appointmentMenu,
    isDoctorAway,
    isFilteredCheckIn,
    isLate,
    matchesKeyword,
    serviceNames,
    slotOf,
    sortCheckIn,
    stateOf,
} from "@/utils/checkIn";
import { CHECK_IN_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.TITLE }];
const READ = { skipErrorPage: true };
// Rows with nothing left to do recede, so the ones that need action stand out
const DONE_STATES = ["checkedin", "serving", "done", "noshow", "cancelled"];
const STATUS_OPTIONS = [["", TEXT.ALL_STATUSES], ...STATE_ORDER.map((key) => [key, TEXT.STATES[key][0]])];
const WIDTHS = ["120px", "", "136px", "180px", "", "150px", "150px"];
const REFRESH_MS = 20_000;

const ReceptionCheckIn = () => {
    const { state: navState } = useLocation();
    const [result, setResult] = useState(null);
    const [version, setVersion] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [waiting, setWaiting] = useState([]);
    const [doctorList, setDoctorList] = useState([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filters, setFilters] = useState(() => ({ ...EMPTY_CHECK_IN_FILTERS, slot: navState?.slot ?? "", doctor: navState?.doctor ?? "" }));
    const { doctors, available, loaded: doctorsLoaded } = useDoctorsOnDuty(version);
    const doctorOf = new Map(doctors.map((d) => [d.id, d]));
    const acting = useRef(false);
    const focusAfter = useRef(null);

    usePageTitle(TEXT.DOC_TITLE);

    useEffect(() => {
        let active = true;
        Promise.all([getTodayAppointments(READ), getWaitingList(READ)]).then(([today, queue]) => {
            if (!active) return;
            setResult((prev) => (today.success ? { ok: true, items: today.data?.items ?? [], at: new Date().toISOString() } : { ok: false, items: prev?.items ?? [], at: prev?.at ?? null }));
            setWaiting(queue.success && Array.isArray(queue.data) ? queue.data : null);
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

    useEffect(() => {
        if (dialog) return undefined;
        const timer = setInterval(reload, REFRESH_MS);
        return () => clearInterval(timer);
    }, [dialog, reload]);
    // request: a function, so a second click while one is running sends nothing
    const act = async (request, successText, next) => {
        if (acting.current) return;
        acting.current = true;
        try {
            const result = await request();
            if (report(result, typeof successText === "function" ? successText(result.data ?? {}) : successText)) {
                setDialog(null);
                focusAfter.current = next ?? "heading";
                reload();
            }
        } finally {
            acting.current = false;
        }
    };

    // After a row changes, keyboard focus moves to the next patient to check in (or to the title), not to the top of the page
    useEffect(() => {
        const next = focusAfter.current;
        if (!next || !result) return;
        focusAfter.current = null;
        const button = next !== "heading" && document.querySelector(`[data-row-action="checkin-${next}"]`);
        (button || document.getElementById("checkin-title"))?.focus();
    }, [result]);

    const appointments = (result?.items ?? []).filter((a) => a.status !== "PENDING");
    const pendingCount = appointments.filter((a) => stateOf(a) === "notyet").length;
    const now = clinicClock();
    const checkedInText = (a) => (data) => TEXT.CHECKED_IN(a.patientName, data.queueNumber, data.roomName);
    const startCheckIn = (a) => {
        if (isDoctorAway(a, doctors, doctorsLoaded)) setDialog({ type: "checkIn", item: a });
        else act(() => checkInAppointment(a.id), checkedInText(a), nextAfter(a.id));
    };
    // The next patient still to check in after this one, in the order on screen
    const nextAfter = (id) => {
        const pending = shown.filter((x) => stateOf(x) === "notyet");
        const index = pending.findIndex((x) => x.id === id);
        if (index < 0) return null;
        return pending[index + 1]?.id ?? pending[index - 1]?.id ?? null;
    };
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
        // A failed load is not an empty day: "no appointments, take them as walk-ins" would book people twice
        if (!result.ok && !appointments.length) return <p className="px-6 py-10 text-center text-body-sm text-muted">{TEXT.LOAD_ERROR_EMPTY}</p>;
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
                            const [label, badge] = TEXT.STATES[state];
                            const allergies = allergiesOf(a);
                            const doctor = doctorOf.get(a.doctorId);
                            const done = DONE_STATES.includes(state);
                            return (
                                <tr key={a.id} className={cx(done && "text-muted")}>
                                    <td data-label={TEXT.COLUMNS[0]} className="num whitespace-nowrap [overflow-wrap:normal]">
                                        <span className={done ? "text-muted" : "font-semibold text-ink"}>{slotOf(a) || TEXT.WALK_IN_SLOT}</span>
                                        {isLate(a, now) && <small className="block font-normal text-caption text-warning">{TEXT.LATE}</small>}
                                    </td>
                                    <td data-primary>
                                        <span className={cx("cell-primary block", done && "font-normal text-body", state === "cancelled" && "line-through")}>{a.patientName}</span>
                                        {a.patientCode && <small className="block text-caption text-muted">{a.patientCode}</small>}
                                        {allergies.length > 0 && <span className="badge badge-danger mt-1 flex w-fit whitespace-normal">{TEXT.ALLERGY(allergies.join(", "))}</span>}
                                    </td>
                                    <td data-label={TEXT.COLUMNS[2]} className="num whitespace-nowrap [overflow-wrap:normal]">
                                        {phoneText(a.patientPhoneNumber)}
                                    </td>
                                    <td data-label={TEXT.COLUMNS[3]}>
                                        <div>
                                            {a.doctorName ?? TEXT.NO_DOCTOR}
                                            {state === "notyet" && doctor?.status === "Ended" && (
                                                <small className="block text-caption font-semibold text-danger">{TEXT.DOCTOR_ENDED(doctor.endedAt ?? doctor.end)}</small>
                                            )}
                                            {state === "notyet" && doctor?.status === "OnLeave" && (
                                                <small className="block text-caption font-semibold text-danger">{TEXT.DOCTOR_ON_LEAVE}</small>
                                            )}
                                        </div>
                                    </td>
                                    <td data-label={TEXT.COLUMNS[4]}>
                                        <ServiceCell names={serviceNames(a)} />
                                    </td>
                                    <td data-label={TEXT.COLUMNS[5]}>
                                        <span className={cx("badge", badge)}>{label}</span>
                                    </td>
                                    <td data-actions>
                                        {state === "notyet" && (
                                            <RowActions
                                                name={a.patientName}
                                                primary={{
                                                    label: TEXT.CHECK_IN,
                                                    ariaLabel: TEXT.CHECK_IN_FOR(a.patientName),
                                                    id: `checkin-${a.id}`,
                                                    onClick: () => startCheckIn(a),
                                                }}
                                                items={appointmentMenu(a, { open: (type) => () => setDialog({ type, item: a }) })}
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
                    <h1 id="checkin-title" tabIndex={-1} className="page-title focus:outline-none">
                        {TEXT.TITLE}
                    </h1>
                    <p className="page-description first-letter:uppercase">{TEXT.DESCRIPTION(weekdayDate(clinicToday()), pendingCount)}</p>
                </div>
                <div className="flex gap-3 max-md:w-full max-md:[&>*]:flex-1">
                    <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "book" })}>
                        {TEXT.BOOK}
                    </button>
                    {/* On this screen the row "Check-in" buttons are the main action, so walk-in is secondary */}
                    <button
                        type="button"
                        className="btn btn-secondary aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                        onClick={() => available.length > 0 && setDialog({ type: "walkIn" })}
                        aria-disabled={available.length === 0}
                        aria-describedby={doctorsLoaded && available.length === 0 ? "checkin-walkin-hint" : undefined}
                    >
                        {TEXT.WALK_IN}
                    </button>
                </div>
                {doctorsLoaded && available.length === 0 && (
                    <small id="checkin-walkin-hint" className="w-full text-right text-caption text-muted">
                        {TEXT.NO_DOCTOR_HINT}
                    </small>
                )}
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
                {result?.at && <p className="px-4 pb-3 text-caption text-muted">{TEXT.UPDATED_AT(clockOf(result.at))}</p>}
            </Card>

            {dialog?.type === "checkIn" && (
                <CheckInDialog
                    appointment={a}
                    doctors={doctors}
                    waiting={waiting}
                    onClose={() => setDialog(null)}
                    onReschedule={() => setDialog({ type: "reschedule", item: a })}
                    onCancel={() => setDialog({ type: "cancel", item: a })}
                    onSubmit={(v) => act(() => checkInAppointment(a.id, v), checkedInText(a), nextAfter(a.id))}
                />
            )}
            {dialog?.type === "reschedule" && (
                <RescheduleDialog
                    appointment={a}
                    onClose={() => setDialog(null)}
                    onDone={() => {
                        setDialog(null);
                        focusAfter.current = nextAfter(a.id) ?? "heading";
                        reload();
                    }}
                />
            )}
            {dialog?.type === "cancel" && (
                <CancelDialog appointment={a} onClose={() => setDialog(null)} onSubmit={(reason) => act(() => cancelAppointment(a.id, reason), TEXT.CANCELLED(a.patientName), nextAfter(a.id))} />
            )}
            {dialog?.type === "walkIn" && (
                <WalkInDialog doctors={available} waiting={waiting} onClose={() => setDialog(null)} onSubmit={(request) => act(() => createWalkIn(request), TEXT.WALKED_IN(request.fullName))} />
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

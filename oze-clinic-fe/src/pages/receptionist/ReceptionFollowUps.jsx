import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import LabeledSelect from "@/components/ui/LabeledSelect";
import Pagination from "@/components/ui/Pagination";
import RowMenu from "@/components/ui/RowMenu";
import FollowUpConfirmDialog from "@/components/reception/FollowUpConfirmDialog";
import FollowUpDeclineDialog from "@/components/reception/FollowUpDeclineDialog";
import FollowUpScheduleDialog from "@/components/reception/FollowUpScheduleDialog";
import { Card } from "@/components/reception/shared";
import { phoneText } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { appointmentErrorText, clinicToday, getDoctorOptions, getFollowUpList, remindFollowUp } from "@/services/receptionService";
import { FOLLOW_UP_TEXT as TEXT } from "@/utils/messages";
import { slotRange } from "@/utils/booking";
import { dmy } from "@/utils/calendar";
import { formatClock, getClinicDateTimeParts } from "@/utils/format";
import { EMPTY_FILTERS, FOLLOW_UP_PAGE_SIZE, STATE_CHIPS, doctorOf, dueDateOf, followUpQuery, isFiltered, remindUnlockAt, remindedText, rowState, slotOf } from "@/utils/followUp";
import { cx } from "@/utils/cx";

const READ = { skipErrorPage: true };
const SEARCH_DELAY_MS = 300;
const SKELETON_ROWS = [1, 2, 3, 4, 5];
const COLUMN_COUNT = 8;
const CLOCK_TICK_MS = 60_000;
const C = TEXT.COLUMNS;
const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.TITLE }];

const clockOf = (value) => {
    const parts = getClinicDateTimeParts(value);
    return { day: parts.date.slice(0, 5), time: parts.time.slice(0, 5) };
};

const ReceptionFollowUps = () => {
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [search, setSearch] = useState("");
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [dialog, setDialog] = useState(null);
    const [needCount, setNeedCount] = useState(null);
    const [reminding, setReminding] = useState(null);
    const [now, setNow] = useState(() => Date.now());
    const timer = useRef(null);

    usePageTitle(TEXT.DOC_TITLE);

    const requestKey = `${JSON.stringify(filters)}|${reload}`;

    useEffect(() => {
        const controller = new AbortController();
        getFollowUpList(followUpQuery(filters, clinicToday()), { ...READ, signal: controller.signal }).then((response) => {
            if (response.aborted || controller.signal.aborted) return;
            setResult({ key: requestKey, ok: response.success, data: response.success ? response.data : null });
        });
        return () => controller.abort();
    }, [filters, requestKey]);

    useEffect(() => {
        const controller = new AbortController();
        getFollowUpList({ state: "need", page: 1, pageSize: 1 }, { ...READ, signal: controller.signal }).then((response) => {
            if (response.aborted || controller.signal.aborted) return;
            setNeedCount(response.success ? Number(response.data?.totalCount ?? 0) : null);
        });
        return () => controller.abort();
    }, [reload]);

    useEffect(() => {
        const tick = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
        return () => clearInterval(tick);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        getDoctorOptions({ ...READ, signal: controller.signal }).then((response) => {
            if (!response.success || controller.signal.aborted) return;
            const items = Array.isArray(response.data) ? response.data : (response.data?.items ?? []);
            setDoctors(items.map((d) => ({ id: d.id, name: d.fullName })));
        });
        return () => controller.abort();
    }, []);

    useEffect(() => () => clearTimeout(timer.current), []);

    const current = result?.key === requestKey ? result : null;
    const status = current ? (current.ok ? "ready" : "error") : "loading";
    const items = current?.data?.items ?? [];
    const total = Number(current?.data?.totalCount ?? 0);
    const totalPages = Math.max(1, Number(current?.data?.totalPages ?? Math.ceil(total / FOLLOW_UP_PAGE_SIZE)));
    const lastPager = result?.ok ? Math.max(1, Number(result.data?.totalPages ?? 1)) : 1;

    const change = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

    const onSearch = (value) => {
        setSearch(value);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => change({ keyword: value }), SEARCH_DELAY_MS);
    };

    const clearAll = () => {
        clearTimeout(timer.current);
        setSearch("");
        setFilters(EMPTY_FILTERS);
    };

    const done = (message) => {
        setDialog(null);
        toast.success(message, { role: "status" });
        setReload((n) => n + 1);
    };

    const remind = async (item) => {
        setReminding(item.examinationId);
        const response = await remindFollowUp(item.examinationId);
        setReminding(null);
        if (response.success) {
            toast.success(TEXT.REMINDED(item.patientName), { role: "status" });
            setReload((n) => n + 1);
        } else toast.error(appointmentErrorText(response, TEXT.GENERIC_ERROR));
    };

    const today = clinicToday();

    const doctorOptions = [["", TEXT.ALL_DOCTORS], ...doctors.map((d) => [String(d.id), d.name])];
    const dirty = isFiltered({ ...filters, keyword: search });
    const from = (filters.page - 1) * FOLLOW_UP_PAGE_SIZE + 1;

    return (
        <div className="app-content min-h-full space-y-5">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.TITLE}</h1>
                <p className="mt-1 text-body-sm text-muted">
                    {TEXT.DESCRIPTION}
                    {needCount !== null && TEXT.NEED_COUNT(needCount)}
                </p>
            </div>
            <Card>
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                    <div className="flex min-w-56 flex-1 flex-col gap-1">
                        <label htmlFor="fu-search" className="text-caption text-muted">
                            {TEXT.SEARCH}
                        </label>
                        <input id="fu-search" type="search" className="input" placeholder={TEXT.SEARCH_PLACEHOLDER} value={search} onChange={(event) => onSearch(event.target.value)} />
                    </div>
                    <LabeledSelect id="fu-due" label={TEXT.DUE} value={filters.due} options={Object.entries(TEXT.DUE_OPTIONS)} onChange={(due) => change({ due })} />
                    <LabeledSelect id="fu-state" label={TEXT.STATE} value={filters.state} options={Object.entries(TEXT.STATE_OPTIONS)} onChange={(value) => change({ state: value })} />
                    <LabeledSelect id="fu-doctor" label={TEXT.DOCTOR} value={filters.doctorId} options={doctorOptions} onChange={(doctorId) => change({ doctorId })} />
                    {dirty && (
                        <button type="button" className="btn btn-link mb-2.5 h-auto p-0" onClick={clearAll}>
                            {TEXT.CLEAR}
                        </button>
                    )}
                </div>
            </Card>
            <Card>
                {status === "error" ? (
                    <div role="alert" className="alert alert-danger m-4 flex flex-wrap items-center gap-3">
                        <span className="flex-1">{TEXT.LOAD_ERROR}</span>
                        <button type="button" className="btn btn-secondary h-9" onClick={() => setReload((n) => n + 1)}>
                            {TEXT.RETRY}
                        </button>
                    </div>
                ) : (
                    <div className="table-wrap rounded-none border-0" aria-busy={status === "loading" ? "true" : undefined}>
                        <table className="table table-stack">
                            <thead>
                                <tr>
                                    <th>{C.PATIENT}</th>
                                    <th>{C.PHONE}</th>
                                    <th>{C.WHAT}</th>
                                    <th>{C.DOCTOR}</th>
                                    <th>{C.DUE}</th>
                                    <th>{C.REMINDED}</th>
                                    <th>{C.STATE}</th>
                                    <th>
                                        <span className="sr-only">{C.ACTIONS}</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {status === "loading" ? (
                                    SKELETON_ROWS.map((row) => (
                                        <tr key={row}>
                                            <td colSpan={COLUMN_COUNT}>
                                                <span className="skeleton block h-5 w-full" />
                                            </td>
                                        </tr>
                                    ))
                                ) : items.length === 0 ? (
                                    <tr>
                                        <td colSpan={COLUMN_COUNT} className="py-8 text-center text-muted">
                                            {TEXT.EMPTY}
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item) => {
                                        const state = rowState(item, today);
                                        const [chipLabel, chipClass] = STATE_CHIPS[state];
                                        const due = dueDateOf(item, state);
                                        const slot = slotOf(item, state);
                                        const finished = state === "ARRIVED" || state === "DONE";
                                        const missed = state === "MISSED";
                                        const unlock = finished || missed ? null : remindUnlockAt(item, now);
                                        const last = item.lastRemindedAt ? clockOf(item.lastRemindedAt) : null;
                                        const reminded = remindedText(item, last);
                                        const menu = [
                                            state === "PENDING" || state === "CONFIRMED" ? { label: TEXT.MENU_MOVE, onSelect: () => setDialog({ type: "move", item, state }) } : null,
                                            missed ? { label: TEXT.MENU_BOOK, onSelect: () => setDialog({ type: "book", item, state }) } : null,
                                            { label: TEXT.MENU_DECLINE, danger: true, onSelect: () => setDialog({ type: "decline", item, state }) },
                                        ].filter(Boolean);
                                        return (
                                            <tr key={item.examinationId} className={cx(finished && "text-muted")}>
                                                <td data-primary>
                                                    <span className="block font-semibold whitespace-nowrap text-ink">{item.patientName}</span>
                                                    <span className="num block text-caption text-muted">{item.patientCode}</span>
                                                </td>
                                                <td data-label={C.PHONE} className="num whitespace-nowrap">
                                                    {item.patientPhoneNumber ? phoneText(item.patientPhoneNumber) : TEXT.DASH}
                                                </td>
                                                <td data-label={C.WHAT}>{item.followUpNotes || TEXT.DASH}</td>
                                                <td data-label={C.DOCTOR} className="whitespace-nowrap">
                                                    {doctorOf(item, state) || TEXT.DASH}
                                                </td>
                                                <td data-label={C.DUE} className="num whitespace-nowrap">
                                                    {due ? (
                                                        <>
                                                            <span className="block font-semibold text-ink">{dmy(due)}</span>
                                                            <span className="block text-caption text-muted">
                                                                {slot ? slotRange(slot) : TEXT.NO_TIME}
                                                                {due === today && !finished && TEXT.TODAY_MARK}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        TEXT.DASH
                                                    )}
                                                </td>
                                                <td data-label={C.REMINDED} className="num whitespace-nowrap">
                                                    {item.reminderCount ? (
                                                        <>
                                                            <span className="block">{TEXT.REMIND_COUNT(item.reminderCount)}</span>
                                                            {last && <span className="block text-caption text-muted">{TEXT.REMIND_LAST(last.day, last.time)}</span>}
                                                        </>
                                                    ) : (
                                                        TEXT.NOT_REMINDED
                                                    )}
                                                </td>
                                                <td data-label={C.STATE}>
                                                    <span className={cx("badge", chipClass)}>{chipLabel}</span>
                                                </td>
                                                <td data-actions className="w-px text-right">
                                                    {!finished && (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="flex justify-end gap-1.5">
                                                                {!missed && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-secondary h-8 px-3 text-label whitespace-nowrap"
                                                                        disabled={Boolean(unlock) || reminding === item.examinationId}
                                                                        aria-describedby={unlock ? `fu-lock-${item.examinationId}` : undefined}
                                                                        onClick={() => remind(item)}
                                                                    >
                                                                        {reminding === item.examinationId && <span className="btn-spinner" aria-hidden />}
                                                                        {TEXT.REMIND}
                                                                    </button>
                                                                )}
                                                                {(state === "PENDING" || state === "NONE") && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-primary h-8 px-3 text-label whitespace-nowrap"
                                                                        onClick={() => setDialog({ type: state === "PENDING" ? "confirm" : "book", item, state, reminded })}
                                                                    >
                                                                        {TEXT.CONFIRM}
                                                                    </button>
                                                                )}
                                                                <RowMenu label={TEXT.MORE(item.patientName)} items={menu} />
                                                            </div>
                                                            {unlock && (
                                                                <span id={`fu-lock-${item.examinationId}`} className="num text-caption text-muted">
                                                                    {TEXT.REMIND_LOCKED(formatClock(unlock))}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                {(status === "ready" ? total > 0 : status === "loading" && result?.ok) && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
                        <span className="num text-caption text-muted">{status === "ready" ? TEXT.COUNT(from, from + items.length - 1, total) : ""}</span>
                        <span className="flex-1" />
                        {(status === "ready" ? totalPages : lastPager) > 1 && (
                            <Pagination
                                page={filters.page}
                                totalPages={status === "ready" ? totalPages : lastPager}
                                onChange={(page) => change({ page })}
                                busy={status === "loading"}
                                label={TEXT.TITLE}
                            />
                        )}
                    </div>
                )}
            </Card>
            {dialog?.type === "confirm" && <FollowUpConfirmDialog item={dialog.item} state={dialog.state} reminded={dialog.reminded} onClose={() => setDialog(null)} onSaved={done} />}
            {dialog?.type === "decline" && <FollowUpDeclineDialog item={dialog.item} state={dialog.state} onClose={() => setDialog(null)} onSaved={done} />}
            {(dialog?.type === "book" || dialog?.type === "move") && (
                <FollowUpScheduleDialog item={dialog.item} mode={dialog.type} doctors={doctors} onClose={() => setDialog(null)} onSaved={done} />
            )}
        </div>
    );
};

export default ReceptionFollowUps;

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Search } from "lucide-react";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import Pagination from "@/components/ui/Pagination";
import RowMenu from "@/components/ui/RowMenu";
import FollowUpConfirmDialog from "@/components/reception/FollowUpConfirmDialog";
import FollowUpDeclineDialog from "@/components/reception/FollowUpDeclineDialog";
import FollowUpScheduleDialog from "@/components/reception/FollowUpScheduleDialog";
import { Card } from "@/components/reception/shared";
import { phoneText } from "@/components/reception/receptionUtils";
import { useDebounced, usePageTitle } from "@/hooks/usePatientRecordNav";
import { appointmentErrorText, clinicToday, getDoctorOptions, getFollowUpList, remindFollowUp } from "@/services/receptionService";
import { FOLLOW_UP_TEXT as TEXT } from "@/utils/messages";
import { slotRange } from "@/utils/booking";
import { dmy } from "@/utils/calendar";
import { formatClock, getClinicDateTimeParts } from "@/utils/format";
import {
    DEFAULT_STATE,
    FILTER_STATES,
    FOLLOW_UP_PAGE_SIZE,
    STATE_CHIPS,
    dateFromUrl,
    dueDateOf,
    followUpQuery,
    remindUnlockAt,
    remindedText,
    rowState,
    slotOf,
} from "@/utils/followUp";
import { cx } from "@/utils/cx";

const READ = { skipErrorPage: true };
const SEARCH_DELAY_MS = 300;
const SKELETON_ROWS = [1, 2, 3, 4, 5];
const COLUMN_COUNT = 7;
const CELL = "@4xl:py-3 @4xl:align-top";
const CLOCK_TICK_MS = 60_000;
const C = TEXT.COLUMNS;
const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.TITLE }];

const clockOf = (value) => {
    const parts = getClinicDateTimeParts(value);
    return { day: parts.date.slice(0, 5), time: parts.time.slice(0, 5) };
};

const ReceptionFollowUps = () => {
    const [params, setParams] = useSearchParams();
    const q = params.get("q") ?? "";
    const rawState = params.get("state");
    const state = FILTER_STATES.includes(rawState) ? rawState : DEFAULT_STATE;
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const rawFrom = params.get("from");
    const rawTo = params.get("to");
    const datesValid = !dateFromUrl(rawFrom) || !dateFromUrl(rawTo) || dateFromUrl(rawFrom) <= dateFromUrl(rawTo);
    const from = datesValid ? dateFromUrl(rawFrom) : "";
    const to = datesValid ? dateFromUrl(rawTo) : "";
    const [box, setBox] = useState(q);
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [dialog, setDialog] = useState(null);
    const [reminding, setReminding] = useState(null);
    const [now, setNow] = useState(() => Date.now());
    const { schedule, cancel } = useDebounced(SEARCH_DELAY_MS);

    usePageTitle(TEXT.DOC_TITLE);

    const update = (changes) => {
        const next = new URLSearchParams(window.location.search);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        if (!("page" in changes)) next.delete("page");
        setParams(next, { replace: true });
    };

    useEffect(() => {
        const stateInvalid = rawState !== null && (!FILTER_STATES.includes(rawState) || rawState === DEFAULT_STATE);
        const fromInvalid = rawFrom !== null && (!datesValid || dateFromUrl(rawFrom) !== rawFrom);
        const toInvalid = rawTo !== null && (!datesValid || dateFromUrl(rawTo) !== rawTo);
        if (!stateInvalid && !fromInvalid && !toInvalid) return;
        const next = new URLSearchParams(window.location.search);
        if (stateInvalid) next.delete("state");
        if (fromInvalid) next.delete("from");
        if (toInvalid) next.delete("to");
        setParams(next, { replace: true });
    }, [rawState, rawFrom, rawTo, datesValid, setParams]);

    const [shownQ, setShownQ] = useState(q);
    if (shownQ !== q) {
        setShownQ(q);
        if (box.trim() !== q) setBox(q);
    }

    const requestKey = `${q}|${state}|${from}|${to}|${page}|${reload}`;

    useEffect(() => {
        const controller = new AbortController();
        getFollowUpList(followUpQuery({ keyword: q, from, to, state, page }), { ...READ, signal: controller.signal }).then((response) => {
            if (response.aborted || controller.signal.aborted) return;
            setResult({ key: requestKey, ok: response.success, data: response.success ? response.data : null });
        });
        return () => controller.abort();
    }, [q, from, to, state, page, requestKey]);

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

    const current = result?.key === requestKey ? result : null;
    const status = current ? (current.ok ? "ready" : "error") : "loading";
    const items = current?.data?.items ?? [];
    const total = Number(current?.data?.totalCount ?? 0);
    const totalPages = Math.max(1, Number(current?.data?.totalPages ?? Math.ceil(total / FOLLOW_UP_PAGE_SIZE)));
    const lastPager = result?.ok ? Math.max(1, Number(result.data?.totalPages ?? 1)) : 1;

    const setDate = (key, value) => {
        const changes = { [key]: value };
        if (key === "from" && value && to && to < value) changes.to = value;
        if (key === "to" && value && from && from > value) changes.from = value;
        update(changes);
    };

    const clearFilters = () => {
        cancel();
        setBox("");
        setParams(new URLSearchParams(), { replace: true });
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

    const filtered = Boolean(q || from || to || state !== DEFAULT_STATE);
    const firstNo = (page - 1) * FOLLOW_UP_PAGE_SIZE + 1;

    return (
        <div className="app-content min-h-full space-y-5">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.TITLE}</h1>
                <p className="mt-1 text-body-sm text-muted">{TEXT.DESCRIPTION}</p>
            </div>
            <Card className="overflow-hidden">
                <div className="flex flex-wrap items-end gap-4 p-4 sm:p-6">
                    <div className="field w-full sm:w-80">
                        <label htmlFor="fu-search" className="label">
                            {TEXT.SEARCH}
                        </label>
                        <div className="search">
                            <Search aria-hidden="true" />
                            <input
                                id="fu-search"
                                type="search"
                                className="input"
                                placeholder={TEXT.SEARCH_PLACEHOLDER}
                                value={box}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setBox(value);
                                    schedule(() => {
                                        const keyword = value.trim();
                                        if (keyword !== (new URLSearchParams(window.location.search).get("q") ?? "")) update({ q: keyword });
                                    });
                                }}
                            />
                        </div>
                    </div>
                    {[
                        ["from", TEXT.FROM, from],
                        ["to", TEXT.TO, to],
                    ].map(([key, label, value]) => (
                        <div key={key} className="field w-full sm:w-auto">
                            <label htmlFor={`fu-${key}`} className="label">
                                {label}
                            </label>
                            <input id={`fu-${key}`} type="date" className="input w-full sm:w-auto" value={value} onChange={(event) => setDate(key, event.target.value)} />
                        </div>
                    ))}
                    <div className="field w-full sm:w-auto sm:min-w-48">
                        <label htmlFor="fu-state" className="label">
                            {TEXT.STATE}
                        </label>
                        <select id="fu-state" className="input w-full" value={state} onChange={(event) => update({ state: event.target.value === DEFAULT_STATE ? "" : event.target.value })}>
                            {FILTER_STATES.map((value) => (
                                <option key={value} value={value}>
                                    {TEXT.STATE_OPTIONS[value]}
                                </option>
                            ))}
                        </select>
                    </div>
                    {filtered && (
                        <button type="button" className="btn-link h-control" onClick={clearFilters}>
                            {TEXT.CLEAR}
                        </button>
                    )}
                </div>
                {status === "error" ? (
                    <div className="border-t border-border p-4 sm:p-6">
                        <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                            <span className="flex-1">{TEXT.LOAD_ERROR}</span>
                            <button type="button" className="btn btn-secondary h-9" onClick={() => setReload((n) => n + 1)}>
                                {TEXT.RETRY}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="table-wrap rounded-none border-x-0 border-b-0" aria-busy={status === "loading" ? "true" : undefined}>
                        <table className="table table-stack table-fixed-acts">
                            <colgroup>
                                <col className="w-12" />
                                <col />
                                <col className="w-32" />
                                <col className="w-30" />
                                <col className="w-36" />
                                <col className="w-36" />
                                <col className="w-50" />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th className="px-2 text-right">{C.NO}</th>
                                    <th>{C.PATIENT}</th>
                                    <th>{C.PHONE}</th>
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
                                    items.map((item, index) => {
                                        const state = rowState(item, today);
                                        const [chipLabel, chipClass] = STATE_CHIPS[state];
                                        const due = dueDateOf(item, state);
                                        const slot = slotOf(item, state);
                                        const finished = state === "ARRIVED" || state === "DONE";
                                        const missed = state === "MISSED";
                                        const unlock = state === "PENDING" || state === "NONE" ? remindUnlockAt(item, now) : null;
                                        const last = item.lastRemindedAt ? clockOf(item.lastRemindedAt) : null;
                                        const reminded = remindedText(item, last);
                                        const canRemind = state === "PENDING" || state === "NONE";
                                        const when = [slot && slotRange(slot), due === today && !finished && TEXT.TODAY].filter(Boolean).join(" · ");
                                        const menu = [
                                            canRemind ? { label: TEXT.CONFIRM, onSelect: () => setDialog({ type: state === "PENDING" ? "confirm" : "book", item, state, reminded }) } : null,
                                            state === "PENDING" || state === "CONFIRMED" ? { label: TEXT.MENU_MOVE, onSelect: () => setDialog({ type: "move", item, state }) } : null,
                                            missed ? { label: TEXT.MENU_BOOK, onSelect: () => setDialog({ type: "book", item, state }) } : null,
                                            { label: TEXT.MENU_DECLINE, danger: true, onSelect: () => setDialog({ type: "decline", item, state }) },
                                        ].filter(Boolean);
                                        return (
                                            <tr key={item.examinationId} className={cx(finished && "text-muted")}>
                                                <td data-label={C.NO} data-hide-stack className={cx(CELL, "num px-2 text-right text-muted")}>
                                                    {firstNo + index}
                                                </td>
                                                <td data-primary className={CELL}>
                                                    <span className="block font-semibold text-ink">{item.patientName}</span>
                                                    <span className="num block text-caption text-muted">{item.patientCode}</span>
                                                </td>
                                                <td data-label={C.PHONE} className={cx(CELL, "num whitespace-nowrap")}>
                                                    {item.patientPhoneNumber ? phoneText(item.patientPhoneNumber) : TEXT.DASH}
                                                </td>
                                                <td data-label={C.DUE} className={cx(CELL, "num")}>
                                                    {due ? (
                                                        <div>
                                                            <span className="block font-semibold text-ink">{dmy(due)}</span>
                                                            {when && <span className="block text-caption text-muted">{when}</span>}
                                                        </div>
                                                    ) : (
                                                        TEXT.DASH
                                                    )}
                                                </td>
                                                <td data-label={C.REMINDED} className={cx(CELL, "num")}>
                                                    {item.reminderCount ? (
                                                        <div>
                                                            <span className="block">{TEXT.REMIND_COUNT(item.reminderCount)}</span>
                                                            {last && <span className="block text-caption text-muted">{TEXT.REMIND_LAST(last.day, last.time)}</span>}
                                                        </div>
                                                    ) : (
                                                        TEXT.NOT_REMINDED
                                                    )}
                                                </td>
                                                <td data-label={C.STATE} className={CELL}>
                                                    <span className={cx("badge", chipClass)}>{chipLabel}</span>
                                                </td>
                                                <td data-actions className={cx(CELL, "text-right")}>
                                                    {!finished && (
                                                        <div className="flex flex-col items-end gap-1 @max-4xl:w-full">
                                                            <div className="flex w-full justify-end gap-1.5">
                                                                {canRemind ? (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-primary h-8 w-32 px-3 text-label whitespace-nowrap @max-4xl:max-w-80 @max-4xl:flex-1"
                                                                        disabled={Boolean(unlock) || reminding === item.examinationId}
                                                                        aria-describedby={unlock ? `fu-lock-${item.examinationId}` : undefined}
                                                                        onClick={() => remind(item)}
                                                                    >
                                                                        {reminding === item.examinationId && <span className="btn-spinner" aria-hidden />}
                                                                        {TEXT.REMIND}
                                                                    </button>
                                                                ) : (
                                                                    <span className="w-32 shrink-0 @max-4xl:hidden" aria-hidden="true" />
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
                        <span className="num text-caption text-muted">{status === "ready" ? TEXT.COUNT(firstNo, firstNo + items.length - 1, total) : ""}</span>
                        <span className="flex-1" />
                        {(status === "ready" ? totalPages : lastPager) > 1 && (
                            <Pagination
                                page={page}
                                totalPages={status === "ready" ? totalPages : lastPager}
                                onChange={(next) => update({ page: next > 1 ? String(next) : "" })}
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

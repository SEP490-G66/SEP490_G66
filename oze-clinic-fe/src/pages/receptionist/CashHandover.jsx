import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import LabeledSelect from "@/components/ui/LabeledSelect";
import Pagination from "@/components/ui/Pagination";
import ShiftOpenDialog from "@/components/handover/ShiftOpenDialog";
import { Card } from "@/components/reception/shared";
import { clinicClock, money, report } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { getCashSessions, getCurrentCashSession, getHandoverCandidates, getNextCashShift, openCashSession } from "@/services/cashSessionService";
import { clinicToday } from "@/services/receptionService";
import { getMyShifts } from "@/services/myScheduleService";
import { getSessionUserName } from "@/services/sessionStore";
import { addDays, dmy } from "@/utils/calendar";
import { dateKey, dateTimeOf, isOpen, openingPlan, shiftNotOver, shiftTypeOf, signedMoney } from "@/utils/cashShift";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";
import { getCashHandoverRoute } from "@/utils/routes";
import { cx } from "@/utils/cx";

const READ = { skipErrorPage: true };
const PAGE_SIZE = 10;
const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.TITLE }];
const STATUS_OPTIONS = [["", TEXT.ALL], ...Object.entries(TEXT.STATUS_LABEL)];
// How far back to look for a shift someone forgot to close before a new one is opened.
const OPEN_LOOKBACK_DAYS = 30;

const defaults = (today) => ({ from: addDays(today, -6), to: today, status: "", staff: "" });

const CashHandover = () => {
    const navigate = useNavigate();
    // Read on every render so a page left open overnight moves to the new day.
    const today = clinicToday();
    const [filters, setFilters] = useState(() => defaults(today));
    const [page, setPage] = useState(1);
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [current, setCurrent] = useState(undefined);
    const [staff, setStaff] = useState([]);
    const [plan, setPlan] = useState(null);
    const [preparing, setPreparing] = useState(false);
    const [blocked, setBlocked] = useState(null);

    usePageTitle(TEXT.DOC_TITLE);

    const requestKey = `${filters.from}|${filters.to}|${filters.status}|${filters.staff}|${page}|${reload}`;

    useEffect(() => {
        const controller = new AbortController();
        getCashSessions(
            { fromDate: filters.from, toDate: filters.to, status: filters.status, openedByUserId: filters.staff, page, pageSize: PAGE_SIZE },
            { ...READ, signal: controller.signal },
        ).then((response) => {
            if (controller.signal.aborted || response.aborted) return;
            const lastPage = Math.max(1, Number(response.data?.totalPages ?? 1));
            if (response.success && page > lastPage) {
                setPage(lastPage);
                return;
            }
            setResult({
                key: requestKey,
                ok: response.success,
                items: response.success ? (response.data?.items ?? []) : [],
                total: Number(response.data?.totalCount ?? response.data?.items?.length ?? 0),
                totalPages: Math.max(1, Number(response.data?.totalPages ?? 1)),
            });
        });
        return () => controller.abort();
    }, [filters, page, requestKey]);

    useEffect(() => {
        const controller = new AbortController();
        // A failed check is not "no open shift": showing "Mở ca" then could start a second drawer.
        getCurrentCashSession({ ...READ, signal: controller.signal }).then((response) => {
            if (controller.signal.aborted || response.aborted) return;
            setCurrent(response.success ? (response.data ?? null) : { failed: true });
        });
        return () => controller.abort();
    }, [reload]);

    useEffect(() => {
        const controller = new AbortController();
        getHandoverCandidates().then((response) => {
            if (controller.signal.aborted || !response.success) return;
            setStaff((response.data ?? []).map((c) => [String(c.userId), c.fullName]));
        });
        return () => controller.abort();
    }, []);

    const setFilter = (key) => (value) => {
        setFilters((f) => {
            const next = { ...f, [key]: value };
            if (key === "from" && next.to < value) next.to = value;
            if (key === "to" && next.from > value) next.from = value;
            return next;
        });
        setPage(1);
    };

    // Opening rules (decided with the clinic): the receptionist must be on today's schedule with a shift not yet over,
    // and every earlier shift must be closed by the person who opened it. Anything that cannot be checked blocks the opening.
    const startOpen = async () => {
        if (preparing) return;
        setPreparing(true);
        setBlocked(null);
        const day = clinicToday();
        const [next, mine, openOnes] = await Promise.all([
            getNextCashShift(READ),
            getMyShifts({ fromDate: day, toDate: day }, READ),
            getCashSessions({ fromDate: addDays(day, -OPEN_LOOKBACK_DAYS), toDate: day, status: "Open", page: 1, pageSize: 5 }, READ),
        ]);
        setPreparing(false);
        const now = clinicClock();
        if (!mine.success) return setBlocked(TEXT.SCHEDULE_ERROR);
        const shifts = Array.isArray(mine.data) ? mine.data : [];
        if (!shifts.length) return setBlocked(TEXT.NO_SCHEDULE);
        const myShift = shifts.find((x) => shiftNotOver(x, now));
        if (!myShift) return setBlocked(TEXT.SHIFT_OVER);
        if (!openOnes.success) return setBlocked(TEXT.PREV_CHECK_ERROR);
        const others = (openOnes.data?.items ?? []).filter((x) => isOpen(x));
        if (others.length) return setBlocked(TEXT.PREV_OPEN(others[0].openedByName, dateTimeOf(others[0].openedAt)));
        // No plan from the server (404 = no earlier shift to hand over): fall back to the latest closed shift, not to the filtered list.
        let lastClosed = null;
        if (!next.success && next.status !== 404) return setBlocked(TEXT.PLAN_ERROR);
        if (!next.success || !next.data) {
            const closed = await getCashSessions({ fromDate: addDays(day, -OPEN_LOOKBACK_DAYS), toDate: day, status: "Closed", page: 1, pageSize: 1 }, READ);
            if (!closed.success) return setBlocked(TEXT.PLAN_ERROR);
            lastClosed = closed.data?.items?.[0] ?? null;
        }
        setPlan(
            openingPlan({
                next: next.success ? next.data : null,
                lastClosed: lastClosed && dateKey(lastClosed.closedAt ?? lastClosed.openedAt) === day ? lastClosed : null,
                myShift,
                now,
                staff: getSessionUserName(),
                labels: TEXT.SHIFT,
                sourceDay: TEXT.SOURCE_DAY,
                sourcePrev: TEXT.SOURCE_PREV,
            }),
        );
    };

    const fresh = result?.key === requestKey ? result : null;
    const items = result?.items ?? [];
    const dash = <span className="text-muted">—</span>;

    const table = () => {
        if (!result) return <p className="px-6 py-10 text-center text-body-sm text-muted">{TEXT.LOADING}</p>;
        if (!items.length) return result.ok ? <p className="px-6 py-10 text-center text-body-sm text-muted">{TEXT.EMPTY}</p> : null;
        return (
            <div className={cx("table-wrap rounded-none border-x-0", !fresh && "opacity-60")} aria-busy={!fresh ? "true" : undefined}>
                <table className="table table-stack [&_td]:px-3 [&_th]:px-3 [&_th]:whitespace-nowrap">
                    <thead>
                        <tr>
                            {TEXT.COLUMNS.map((c, i) => (
                                <th key={c} className={i >= 3 && i <= 6 ? "text-right" : undefined}>
                                    {c}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((s) => {
                            const open = isOpen(s);
                            const diff = s.difference ?? (s.countedCash != null && s.expectedCash != null ? s.countedCash - s.expectedCash : null);
                            const diffTransfer =
                                s.transferDifference ?? (s.countedTransfer != null && s.expectedTransfer != null ? s.countedTransfer - s.expectedTransfer : null);
                            return (
                                <tr key={s.id}>
                                    <td data-primary>
                                        <Link to={getCashHandoverRoute(s.id)} className="font-semibold text-primary hover:underline">
                                            {s.code ?? `#${s.id}`}
                                        </Link>
                                        <small className="block whitespace-nowrap text-caption text-muted">{s.openedByName}</small>
                                    </td>
                                    <td data-label={TEXT.COLUMNS[1]} className="num whitespace-nowrap">
                                        {dateTimeOf(s.openedAt)}
                                    </td>
                                    <td data-label={TEXT.COLUMNS[2]} className="num whitespace-nowrap">
                                        {open ? dash : dateTimeOf(s.closedAt)}
                                    </td>
                                    <td data-label={TEXT.COLUMNS[3]} className="num text-right">
                                        {money(s.openingCash)}
                                    </td>
                                    <td data-label={TEXT.COLUMNS[4]} className="num text-right">
                                        {open ? dash : money(s.expectedCash)}
                                    </td>
                                    <td data-label={TEXT.COLUMNS[5]} className="num text-right">
                                        {open ? dash : money(s.countedCash)}
                                    </td>
                                    <td data-label={TEXT.COLUMNS[6]} className="num text-right">
                                        {open || diff == null ? dash : signedMoney(diff)}
                                        {!open && Boolean(diffTransfer) && <small className="block text-caption text-muted">{TEXT.TRANSFER_DIFF(signedMoney(diffTransfer))}</small>}
                                    </td>
                                    <td data-label={TEXT.COLUMNS[7]}>
                                        <span className={cx("badge", open ? "badge-success" : "badge-neutral")}>{open ? TEXT.STATUS_LABEL.Open : (TEXT.STATUS_LABEL[s.status] ?? s.status)}</span>
                                    </td>
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
                </div>
                {current !== undefined &&
                    !current?.failed &&
                    (current ? (
                        <button type="button" className="btn btn-primary" onClick={() => navigate(getCashHandoverRoute(current.id))}>
                            {TEXT.CLOSE_SHIFT(TEXT.SHIFT[shiftTypeOf(current)])}
                        </button>
                    ) : (
                        <button type="button" className="btn btn-primary" onClick={startOpen} disabled={preparing} aria-busy={preparing || undefined}>
                            {preparing ? TEXT.CHECKING : TEXT.OPEN_SHIFT}
                        </button>
                    ))}
            </div>
            {current?.failed && (
                <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                    <span className="flex-1">{TEXT.CURRENT_ERROR}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={() => setReload((n) => n + 1)}>
                        {TEXT.RETRY}
                    </button>
                </div>
            )}
            {current && !current.failed && dateKey(current.openedAt) && dateKey(current.openedAt) < today && (
                <p role="alert" className="alert alert-warning">
                    {TEXT.STALE_OPEN(dmy(dateKey(current.openedAt)))}
                </p>
            )}
            {blocked && (
                <div role="alert" className="alert alert-warning flex flex-wrap items-center gap-3">
                    <span className="flex-1">{blocked}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={() => setBlocked(null)}>
                        {TEXT.CLOSE}
                    </button>
                </div>
            )}
            <Card>
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                    {[
                        ["from", TEXT.FROM],
                        ["to", TEXT.TO],
                    ].map(([key, label]) => (
                        <div key={key} className="flex flex-col gap-1">
                            <label htmlFor={`hc-${key}`} className="text-caption text-muted">
                                {label}
                            </label>
                            <input
                                id={`hc-${key}`}
                                type="date"
                                className="input w-auto"
                                max={today}
                                value={filters[key]}
                                onChange={(e) => e.target.value && e.target.value <= today && setFilter(key)(e.target.value)}
                            />
                        </div>
                    ))}
                    <LabeledSelect id="hc-status" label={TEXT.STATUS} value={filters.status} options={STATUS_OPTIONS} onChange={setFilter("status")} />
                    <LabeledSelect id="hc-staff" label={TEXT.STAFF} value={filters.staff} options={[["", TEXT.ALL_STAFF], ...staff]} onChange={setFilter("staff")} />
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
                {table()}
                {items.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                        <p className="num text-body-sm text-muted">
                            {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + items.length} / {result.total}
                        </p>
                        {result.totalPages > 1 && <Pagination page={page} totalPages={result.totalPages} onChange={setPage} busy={!fresh} />}
                    </div>
                )}
            </Card>
            {plan && (
                <ShiftOpenDialog
                    plan={plan}
                    onClose={() => setPlan(null)}
                    onSubmit={async (values) => {
                        // Failed or not, the dialog closes and the page reloads: someone may have opened a shift meanwhile.
                        report(await openCashSession(values), TEXT.OPENED_TOAST(plan.label, clinicClock()));
                        setPlan(null);
                        setReload((n) => n + 1);
                    }}
                />
            )}
        </div>
    );
};

export default CashHandover;

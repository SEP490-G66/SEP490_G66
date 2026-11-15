import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import LabeledSelect from "@/components/ui/LabeledSelect";
import RowMenu from "@/components/ui/RowMenu";
import QueueLeaveDialog from "@/components/reception/QueueLeaveDialog";
import QueueMoveDialog from "@/components/reception/QueueMoveDialog";
import QueuePriorityDialog from "@/components/reception/QueuePriorityDialog";
import { Card, WalkInDialog } from "@/components/reception/shared";
import { PRIORITY_BADGE, PRIORITY_LABEL, clockOf, report, useDoctorsOnDuty, usePaging } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import {
    createWalkIn,
    getQueueEntries,
    getTodayAppointments,
    getWaitingList,
    markNoShow,
    moveQueueEntry,
    reassignDoctor,
    removeQueueEntry,
    setPriority,
    setQueuePriority,
} from "@/services/receptionService";
import {
    EMPTY_QUEUE_FILTERS,
    QUEUE_TABS,
    entryRows,
    examRooms,
    examRows,
    isQueueFiltered,
    matchesQueue,
    orderRows,
    otherRooms,
    waitingCount,
} from "@/utils/queueBoard";
import { QUEUE_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import { cx } from "@/utils/cx";

const REFRESH_MS = 20_000;
const PRIORITY_OPTIONS = [["", TEXT.ALL], ...Object.entries(PRIORITY_LABEL).reverse()];

const loadQueue = async () => {
    const [waiting, today, entries] = await Promise.all([getWaitingList(), getTodayAppointments(), getQueueEntries()]);
    const list = (r) => (Array.isArray(r.data) ? r.data : (r.data?.items ?? []));
    return {
        ok: waiting.success && today.success,
        waiting: waiting.success ? list(waiting) : [],
        today: today.success ? list(today) : [],
        entries: entries.success ? list(entries) : [],
    };
};

const ReceptionQueue = () => {
    const { state: navState } = useLocation();
    const [tab, setTab] = useState(() => (QUEUE_TABS.includes(navState?.tab) ? navState.tab : "kham"));
    const [filters, setFilters] = useState(() => ({ ...EMPTY_QUEUE_FILTERS, room: navState?.room ?? "" }));
    const [data, setData] = useState(null);
    const [version, setVersion] = useState(0);
    const [dialog, setDialog] = useState(null);
    const { doctors, available } = useDoctorsOnDuty(version);

    usePageTitle(TEXT.DOC_TITLE);

    useEffect(() => {
        let active = true;
        const load = () => loadQueue().then((next) => active && setData(next));
        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [version]);

    const reload = useCallback(() => setVersion((v) => v + 1), []);
    const act = async (request, successText) => {
        if (report(await request, successText)) {
            setDialog(null);
            reload();
        }
    };

    const waiting = data?.waiting ?? [];
    const serving = (data?.today ?? []).filter((a) => a.status === "IN_SERVICE");
    const allRooms = [...examRooms(doctors, waiting, serving), ...otherRooms(data?.entries ?? [])];
    const allRows = [...examRows(waiting, serving), ...entryRows(data?.entries ?? [])];
    const rooms = allRooms.filter((r) => r.tab === tab);
    const roomOf = new Map(allRooms.map((r) => [r.key, r]));
    const tabRows = orderRows(
        allRows.filter((row) => roomOf.get(row.roomKey)?.tab === tab),
        rooms,
    );
    const shown = tabRows.filter((row) => matchesQueue(row, filters));
    const { pageItems, footer, setPage } = usePaging(shown, 10);
    const filtered = isQueueFiltered(filters);

    const setFilter = (key) => (value) => {
        setFilters((f) => ({ ...f, [key]: value }));
        setPage(1);
    };
    const changeTab = (next) => {
        setTab(next);
        setFilters(EMPTY_QUEUE_FILTERS);
        setPage(1);
    };
    const onTabKey = (event) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = QUEUE_TABS[(QUEUE_TABS.indexOf(tab) + step + QUEUE_TABS.length) % QUEUE_TABS.length];
        changeTab(next);
        document.getElementById(`queue-tab-${next}`)?.focus();
    };

    const targetsFor = (fromKey) =>
        allRooms
            .filter((r) => r.tab === roomOf.get(fromKey)?.tab && r.key !== fromKey && r.active)
            .map((r) => ({ ...r, waiting: waitingCount(allRows, r.key) }));

    const moveRows = async (rows, target) => {
        const failures = [];
        for (const row of rows) {
            const result = row.kind === "exam" ? await reassignDoctor(row.appointmentId, target.doctorId) : await moveQueueEntry(row.entryId, target.roomId);
            if (!result.success) failures.push(`${row.patientName}: ${result.message}`);
        }
        const label = [target.name, target.staff].filter(Boolean).join(" · ");
        report({ success: !failures.length, message: TEXT.MOVE_PARTIAL(rows.length - failures.length, rows.length, failures.join("; ")) }, TEXT.MOVED(label));
        setDialog(null);
        reload();
    };

    const endedRooms = rooms.filter((r) => r.ended);
    const bookedLater = (room) => (data?.today ?? []).some((a) => a.doctorId === room.doctorId && ["PENDING", "CONFIRMED"].includes(a.status));

    const row = dialog?.row;
    const roomName = row ? roomOf.get(row.roomKey)?.name : null;

    const table = () => {
        if (!data) return <p className="px-6 py-10 text-center text-body-sm text-muted">{TEXT.LOADING}</p>;
        if (!shown.length)
            return (
                <p className="px-6 py-10 text-center text-body-sm text-muted">
                    {filtered ? TEXT.EMPTY_FILTERED : TEXT.EMPTY}{" "}
                    {filtered && (
                        <button type="button" className="btn-link" onClick={() => setFilters(EMPTY_QUEUE_FILTERS)}>
                            {TEXT.CLEAR_FILTERS}
                        </button>
                    )}
                </p>
            );
        const columns = TEXT.COLUMNS.map((c, i) => (i === 3 ? TEXT.STAFF[tab] : c));
        return (
            <div className="table-wrap rounded-none border-x-0">
                <table className="table table-stack [&_td]:px-3 [&_td]:align-top [&_th]:px-3">
                    <thead>
                        <tr>
                            {columns.map((c, i) => (
                                <th key={c}>{i === columns.length - 1 ? <span className="sr-only">{c}</span> : c}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pageItems.map((r) => {
                            const room = roomOf.get(r.roomKey);
                            return (
                                <tr key={r.key} className={r.state === "serving" ? "bg-primary-softer" : undefined}>
                                    <td data-label={columns[0]} className="num font-semibold text-ink">
                                        {r.position ? String(r.position).padStart(2, "0") : "—"}
                                    </td>
                                    <td data-primary>
                                        <span className="cell-primary block">{r.patientName}</span>
                                        {r.allergies.length > 0 && <span className="badge badge-danger mt-1 flex w-fit whitespace-normal">{TEXT.ALLERGY(r.allergies[0])}</span>}
                                        <small className="block text-caption text-muted">{r.patientCode}</small>
                                    </td>
                                    <td data-label={columns[2]} className="whitespace-nowrap">
                                        {room?.name ?? TEXT.NO_ROOM}
                                    </td>
                                    <td data-label={columns[3]}>
                                        {room?.staff}
                                        {room?.ended && <small className="block text-caption text-danger">{TEXT.ENDED}</small>}
                                    </td>
                                    <td data-label={columns[4]}>
                                        <span className="flex flex-wrap gap-1">
                                            {r.state === "serving" && <span className="badge badge-info">{TEXT.SERVING[tab]}</span>}
                                            {r.state === "called" && <span className="badge badge-warning">{TEXT.CALLED}</span>}
                                            {r.state === "waiting" && <span className="badge badge-neutral">{TEXT.WAITING}</span>}
                                            {r.absent && <span className="badge badge-danger">{TEXT.ABSENT}</span>}
                                        </span>
                                    </td>
                                    <td data-label={columns[5]}>
                                        <span className={cx("badge", PRIORITY_BADGE[r.priority])}>{PRIORITY_LABEL[r.priority]}</span>
                                    </td>
                                    <td data-label={columns[6]} className="num">
                                        {clockOf(r.checkInAt)}
                                    </td>
                                    <td data-actions>
                                        {r.state !== "serving" && (
                                            <div className="flex justify-end">
                                                <RowMenu
                                                    label={TEXT.ACTIONS_FOR(r.patientName)}
                                                    items={[
                                                        { label: TEXT.MENU_PRIORITY, onSelect: () => setDialog({ type: "priority", row: r }) },
                                                        { label: TEXT.MENU_MOVE, onSelect: () => setDialog({ type: "move", rows: [r], from: r.roomKey }) },
                                                        null,
                                                        { label: TEXT.MENU_LEAVE, danger: true, onSelect: () => setDialog({ type: "leave", row: r }) },
                                                    ]}
                                                />
                                            </div>
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

    return (
        <div className="app-content min-h-full space-y-5">
            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-64 flex-1">
                    <h1 className="page-title">{TEXT.TITLE}</h1>
                    <p className="page-description">{TEXT.DESCRIPTION}</p>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => setDialog({ type: "walkIn" })} disabled={available.length === 0}>
                    {TEXT.WALK_IN}
                </button>
            </div>

            <div role="tablist" aria-label={TEXT.TABS_LABEL} className="flex gap-1 overflow-x-auto border-b border-border" onKeyDown={onTabKey}>
                {QUEUE_TABS.map((key) => (
                    <button
                        key={key}
                        id={`queue-tab-${key}`}
                        type="button"
                        role="tab"
                        aria-selected={tab === key}
                        aria-controls="queue-panel"
                        tabIndex={tab === key ? 0 : -1}
                        onClick={() => changeTab(key)}
                        className={cx(
                            "-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-label font-semibold",
                            tab === key ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink",
                        )}
                    >
                        {TEXT.TABS[key]}
                    </button>
                ))}
            </div>

            <div id="queue-panel" role="tabpanel" aria-labelledby={`queue-tab-${tab}`} className="space-y-5">
                {endedRooms.map((room) => {
                    const left = tabRows.filter((r) => r.roomKey === room.key && r.state !== "serving");
                    const later = bookedLater(room);
                    if (!left.length && !later) return null;
                    return (
                        <div key={room.key} role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                            <span className="min-w-60 flex-1">
                                <b>{TEXT.ENDED_ALERT(room.staff, room.name, room.endAt)}</b> {left.length > 0 && TEXT.ENDED_WAITING} {later && TEXT.ENDED_BOOKED}
                            </span>
                            {left.length > 0 && (
                                <button type="button" className="btn btn-primary h-8 px-3" onClick={() => setDialog({ type: "move", rows: left, from: room.key })}>
                                    {TEXT.MOVE_ALL}
                                </button>
                            )}
                            {later && (
                                <Link to={ROUTES.RECEPTION_CHECK_IN} state={{ doctor: String(room.doctorId) }} className="btn btn-secondary h-8 px-3">
                                    {TEXT.RESCHEDULE}
                                </Link>
                            )}
                        </div>
                    );
                })}

                <Card>
                    <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                        <div className="flex min-w-56 flex-1 flex-col gap-1">
                            <label htmlFor="q-search" className="text-caption text-muted">
                                {TEXT.PATIENT}
                            </label>
                            <input
                                id="q-search"
                                type="search"
                                className="input"
                                placeholder={TEXT.SEARCH_PLACEHOLDER}
                                value={filters.keyword}
                                onChange={(e) => setFilter("keyword")(e.target.value)}
                            />
                        </div>
                        <LabeledSelect id="q-room" label={TEXT.ROOM} value={filters.room} options={[["", TEXT.ALL], ...rooms.map((r) => [r.key, r.name ?? TEXT.NO_ROOM])]} onChange={setFilter("room")} />
                        <LabeledSelect
                            id="q-state"
                            label={TEXT.STATUS}
                            value={filters.state}
                            options={[
                                ["", TEXT.ALL],
                                ["serving", TEXT.SERVING[tab]],
                                ["called", TEXT.CALLED],
                                ["waiting", TEXT.WAITING],
                            ]}
                            onChange={setFilter("state")}
                        />
                        <LabeledSelect id="q-priority" label={TEXT.PRIORITY} value={filters.priority} options={PRIORITY_OPTIONS} onChange={setFilter("priority")} />
                        {filtered && (
                            <button type="button" className="btn-link h-control" onClick={() => setFilters(EMPTY_QUEUE_FILTERS)}>
                                {TEXT.CLEAR_FILTERS}
                            </button>
                        )}
                    </div>
                </Card>

                {data && !data.ok && (
                    <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                        <span className="flex-1">{TEXT.LOAD_ERROR}</span>
                        <button type="button" className="btn btn-secondary h-9" onClick={reload}>
                            {TEXT.RETRY}
                        </button>
                    </div>
                )}

                <Card>
                    {table()}
                    {footer}
                </Card>
            </div>

            {dialog?.type === "priority" && (
                <QueuePriorityDialog
                    row={row}
                    roomName={roomName}
                    onClose={() => setDialog(null)}
                    onSubmit={(priority) =>
                        act(
                            row.kind === "exam" ? setPriority(row.appointmentId, { priority }) : setQueuePriority(row.entryId, priority),
                            TEXT.PRIORITY_CHANGED(row.patientName, PRIORITY_LABEL[priority]),
                        )
                    }
                />
            )}
            {dialog?.type === "move" && <QueueMoveDialog rows={dialog.rows} targets={targetsFor(dialog.from)} onClose={() => setDialog(null)} onSubmit={(target) => moveRows(dialog.rows, target)} />}
            {dialog?.type === "leave" && (
                <QueueLeaveDialog
                    row={row}
                    roomName={roomName}
                    onClose={() => setDialog(null)}
                    onSubmit={() => act(row.kind === "exam" ? markNoShow(row.appointmentId) : removeQueueEntry(row.entryId), TEXT.LEFT(row.patientName))}
                />
            )}
            {dialog?.type === "walkIn" && (
                <WalkInDialog doctors={available} onClose={() => setDialog(null)} onSubmit={(request) => act(createWalkIn(request), TEXT.WALKED_IN(request.fullName))} />
            )}
        </div>
    );
};

export default ReceptionQueue;

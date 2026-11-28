import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import LabeledSelect from "@/components/ui/LabeledSelect";
import RowMenu from "@/components/ui/RowMenu";
import QueueLeaveDialog from "@/components/reception/QueueLeaveDialog";
import QueueMoveDialog from "@/components/reception/QueueMoveDialog";
import QueuePriorityDialog from "@/components/reception/QueuePriorityDialog";
import { Card, WalkInDialog } from "@/components/reception/shared";
import { PRIORITY_BADGE, PRIORITY_LABEL, clockOf, report, useDoctorsOnDuty, usePaging } from "@/components/reception/receptionUtils";
import useAppointmentLink from "@/hooks/useAppointmentLink";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import {
    createWalkIn,
    getQueueEntries,
    getTodayAppointments,
    getWaitingList,
    markNoShow,
    reassignDoctor,
    setPriority,
} from "@/services/receptionService";
import {
    EMPTY_QUEUE_FILTERS,
    QUEUE_TABS,
    entryRows,
    examRooms,
    examRows,
    isQueueFiltered,
    matchesQueue,
    needsDecision,
    orderRows,
    otherRooms,
    waitingCount,
} from "@/utils/queueBoard";
import { QUEUE_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import { fitsRoomTypes } from "@/utils/constants/room";
import { cx } from "@/utils/cx";
import { serverNow } from "@/services/clinicTimeService";

const REFRESH_MS = 20_000;
const PRIORITY_OPTIONS = [["", TEXT.ALL], ...Object.entries(PRIORITY_LABEL).reverse()];

const loadQueue = async () => {
    // The board shows its own error and keeps the last data, so a failed (auto) refresh never opens the global error page
    const READ = { skipErrorPage: true };
    const [waiting, today, entries] = await Promise.all([getWaitingList(READ), getTodayAppointments(READ), getQueueEntries(undefined, READ)]);
    const list = (r) => (Array.isArray(r.data) ? r.data : (r.data?.items ?? []));
    return {
        ok: waiting.success && today.success && entries.success,
        parts: { waiting: waiting.success, today: today.success, entries: entries.success },
        waiting: list(waiting),
        today: list(today),
        entries: list(entries),
        at: waiting.success && today.success && entries.success ? serverNow().toISOString() : null,
    };
};

// A failed refresh keeps what was on screen (per source) instead of emptying the board while staff act on it.
// The waiting list and today's appointments describe the same exam rooms, so they are kept or replaced together
// (mixing two moments could drop or double a patient who just went in); the other rooms' entries stand alone.
const mergeLoad = (prev, next) => {
    if (!prev) return next;
    const examFresh = next.parts.waiting && next.parts.today;
    return {
        ...next,
        waiting: examFresh ? next.waiting : prev.waiting,
        today: examFresh ? next.today : prev.today,
        entries: next.parts.entries ? next.entries : prev.entries,
        at: next.ok ? next.at : prev.at,
    };
};

const ReceptionQueue = () => {
    const { state: navState } = useLocation();
    const [tab, setTab] = useState(() => (QUEUE_TABS.includes(navState?.tab) ? navState.tab : "kham"));
    const [filters, setFilters] = useState(() => ({ ...EMPTY_QUEUE_FILTERS, room: navState?.room ?? "" }));
    const [data, setData] = useState(null);
    const [version, setVersion] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [tick, setTick] = useState(0);
    const { doctors, available, loaded: doctorsLoaded } = useDoctorsOnDuty(version * 1000 + tick);
    const requestId = useRef(0);
    // An action of this receptionist is running: blocks a second click and keeps the refresh from flagging the row as changed
    const acting = useRef(false);
    const navRoomChecked = useRef(!navState?.room);

    usePageTitle(TEXT.DOC_TITLE);

    useEffect(() => {
        let active = true;
        const load = () => {
            const id = ++requestId.current;
            // A slow answer never overwrites a newer one
            loadQueue().then((next) => active && id === requestId.current && setData((prev) => mergeLoad(prev, next)));
        };
        load();
        const timer = setInterval(() => {
            load();
            setTick((n) => n + 1);
        }, REFRESH_MS);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [version]);

    const reload = useCallback(() => setVersion((v) => v + 1), []);
    const act = async (request, successText) => {
        if (acting.current) return;
        acting.current = true;
        try {
            if (report(await request(), successText)) {
                setDialog(null);
                reload();
            }
        } finally {
            acting.current = false;
        }
    };

    const waiting = data?.waiting ?? [];
    const serving = (data?.today ?? []).filter((a) => a.status === "IN_SERVICE");
    const allRooms = [...examRooms(doctors, waiting, serving), ...otherRooms(data?.entries ?? [])];
    const allRows = [...examRows(waiting, serving, data?.entries ?? []), ...entryRows(data?.entries ?? [])];
    const rooms = allRooms.filter((r) => r.tab === tab);
    const roomOf = new Map(allRooms.map((r) => [r.key, r]));
    const tabRows = orderRows(
        allRows.filter((row) => roomOf.get(row.roomKey)?.tab === tab),
        rooms,
    );
    const shown = tabRows.filter((row) => matchesQueue(row, filters));
    const { pageItems, footer, setPage } = usePaging(shown, 10);
    const filtered = isQueueFiltered(filters);
    const rowsOfTab = (key) => allRows.filter((row) => roomOf.get(row.roomKey)?.tab === key);
    const tabAlert = (key) =>
        rowsOfTab(key).some(needsDecision) ||
        allRooms.some((room) => room.tab === key && room.ended && allRows.some((row) => row.roomKey === room.key && row.state !== "serving"));

    // A room picked on another screen that is not on this tab would leave the list empty with no matching option
    useEffect(() => {
        // Only the room handed over by another screen is checked, once the board and doctors are in; a room the user picks stays picked
        if (navRoomChecked.current || !data || !doctorsLoaded) return;
        navRoomChecked.current = true;
        if (filters.room && !rooms.some((r) => r.key === filters.room)) setFilters((f) => ({ ...f, room: "" }));
    }, [data, doctorsLoaded, filters.room, rooms]);

    // The board refreshes every 20 s: a dialog about a patient who has meanwhile gone in, left or been handled elsewhere closes.
    useEffect(() => {
        const open = dialog?.row ?? (dialog?.rows?.length === 1 ? dialog.rows[0] : null);
        if (!open || !data || acting.current) return;
        const live = allRows.find((r) => r.key === open.key);
        if (!live || live.state === "serving" || live.roomKey !== open.roomKey) {
            toast.info(TEXT.STALE(open.patientName));
            setDialog(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const setFilter = (key) => (value) => {
        setFilters((f) => ({ ...f, [key]: value }));
        setPage(1);
    };
    const changeTab = (next) => {
        setTab(next);
        setFilters(EMPTY_QUEUE_FILTERS);
        setPage(1);
    };
    // "?appointment=" from the appointment grid: open the tab and page that hold the patient's row
    const { highlightId } = useAppointmentLink(allRows, {
        idOf: (row) => row.appointmentId,
        reveal: (row) => {
            const next = roomOf.get(row.roomKey)?.tab ?? tab;
            const list = orderRows(
                allRows.filter((r) => roomOf.get(r.roomKey)?.tab === next),
                allRooms.filter((r) => r.tab === next),
            );
            setTab(next);
            setFilters(EMPTY_QUEUE_FILTERS);
            setPage(Math.floor(Math.max(0, list.indexOf(row)) / 10) + 1);
        },
    });
    const onTabKey = (event) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = QUEUE_TABS[(QUEUE_TABS.indexOf(tab) + step + QUEUE_TABS.length) % QUEUE_TABS.length];
        changeTab(next);
        document.getElementById(`queue-tab-${next}`)?.focus();
    };

    // Only rooms working now, of the kind the patients' services need (the backend refuses any other)
    const targetsFor = (fromKey, rows = []) =>
        allRooms
            .filter((r) => r.tab === roomOf.get(fromKey)?.tab && r.key !== fromKey && r.active && fitsRoomTypes(r.roomTypes, ...rows.map((row) => row.requiredRoomType)))
            .map((r) => ({ ...r, waiting: waitingCount(allRows, r.key) }));

    // Rows still waiting in that room now (not the ones seen when the dialog opened)
    // Moving all of an ended room takes everyone still waiting there; moving one takes that patient only if still in that room
    const liveRows = (rows, fromKey) => {
        const keys = new Set(rows.map((r) => r.key));
        return allRows.filter((r) => r.kind === "exam" && !r.examined && r.state !== "serving" && r.roomKey === fromKey && (rows.length > 1 || keys.has(r.key)));
    };

    const moveRows = async (picked, fromKey, choice) => {
        if (acting.current) return;
        acting.current = true;
        try {
            await moveLive(picked, fromKey, choice);
        } finally {
            acting.current = false;
        }
    };

    const moveLive = async (picked, fromKey, { target, reason }) => {
        const rows = liveRows(picked, fromKey);
        if (!rows.length) {
            toast.info(TEXT.MOVE_NOTHING);
            setDialog(null);
            reload();
            return;
        }
        const failures = [];
        for (const row of rows) {
            const result = await reassignDoctor(row.appointmentId, target.doctorId, reason);
            if (!result.success) failures.push(`${row.patientName}: ${result.message}`);
        }
        const label = [target.name, target.staff].filter(Boolean).join(" · ");
        report({ success: !failures.length, message: TEXT.MOVE_PARTIAL(rows.length - failures.length, rows.length, failures.join("; ")) }, TEXT.MOVED(label));
        setDialog(null);
        reload();
    };

    const endedRooms = rooms.filter((r) => r.ended);
    const menuOf = (r) =>
        r.kind !== "exam" || r.state === "serving"
            ? null
            : [
                  { label: TEXT.MENU_PRIORITY, onSelect: () => setDialog({ type: "priority", row: r }) },
                  ...(r.examined
                      ? []
                      : [
                            { label: TEXT.MENU_MOVE, onSelect: () => setDialog({ type: "move", rows: [r], from: r.roomKey }) },
                            null,
                            { label: TEXT.MENU_LEAVE, danger: true, onSelect: () => setDialog({ type: "leave", row: r }) },
                        ]),
              ];
    const bookedLater = (room) => (data?.today ?? []).some((a) => a.doctorId === room.doctorId && ["PENDING", "CONFIRMED"].includes(a.status));

    const row = dialog?.row;
    const roomName = row ? roomOf.get(row.roomKey)?.name : null;

    const table = () => {
        if (!data) return <p className="px-6 py-10 text-center text-body-sm text-muted">{TEXT.LOADING}</p>;
        if (!shown.length && !data.ok) return <p className="px-6 py-10 text-center text-body-sm text-muted">{TEXT.LOAD_ERROR_EMPTY}</p>;
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
                            const decide = needsDecision(r);
                            const menu = menuOf(r);
                            return (
                                <tr
                                    key={r.key}
                                    data-appointment-row={r.appointmentId}
                                    className={cx(r.state === "serving" ? "bg-primary-softer" : decide && "bg-warning-soft", highlightId === r.appointmentId && "bg-warning-soft ring-2 ring-inset ring-warning-solid")}
                                >
                                    <td data-label={columns[0]} className="num font-semibold text-ink">
                                        {r.position ? String(r.position).padStart(2, "0") : "—"}
                                    </td>
                                    <td data-primary>
                                        <span className="cell-primary block">{r.patientName}</span>
                                        <small className="block text-caption text-muted">{r.patientCode}</small>
                                        {r.allergies.length > 0 && <span className="badge badge-danger mt-1 flex w-fit whitespace-normal">{TEXT.ALLERGY(r.allergies)}</span>}
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
                                            {decide ? (
                                                <span className="badge badge-danger">{TEXT.ABSENT_MANY(r.skips)}</span>
                                            ) : (
                                                r.absent && <span className="badge badge-danger">{TEXT.ABSENT}</span>
                                            )}
                                        </span>
                                    </td>
                                    <td data-label={columns[5]}>
                                        {r.priority > 0 ? (
                                            <>
                                                <span className={cx("badge", PRIORITY_BADGE[r.priority])}>{PRIORITY_LABEL[r.priority]}</span>
                                                {r.priorityReason && <small className="mt-1 block text-caption text-body">{r.priorityReason}</small>}
                                            </>
                                        ) : (
                                            <span className="text-body-sm text-muted">{TEXT.PRIORITY_NONE}</span>
                                        )}
                                    </td>
                                    <td data-label={columns[6]} className="num">
                                        {clockOf(r.checkInAt)}
                                    </td>
                                    <td data-actions>
                                        {menu && (
                                            <div className="flex justify-end">
                                                <RowMenu label={TEXT.ACTIONS_FOR(r.patientName)} items={menu} />
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
                <div className="flex flex-col items-end gap-1">
                    <button
                        type="button"
                        className="btn btn-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                        onClick={() => available.length > 0 && setDialog({ type: "walkIn" })}
                        aria-disabled={available.length === 0}
                        aria-describedby={doctorsLoaded && available.length === 0 ? "queue-walkin-hint" : undefined}
                    >
                        {TEXT.WALK_IN}
                    </button>
                    {doctorsLoaded && available.length === 0 && (
                        <small id="queue-walkin-hint" className="text-caption text-muted">
                            {TEXT.NO_DOCTOR_HINT}
                        </small>
                    )}
                </div>
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
                        <span className="num ml-1.5 text-caption text-muted">{rowsOfTab(key).filter((row) => row.state !== "serving").length}</span>
                        {tabAlert(key) && (
                            <>
                                <span aria-hidden="true" className="ml-1 inline-block size-2 rounded-full bg-danger align-middle" />
                                <span className="sr-only">{TEXT.TAB_ALERT}</span>
                            </>
                        )}
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
                                <button
                                    type="button"
                                    className="btn btn-primary h-8 px-3"
                                    onClick={() => setDialog({ type: "move", rows: left, from: room.key, reason: TEXT.MOVE_REASON_ENDED(room.staff) })}
                                >
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
                                ["absent", TEXT.ABSENT_FILTER],
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
                    {data?.at && <p className="px-4 pb-3 text-caption text-muted">{TEXT.UPDATED_AT(clockOf(data.at), REFRESH_MS / 1000)}</p>}
                </Card>
            </div>

            {dialog?.type === "priority" && (
                <QueuePriorityDialog
                    row={row}
                    roomName={roomName}
                    onClose={() => setDialog(null)}
                    onSubmit={({ priority, reason }) =>
                        act(
                            () => setPriority(row.appointmentId, { priority, reason }),
                            TEXT.PRIORITY_CHANGED(row.patientName, PRIORITY_LABEL[priority]),
                        )
                    }
                />
            )}
            {dialog?.type === "move" && (
                <QueueMoveDialog
                    rows={dialog.rows}
                    targets={targetsFor(dialog.from, liveRows(dialog.rows, dialog.from))}
                    defaultReason={dialog.reason}
                    onClose={() => setDialog(null)}
                    onSubmit={(choice) => moveRows(dialog.rows, dialog.from, choice)}
                />
            )}
            {dialog?.type === "leave" && (
                <QueueLeaveDialog
                    row={row}
                    roomName={roomName}
                    onClose={() => setDialog(null)}
                    onSubmit={(reason) =>
                        act(() => markNoShow(row.appointmentId, reason), TEXT.LEFT(row.patientName))
                    }
                />
            )}
            {dialog?.type === "walkIn" && (
                <WalkInDialog doctors={available} onClose={() => setDialog(null)} onSubmit={(request) => act(() => createWalkIn(request), TEXT.WALKED_IN(request.fullName))} />
            )}
        </div>
    );
};

export default ReceptionQueue;

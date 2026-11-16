import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import LabeledSelect from "@/components/ui/LabeledSelect";
import ConfirmActionDialog from "@/components/billing/ConfirmActionDialog";
import KpiTile from "@/components/reception-dashboard/KpiTile";
import OverviewTable from "@/components/reception-dashboard/OverviewTable";
import RoomCard from "@/components/reception-dashboard/RoomCard";
import RowActions from "@/components/reception-dashboard/RowActions";
import TodoList from "@/components/reception-dashboard/TodoList";
import BookingDialog from "@/components/reception/BookingDialog";
import CheckInDialog from "@/components/reception/CheckInDialog";
import ConfirmAppointmentDialog from "@/components/reception/ConfirmAppointmentDialog";
import ConfirmCallDialog from "@/components/reception/ConfirmCallDialog";
import QueueMoveDialog from "@/components/reception/QueueMoveDialog";
import RevenueChart from "@/components/reception/RevenueChart";
import ServiceCell from "@/components/reception/ServiceCell";
import { Card, CancelDialog, RescheduleDialog, WalkInDialog } from "@/components/reception/shared";
import { clinicClock, phoneText, report, useDoctorsOnDuty, usePaging, weekdayDate } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import {
    callAppointment,
    callQueueEntry,
    cancelAppointment,
    checkInAppointment,
    clinicToday,
    confirmAppointment,
    createWalkIn,
    getAppointmentsInRange,
    getFollowUpList,
    getQueueEntries,
    getTodayAppointments,
    getWaitingList,
    markNoShow,
    moveQueueEntry,
    reassignDoctor,
    recordConfirmCall,
    rescheduleAppointment,
} from "@/services/receptionService";
import { getMyShifts } from "@/services/myScheduleService";
import { addDays, ddmm, hhmm, isSunday } from "@/utils/calendar";
import { allergiesOf, appointmentMenu, isLate as lateAt, matchesKeyword, serviceNames, slotOf, stateOf } from "@/utils/checkIn";
import { callBackText, confirmStateOf, shortDate, sortByVisit } from "@/utils/confirmAppointments";
import { CHECK_IN_TEXT, CONFIRM_TEXT, DASHBOARD_TEXT as TEXT, QUEUE_TEXT } from "@/utils/messages";
import { NO_DOCTOR_KEY, entryRows, examRooms, examRows, orderRows, otherRooms, waitingCount } from "@/utils/queueBoard";
import { RECEPTION_PATIENT_CREATE_ROUTE, ROUTES } from "@/utils/routes";
import { cx } from "@/utils/cx";

const PER_PAGE = 5;
const READ = { skipErrorPage: true };
const EMPTY_CI = { keyword: "", state: "notyet", slot: "", doctor: "" };
const EMPTY_CF = { keyword: "", day: "", doctor: "", status: "" };
const list = (r) => (r.success ? (Array.isArray(r.data) ? r.data : (r.data?.items ?? [])) : []);

const loadOverview = async (today, signal) => {
    const config = { ...READ, signal };
    const [todayList, upcoming, waiting, entries, followUps, myShifts] = await Promise.all([
        getTodayAppointments(),
        getAppointmentsInRange({ fromDate: addDays(today, 1), toDate: addDays(today, 7) }, config),
        getWaitingList(),
        getQueueEntries(),
        getFollowUpList({ fromDate: today, toDate: addDays(today, 6), hasAppointment: false, pageSize: 1 }, config),
        getMyShifts({ fromDate: today, toDate: today }),
    ]);
    return {
        ok: todayList.success && upcoming.success && waiting.success,
        today: list(todayList),
        upcoming: upcoming.success ? upcoming.items : [],
        waiting: list(waiting),
        entries: list(entries),
        followUps: Number(followUps.data?.totalCount ?? list(followUps).length),
        myShifts: list(myShifts).sort((a, b) => String(a.shiftStart).localeCompare(String(b.shiftStart))),
    };
};

const ReceptionistDashboard = () => {
    const navigate = useNavigate();
    const [today] = useState(clinicToday);
    const [version, setVersion] = useState(0);
    const [data, setData] = useState(null);
    const [ci, setCi] = useState(EMPTY_CI);
    const [cf, setCf] = useState(EMPTY_CF);
    const [dialog, setDialog] = useState(null);
    const { doctors, available } = useDoctorsOnDuty(version);

    usePageTitle(TEXT.DOC_TITLE);

    useEffect(() => {
        const controller = new AbortController();
        loadOverview(today, controller.signal).then((next) => !controller.signal.aborted && setData(next));
        return () => controller.abort();
    }, [today, version]);

    const reload = useCallback(() => setVersion((v) => v + 1), []);
    const act = async (request, successText) => {
        if (report(await request, successText)) {
            setDialog(null);
            reload();
        }
    };
    const close = () => setDialog(null);

    const now = clinicClock();
    const todays = data?.today ?? [];
    const upcoming = data?.upcoming ?? [];
    const isLate = (a) => lateAt(a, now);

    const serving = todays.filter((a) => a.status === "IN_SERVICE");
    const rooms = [...examRooms(doctors, data?.waiting ?? [], serving), ...otherRooms(data?.entries ?? [])];
    const rows = orderRows([...examRows(data?.waiting ?? [], serving), ...entryRows(data?.entries ?? [])], rooms);
    const roomOf = new Map(rooms.map((r) => [r.key, r]));
    const byTab = (state, tab) => rows.filter((r) => state(r) && roomOf.get(r.roomKey)?.tab === tab).length;
    const isWaiting = (r) => r.state !== "serving";
    const isServing = (r) => r.state === "serving";
    const laterOf = (room) => todays.filter((a) => a.doctorId === room.doctorId && stateOf(a) === "notyet").length;

    const live = todays.filter((a) => a.status !== "CANCELLED");
    const booked = live.filter((a) => a.timeSlotStart).length;
    const walkIn = live.length - booked;
    const notYet = todays.filter((a) => stateOf(a) === "notyet");
    const late = notYet.filter(isLate).length;
    const count = (status) => todays.filter((a) => a.status === status).length;

    const ciRows = todays
        .filter((a) => (!ci.state || stateOf(a) === ci.state) && matchesKeyword(a, ci.keyword) && (!ci.slot || slotOf(a) === ci.slot) && (!ci.doctor || String(a.doctorId) === ci.doctor))
        .sort((a, b) => (a.timeSlotStart ?? "99").localeCompare(b.timeSlotStart ?? "99"));
    const ciPaging = usePaging(ciRows, PER_PAGE);

    const needConfirm = upcoming.filter((a) => a.status === "PENDING");
    const cfRows = sortByVisit(
        needConfirm.filter(
            (a) =>
                matchesKeyword(a, cf.keyword) &&
                (!cf.day || a.appointmentDate === cf.day) &&
                (!cf.doctor || String(a.doctorId) === cf.doctor) &&
                (!cf.status || confirmStateOf(a) === cf.status),
        ),
    );
    const cfPaging = usePaging(cfRows, PER_PAGE);

    const setter = (set, paging) => (key) => (value) => {
        set((f) => ({ ...f, [key]: value }));
        paging.setPage(1);
    };
    const setCiFilter = setter(setCi, ciPaging);
    const setCfFilter = setter(setCf, cfPaging);

    const doctorOptions = [["", TEXT.ALL_DOCTORS], ...new Map([...todays, ...upcoming].filter((a) => a.doctorId).map((a) => [String(a.doctorId), a.doctorName])).entries()];
    const slotOptions = [["", TEXT.ALL_SLOTS], ...[...new Set(todays.map(slotOf).filter(Boolean))].sort().map((s) => [s, TEXT.SLOT_OPTION(s)])];
    const ciStateOptions = [
        ["notyet", TEXT.NOT_CHECKED_IN],
        ["", TEXT.ALL_STATUSES],
        ...Object.entries(CHECK_IN_TEXT.STATES)
            .filter(([k]) => k !== "notyet")
            .map(([k, [label]]) => [k, label]),
    ];
    const dayOptions = [["", TEXT.ALL_DAYS], ...[1, 2, 3, 4, 5, 6, 7].map((i) => addDays(today, i)).filter((k) => !isSunday(k)).map((k) => [k, shortDate(k)])];
    const cfStatusOptions = [["", TEXT.ALL_STATUSES], ...["pending", "callback", "noanswer"].map((k) => [k, CONFIRM_TEXT.STATES[k][0]])];

    const callbackToday = needConfirm.filter((a) => a.confirmCallOutcome === "CallBack" && String(a.confirmCallBackAt ?? "").startsWith(today)).length;
    const newOnes = needConfirm.filter((a) => !a.confirmCallOutcome).length;
    const endedLeft = rooms.filter((r) => r.ended).reduce((sum, r) => sum + waitingCount(rows, r.key) + laterOf(r), 0);
    const todo = [
        { key: "late", count: late, to: ROUTES.RECEPTION_CHECK_IN },
        { key: "callback", count: callbackToday, to: ROUTES.RECEPTION_APPOINTMENTS, state: { status: "callback" } },
        { key: "pending", count: newOnes, to: ROUTES.RECEPTION_APPOINTMENTS, state: { status: "pending" } },
        { key: "ended", count: endedLeft, to: ROUTES.RECEPTION_QUEUE },
        { key: "followUp", count: data?.followUps ?? 0, to: ROUTES.RECEPTION_FOLLOW_UPS },
    ];

    const menuFor = (a) => {
        const isToday = a.appointmentDate === today;
        return appointmentMenu(a, { isToday, late: isToday && isLate(a), open: (type) => () => setDialog({ type, item: a }) });
    };

    const patientCell = (a) => {
        const allergies = allergiesOf(a);
        return (
            <td data-primary>
                <span className="cell-primary block">{a.patientName}</span>
                <small className="block text-caption text-muted">{a.patientCode}</small>
                {allergies.length > 0 && <span className="badge badge-danger mt-1 flex w-fit whitespace-normal">{CHECK_IN_TEXT.ALLERGY(allergies.join(", "))}</span>}
            </td>
        );
    };

    const confirmCell = (a) => {
        const state = confirmStateOf(a);
        const [label, badge] = CONFIRM_TEXT.STATES[state];
        const when = state === "callback" ? callBackText(a) : null;
        return (
            <>
                <span className={cx("badge", badge)}>{label}</span>
                {when && <small className="block pt-0.5 text-caption text-muted">{CONFIRM_TEXT.CALL_BACK_AT(when)}</small>}
            </>
        );
    };

    const callNext = async (room, next) => {
        const again = next.state === "called";
        const result = next.kind === "exam" ? await callAppointment(next.appointmentId) : await callQueueEntry(next.entryId);
        if (report(result, TEXT.CALLED(again, String(next.position).padStart(2, "0"), next.patientName, room.name))) reload();
    };

    const moveTargets = (room) => rooms.filter((r) => r.tab === room.tab && r.key !== room.key && r.active && !r.off).map((r) => ({ ...r, waiting: waitingCount(rows, r.key) }));

    const moveRows = async (picked, fromKey, { target, reason }) => {
        // The rows still waiting in that room now, not the ones seen when the dialog opened
        const moving = rows.filter((r) => r.roomKey === fromKey && r.state !== "serving" && picked.some((p) => p.key === r.key || picked.length > 1));
        if (!moving.length) {
            toast.info(QUEUE_TEXT.MOVE_NOTHING);
            setDialog(null);
            reload();
            return;
        }
        const failures = [];
        for (const row of moving) {
            const result =
                row.kind === "exam" ? await reassignDoctor(row.appointmentId, target.doctorId, reason) : await moveQueueEntry(row.entryId, target.roomId, reason);
            if (!result.success) failures.push(`${row.patientName}: ${result.message}`);
        }
        const label = [target.name, target.staff].filter(Boolean).join(" · ");
        report({ success: !failures.length, message: failures.join("; ") }, QUEUE_TEXT.MOVED(label));
        setDialog(null);
        reload();
    };

    const myShift = (data?.myShifts ?? []).find((x) => !x.actualEndTime && hhmm(x.shiftEnd) > now) ?? data?.myShifts?.at(-1);
    const a = dialog?.item;

    return (
        <div className="app-content min-h-full space-y-5">
            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-64 flex-1">
                    <h1 className="page-title">{TEXT.TITLE}</h1>
                    <p className="page-description first-letter:uppercase">
                        {TEXT.SHIFT_LINE(weekdayDate(today), myShift && TEXT.MY_SHIFT(hhmm(myShift.shiftStart), hhmm(myShift.shiftEnd)), myShift?.roomName)}
                    </p>
                </div>
                <div role="group" aria-label={TEXT.QUICK} className="flex flex-wrap gap-2">
                    <Link to={ROUTES.RECEPTION_INVOICES} className="btn btn-secondary">
                        {TEXT.PAY}
                    </Link>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate(RECEPTION_PATIENT_CREATE_ROUTE)}>
                        {TEXT.NEW_PATIENT}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "book" })}>
                        {TEXT.BOOK}
                    </button>
                    <button type="button" className="btn btn-primary" disabled={available.length === 0} onClick={() => setDialog({ type: "walkIn" })}>
                        {TEXT.WALK_IN}
                    </button>
                </div>
            </div>

            {data && !data.ok && (
                <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                    <span className="flex-1">{TEXT.LOAD_ERROR}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={reload}>
                        {TEXT.RETRY}
                    </button>
                </div>
            )}

            <div aria-label={TEXT.KPI_LABEL} role="group" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                <KpiTile to={ROUTES.RECEPTION_CHECK_IN} label={TEXT.KPI_TODAY} value={live.length} sub={TEXT.KPI_TODAY_SUB(booked, walkIn)} />
                <KpiTile
                    to={ROUTES.RECEPTION_CHECK_IN}
                    label={TEXT.KPI_NOT_YET}
                    value={notYet.length}
                    sub={late ? <span className="font-semibold text-warning">{TEXT.KPI_LATE(late)}</span> : TEXT.KPI_NO_LATE}
                />
                <KpiTile
                    to={ROUTES.RECEPTION_QUEUE}
                    label={TEXT.KPI_WAITING}
                    value={rows.filter(isWaiting).length}
                    sub={TEXT.KPI_BY_ROOM(byTab(isWaiting, "kham"), byTab(isWaiting, "xq"), byTab(isWaiting, "tp"))}
                />
                <KpiTile
                    to={ROUTES.RECEPTION_QUEUE}
                    label={TEXT.KPI_SERVING}
                    value={rows.filter(isServing).length}
                    sub={TEXT.KPI_BY_ROOM(byTab(isServing, "kham"), byTab(isServing, "xq"), byTab(isServing, "tp"))}
                />
                <KpiTile to={ROUTES.RECEPTION_CHECK_IN} label={TEXT.KPI_DONE} value={count("COMPLETED")} sub={TEXT.KPI_DONE_SUB(count("NO_SHOW"), count("CANCELLED"))} />
            </div>

            <OverviewTable
                id="dci"
                title={TEXT.CHECK_IN_TITLE}
                count={ciRows.length}
                hint={ci.state === "notyet" ? TEXT.CHECK_IN_HINT_NOT_YET : TEXT.CHECK_IN_HINT_ALL}
                link={{ to: ROUTES.RECEPTION_CHECK_IN, label: TEXT.CHECK_IN_LINK }}
                keyword={ci.keyword}
                onKeyword={setCiFilter("keyword")}
                filters={
                    <>
                        <LabeledSelect id="dci-state" label={TEXT.STATUS} value={ci.state} options={ciStateOptions} onChange={setCiFilter("state")} />
                        <LabeledSelect id="dci-slot" label={TEXT.SLOT} value={ci.slot} options={slotOptions} onChange={setCiFilter("slot")} />
                        <LabeledSelect id="dci-doctor" label={TEXT.DOCTOR} value={ci.doctor} options={doctorOptions} onChange={setCiFilter("doctor")} />
                    </>
                }
                columns={TEXT.CHECK_IN_COLUMNS}
                paging={ciPaging}
                loading={!data}
                empty={ci.keyword || ci.slot || ci.doctor || ci.state !== "notyet" ? TEXT.EMPTY_FILTERED : TEXT.CHECK_IN_EMPTY}
                renderRow={(row) => {
                    const state = stateOf(row);
                    const [label, badge] = CHECK_IN_TEXT.STATES[state];
                    return (
                        <tr key={row.id} className={state === "cancelled" ? "opacity-60" : undefined}>
                            <td data-label={TEXT.CHECK_IN_COLUMNS[0]} className="num whitespace-nowrap font-semibold text-ink">
                                {slotOf(row) || CHECK_IN_TEXT.WALK_IN_SLOT}
                                {isLate(row) && <small className="block font-normal text-caption text-warning">{TEXT.LATE}</small>}
                            </td>
                            {patientCell(row)}
                            <td data-label={TEXT.CHECK_IN_COLUMNS[2]} className="num whitespace-nowrap">
                                {phoneText(row.patientPhoneNumber)}
                            </td>
                            <td data-label={TEXT.CHECK_IN_COLUMNS[3]} className="min-w-40">
                                <ServiceCell names={serviceNames(row)} />
                            </td>
                            <td data-label={TEXT.CHECK_IN_COLUMNS[4]} className="min-w-36">
                                {row.doctorName ?? CHECK_IN_TEXT.NO_DOCTOR}
                                {state === "notyet" && rooms.find((r) => r.doctorId === row.doctorId)?.ended && (
                                    <small className="block text-caption text-danger">{CHECK_IN_TEXT.DOCTOR_ENDED}</small>
                                )}
                            </td>
                            <td data-label={TEXT.CHECK_IN_COLUMNS[5]}>{state === "notyet" ? confirmCell(row) : <span className={cx("badge", badge)}>{label}</span>}</td>
                            <td data-actions>
                                {state === "notyet" && (
                                    <RowActions
                                        name={row.patientName}
                                        primary={{ label: CHECK_IN_TEXT.CHECK_IN, onClick: () => setDialog({ type: "checkIn", item: row }) }}
                                        items={menuFor(row)}
                                    />
                                )}
                            </td>
                        </tr>
                    );
                }}
            />

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Card title={TEXT.ROOMS_TITLE} link={{ to: ROUTES.RECEPTION_QUEUE, label: TEXT.ROOMS_LINK }}>
                    <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                        {rooms.filter((room) => room.key !== NO_DOCTOR_KEY).map((room) => (
                            <RoomCard
                                key={room.key}
                                room={room}
                                rows={rows.filter((r) => r.roomKey === room.key)}
                                later={room.ended ? laterOf(room) : 0}
                                onCall={callNext}
                                onMoveAll={(from, moving) => setDialog({ type: "move", from, rows: moving, reason: QUEUE_TEXT.MOVE_REASON_ENDED(from.staff) })}
                            />
                        ))}
                    </ul>
                </Card>
                <TodoList items={todo} />
            </div>

            <OverviewTable
                id="dcf"
                title={TEXT.CONFIRM_TITLE}
                count={cfRows.length}
                hint={TEXT.CONFIRM_HINT(ddmm(addDays(today, 1)), ddmm(addDays(today, 7)))}
                link={{ to: ROUTES.RECEPTION_APPOINTMENTS, label: TEXT.CONFIRM_LINK }}
                keyword={cf.keyword}
                onKeyword={setCfFilter("keyword")}
                filters={
                    <>
                        <LabeledSelect id="dcf-day" label={TEXT.APPOINTMENT_DAY} value={cf.day} options={dayOptions} onChange={setCfFilter("day")} />
                        <LabeledSelect id="dcf-doctor" label={TEXT.DOCTOR} value={cf.doctor} options={doctorOptions} onChange={setCfFilter("doctor")} />
                        <LabeledSelect id="dcf-status" label={TEXT.STATUS} value={cf.status} options={cfStatusOptions} onChange={setCfFilter("status")} />
                    </>
                }
                columns={TEXT.CONFIRM_COLUMNS}
                paging={cfPaging}
                loading={!data}
                empty={cf.keyword || cf.day || cf.doctor || cf.status ? TEXT.EMPTY_FILTERED : TEXT.CONFIRM_EMPTY}
                renderRow={(row) => (
                    <tr key={row.id}>
                        <td data-label={TEXT.CONFIRM_COLUMNS[0]} className="whitespace-nowrap">
                            <b className="text-ink">{shortDate(row.appointmentDate)}</b>
                            <small className="num block text-caption text-muted">{TEXT.SLOT_LINE(slotOf(row))}</small>
                        </td>
                        {patientCell(row)}
                        <td data-label={TEXT.CONFIRM_COLUMNS[2]} className="num whitespace-nowrap">
                            {phoneText(row.patientPhoneNumber)}
                        </td>
                        <td data-label={TEXT.CONFIRM_COLUMNS[3]} className="min-w-36">
                            {row.doctorName ?? CHECK_IN_TEXT.NO_DOCTOR}
                        </td>
                        <td data-label={TEXT.CONFIRM_COLUMNS[4]} className="min-w-40">
                            <ServiceCell names={serviceNames(row)} />
                        </td>
                        <td data-label={TEXT.CONFIRM_COLUMNS[5]}>{confirmCell(row)}</td>
                        <td data-actions>
                            <RowActions
                                name={row.patientName}
                                primary={{ label: CONFIRM_TEXT.CONFIRM, onClick: () => setDialog({ type: "confirm", item: row }) }}
                                items={menuFor(row)}
                            />
                        </td>
                    </tr>
                )}
            />

            <RevenueChart />

            {dialog?.type === "checkIn" && (
                <CheckInDialog
                    appointment={a}
                    doctors={doctors}
                    waiting={data?.waiting ?? []}
                    onClose={close}
                    onSubmit={(v) => act(checkInAppointment(a.id, v), CHECK_IN_TEXT.CHECKED_IN(a.patientName, v.room))}
                />
            )}
            {dialog?.type === "confirm" && <ConfirmAppointmentDialog appointment={a} onClose={close} onSubmit={() => act(confirmAppointment(a.id), CONFIRM_TEXT.CONFIRMED(a.patientName))} />}
            {dialog?.type === "call" && (
                <ConfirmCallDialog
                    appointment={a}
                    today={today}
                    onClose={close}
                    onSubmit={(v) => {
                        const when = `${ddmm(v.callBackDate)} ${v.callBackTime}`;
                        return act(
                            recordConfirmCall(a.id, v),
                            v.outcome === "CallBack" ? CONFIRM_TEXT.WILL_CALL_BACK(a.patientName, when) : CONFIRM_TEXT.NO_ANSWER(a.patientName, when),
                        );
                    }}
                />
            )}
            {dialog?.type === "noShow" && (
                <ConfirmActionDialog
                    title={TEXT.NO_SHOW_TITLE}
                    description={TEXT.NO_SHOW_SUB(a.patientName, hhmm(a.timeSlotStart))}
                    body={TEXT.NO_SHOW_BODY(slotOf(a), a.doctorName)}
                    closeLabel={CONFIRM_TEXT.CLOSE}
                    submitLabel={TEXT.ACT_NO_SHOW}
                    onClose={close}
                    onSubmit={() => act(markNoShow(a.id), TEXT.NO_SHOW_DONE(a.patientName))}
                />
            )}
            {dialog?.type === "reschedule" && (
                <RescheduleDialog appointment={a} onClose={close} onSubmit={(v) => act(rescheduleAppointment(a.id, v), CONFIRM_TEXT.RESCHEDULED(a.patientName))} />
            )}
            {dialog?.type === "cancel" && <CancelDialog appointment={a} onClose={close} onSubmit={(reason) => act(cancelAppointment(a.id, reason), CONFIRM_TEXT.CANCELLED(a.patientName))} />}
            {dialog?.type === "move" && (
                <QueueMoveDialog
                    rows={dialog.rows}
                    targets={moveTargets(dialog.from)}
                    defaultReason={dialog.reason}
                    onClose={close}
                    onSubmit={(choice) => moveRows(dialog.rows, dialog.from.key, choice)}
                />
            )}
            {dialog?.type === "walkIn" && (
                <WalkInDialog doctors={available} onClose={close} onSubmit={(request) => act(createWalkIn(request), CHECK_IN_TEXT.WALKED_IN(request.fullName))} />
            )}
            {dialog?.type === "book" && (
                <BookingDialog
                    initial={{ date: today }}
                    onClose={close}
                    onBooked={(b) => {
                        toast.success(CHECK_IN_TEXT.BOOKED(b.patientName, hhmm(b.timeSlotStart)), { role: "status" });
                        setDialog(null);
                        reload();
                    }}
                />
            )}
        </div>
    );
};

export default ReceptionistDashboard;

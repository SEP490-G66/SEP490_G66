import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AppointmentsChart from "@/components/reception-dashboard/AppointmentsChart";
import KpiTile from "@/components/reception-dashboard/KpiTile";
import RoomQueueBars from "@/components/reception-dashboard/RoomQueueBars";
import TodoBoard from "@/components/reception-dashboard/TodoBoard";
import BookingDialog from "@/components/reception/BookingDialog";
import { WalkInDialog } from "@/components/reception/shared";
import { clinicClock, report, useDoctorsOnDuty, weekdayDate } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { CHANGE_REQUEST_STATUS, getChangeRequests } from "@/services/appointmentChangeRequestService";
import { getCurrentCashSession } from "@/services/cashSessionService";
import {
    clinicToday,
    createWalkIn,
    getAppointmentsInRange,
    getCashierRefunds,
    getConsultations,
    getFollowUpList,
    getQueueEntries,
    getTodayAppointments,
    getWaitingList,
} from "@/services/receptionService";
import { getMyShifts } from "@/services/myScheduleService";
import { addDays, hhmm, mondayOf } from "@/utils/calendar";
import { summarize, transactionsOf } from "@/utils/cashShift";
import { isLate as lateAt, stateOf } from "@/utils/checkIn";
import { CHECK_IN_TEXT, DASHBOARD_TEXT as TEXT } from "@/utils/messages";
import { NO_DOCTOR_KEY, entryRows, examRooms, examRows, orderRows, otherRooms, waitingCount } from "@/utils/queueBoard";
import { weekDays } from "@/utils/receptionDashboard";
import { RECEPTION_PATIENT_CREATE_ROUTE, ROUTES } from "@/utils/routes";
import { cx } from "@/utils/cx";

const READ = { skipErrorPage: true };
const list = (r) => (r.success ? (Array.isArray(r.data) ? r.data : (r.data?.items ?? [])) : []);
const later = (a, b) => (a > b ? a : b);

const loadOverview = async (today, signal) => {
    const config = { ...READ, signal };
    const monday = mondayOf(today);
    const [todayList, range, waiting, entries, followUps, myShifts, cash, consults, changes, refunds] = await Promise.all([
        getTodayAppointments(),
        // The week on the chart, and the next 7 days for appointments to confirm
        getAppointmentsInRange({ fromDate: monday, toDate: later(addDays(monday, 6), addDays(today, 7)) }, config),
        getWaitingList(),
        getQueueEntries(),
        getFollowUpList({ fromDate: today, toDate: addDays(today, 6), hasAppointment: false, pageSize: 1 }, config),
        getMyShifts({ fromDate: today, toDate: today }),
        getCurrentCashSession(config),
        getConsultations({ status: "New", pageSize: 1 }),
        getChangeRequests(CHANGE_REQUEST_STATUS.PENDING),
        getCashierRefunds({ status: "Approved" }, config),
    ]);
    const session = cash.success ? cash.data : null;
    const receipts = session ? summarize(transactionsOf(session)).rows.Receipt : null;
    return {
        ok: todayList.success && range.success && waiting.success,
        today: list(todayList),
        range: range.success ? range.items : [],
        waiting: list(waiting),
        waitingOk: waiting.success,
        entries: list(entries),
        followUps: Number(followUps.data?.totalCount ?? list(followUps).length),
        myShifts: list(myShifts).sort((a, b) => String(a.shiftStart).localeCompare(String(b.shiftStart))),
        cashOpen: Boolean(session),
        revenue: receipts ? receipts.cash + receipts.transfer : 0,
        consults: Number(consults.data?.totalCount ?? list(consults).length),
        changes: list(changes).length,
        refunds: list(refunds).length,
    };
};

const ReceptionistDashboard = () => {
    const navigate = useNavigate();
    const [today] = useState(clinicToday);
    const [version, setVersion] = useState(0);
    const [data, setData] = useState(null);
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
    const range = data?.range ?? [];

    const serving = todays.filter((a) => a.status === "IN_SERVICE");
    const rooms = [...examRooms(doctors, data?.waiting ?? [], serving), ...otherRooms(data?.entries ?? [])];
    const rows = orderRows([...examRows(data?.waiting ?? [], serving, data?.entries ?? []), ...entryRows(data?.entries ?? [])], rooms);
    const laterOf = (room) => todays.filter((a) => a.doctorId === room.doctorId && stateOf(a) === "notyet").length;
    const roomBars = rooms
        .filter((r) => r.key !== NO_DOCTOR_KEY)
        .map((r) => ({ key: r.key, tab: r.tab, name: r.name, staff: r.staff, ended: r.ended, endAt: r.endAt, wait: waitingCount(rows, r.key) }));

    const late = todays.filter((a) => lateAt(a, now)).length;
    const needConfirm = [...todays, ...range.filter((a) => a.appointmentDate > today && a.appointmentDate <= addDays(today, 7))].filter((a) => a.status === "PENDING").length;
    const endedLeft = rooms.filter((r) => r.ended).reduce((sum, r) => sum + waitingCount(rows, r.key) + laterOf(r), 0);

    const todo = [
        {
            key: "desk",
            items: [
                { key: "ended", count: endedLeft, to: ROUTES.RECEPTION_QUEUE },
                { key: "late", count: late, to: ROUTES.RECEPTION_CHECK_IN },
                { key: "refund", count: data?.refunds ?? 0, to: ROUTES.RECEPTION_REFUNDS },
            ],
        },
        {
            key: "call",
            items: [
                { key: "pending", count: needConfirm, to: ROUTES.RECEPTION_APPOINTMENTS, state: { status: "pending" } },
                { key: "change", count: data?.changes ?? 0, to: ROUTES.RECEPTION_CHANGE_REQUESTS },
            ],
        },
        {
            key: "care",
            items: [
                { key: "consult", count: data?.consults ?? 0, to: ROUTES.RECEPTION_CONSULTATIONS },
                { key: "followUp", count: data?.followUps ?? 0, to: ROUTES.RECEPTION_FOLLOW_UPS },
            ],
        },
    ];

    const cashOpen = data?.cashOpen ?? false;
    const myShift = (data?.myShifts ?? []).find((x) => !x.actualEndTime && hhmm(x.shiftEnd) > now) ?? data?.myShifts?.at(-1);

    return (
        <div className="app-content min-h-full space-y-4">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
                <div className="min-w-64 flex-1">
                    <h1 className="page-title">{TEXT.TITLE}</h1>
                    <div className="page-description mt-1 flex flex-wrap items-center gap-2">
                        <span className="first-letter:uppercase">
                            {TEXT.SHIFT_LINE(weekdayDate(today), myShift && TEXT.MY_SHIFT(hhmm(myShift.shiftStart), hhmm(myShift.shiftEnd)), myShift?.roomName)}
                        </span>
                        {data && (
                            <Link
                                to={ROUTES.RECEPTION_CASH_HANDOVER}
                                className={cx(
                                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold",
                                    cashOpen ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
                                )}
                            >
                                <i className="size-1.75 rounded-full bg-current" aria-hidden="true" />
                                {cashOpen ? TEXT.CASH_OPEN : TEXT.CASH_CLOSED}
                            </Link>
                        )}
                    </div>
                </div>
                <div role="group" aria-label={TEXT.QUICK} className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-secondary" onClick={() => navigate(RECEPTION_PATIENT_CREATE_ROUTE)}>
                        {TEXT.NEW_PATIENT}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "book" })}>
                        {TEXT.BOOK}
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={available.length === 0} onClick={() => setDialog({ type: "walkIn" })}>
                        {TEXT.WALK_IN}
                    </button>
                    <Link to={ROUTES.RECEPTION_PAYMENTS} className="btn btn-primary">
                        {TEXT.PAY}
                    </Link>
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

            <div aria-label={TEXT.KPI_LABEL} role="group" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                <KpiTile to={ROUTES.RECEPTION_CHECK_IN} label={TEXT.KPI_TOTAL} value={todays.length} unit={TEXT.UNIT_APPOINTMENT} />
                <KpiTile to={ROUTES.RECEPTION_APPOINTMENTS} state={{ status: "pending" }} label={TEXT.KPI_PENDING} value={needConfirm} unit={TEXT.UNIT_APPOINTMENT} />
                {cashOpen ? (
                    <KpiTile to={ROUTES.RECEPTION_PAYMENTS} label={TEXT.KPI_REVENUE} value={data.revenue.toLocaleString("vi-VN")} unit={TEXT.UNIT_MONEY} />
                ) : (
                    <KpiTile to={ROUTES.RECEPTION_CASH_HANDOVER} label={TEXT.KPI_REVENUE} value="—" off />
                )}
                <KpiTile to={ROUTES.RECEPTION_CONSULTATIONS} label={TEXT.KPI_CONSULT} value={data?.consults ?? 0} unit={TEXT.UNIT_REQUEST} />
            </div>

            <div className="grid items-stretch gap-4 lg:grid-cols-2">
                <AppointmentsChart days={weekDays(today, range, todays)} nowHour={Number(now.slice(0, 2))} />
                <RoomQueueBars rooms={roomBars} />
                <TodoBoard groups={todo} />
            </div>

            {dialog?.type === "walkIn" && (
                <WalkInDialog doctors={available} waiting={data?.waitingOk ? data.waiting : null} onClose={close} onSubmit={(request) => act(createWalkIn(request), CHECK_IN_TEXT.WALKED_IN(request.fullName))} />
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

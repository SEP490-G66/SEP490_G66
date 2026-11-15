import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LabeledSelect from "@/components/ui/LabeledSelect";
import CheckInDialog from "@/components/reception/CheckInDialog";
import ConfirmAppointmentDialog from "@/components/reception/ConfirmAppointmentDialog";
import ConfirmCallDialog from "@/components/reception/ConfirmCallDialog";
import RevenueChart from "@/components/reception/RevenueChart";
import ServiceCell from "@/components/reception/ServiceCell";
import { Card, CancelDialog, RescheduleDialog } from "@/components/reception/shared";
import { clinicClock, phoneText, report, useDoctorsOnDuty, usePaging, weekdayDate } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import {
    cancelAppointment,
    checkInAppointment,
    clinicToday,
    confirmAppointment,
    getAppointmentsInRange,
    getTodayAppointments,
    getWaitingList,
    recordConfirmCall,
    rescheduleAppointment,
} from "@/services/receptionService";
import { getSessionUserName } from "@/services/sessionStore";
import { addDays, ddmm, isSunday } from "@/utils/calendar";
import { shiftHours } from "@/utils/cashShift";
import { allergiesOf, matchesKeyword, serviceNames, slotOf } from "@/utils/checkIn";
import { callBackText, confirmStateOf, shortDate, sortByVisit } from "@/utils/confirmAppointments";
import { CHECK_IN_TEXT, CONFIRM_TEXT, DASHBOARD_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import { cx } from "@/utils/cx";

const PER_PAGE = 5;
const ENDED = ["Ended", "OnLeave"];
const EMPTY_CI = { keyword: "", slot: "", doctor: "" };
const EMPTY_CF = { keyword: "", day: "", doctor: "", status: "" };
const CF_STATUS = [["", CONFIRM_TEXT.ALL_STATUSES], ...["pending", "callback", "noanswer"].map((k) => [k, CONFIRM_TEXT.STATES[k][0]])];

const ReceptionistDashboard = () => {
    const [today] = useState(clinicToday);
    const [version, setVersion] = useState(0);
    const [data, setData] = useState(null);
    const [ci, setCi] = useState(EMPTY_CI);
    const [cf, setCf] = useState(EMPTY_CF);
    const [dialog, setDialog] = useState(null);
    const { doctors } = useDoctorsOnDuty(version);

    usePageTitle(TEXT.DOC_TITLE);

    useEffect(() => {
        const controller = new AbortController();
        const config = { skipErrorPage: true, signal: controller.signal };
        Promise.all([getTodayAppointments(), getAppointmentsInRange({ fromDate: today, toDate: addDays(today, 30) }, config), getWaitingList()]).then(
            ([todayList, range, waiting]) => {
                if (controller.signal.aborted) return;
                setData({
                    ok: todayList.success && range.success,
                    today: todayList.success ? (todayList.data?.items ?? []) : [],
                    upcoming: range.success ? range.items : [],
                    waiting: waiting.success && Array.isArray(waiting.data) ? waiting.data : [],
                });
            },
        );
        return () => controller.abort();
    }, [today, version]);

    const reload = useCallback(() => setVersion((v) => v + 1), []);
    const act = async (request, successText) => {
        if (report(await request, successText)) {
            setDialog(null);
            reload();
        }
    };

    const endedIds = new Set(doctors.filter((d) => ENDED.includes(d.status)).map((d) => d.id));
    const doctorOptions = (list) => [["", CONFIRM_TEXT.ALL_DOCTORS], ...new Map(list.filter((a) => a.doctorId).map((a) => [String(a.doctorId), a.doctorName])).entries()];

    const notYet = (data?.today ?? []).filter((a) => ["PENDING", "CONFIRMED"].includes(a.status));
    const ciRows = notYet
        .filter((a) => matchesKeyword(a, ci.keyword) && (!ci.slot || slotOf(a) === ci.slot) && (!ci.doctor || String(a.doctorId) === ci.doctor))
        .sort((a, b) => (a.timeSlotStart ?? "99").localeCompare(b.timeSlotStart ?? "99"));
    const ciPaging = usePaging(ciRows, PER_PAGE);

    const pending = (data?.upcoming ?? []).filter((a) => a.status === "PENDING");
    const cfRows = sortByVisit(
        pending.filter(
            (a) =>
                matchesKeyword(a, cf.keyword) &&
                (!cf.day || a.appointmentDate === cf.day) &&
                (!cf.doctor || String(a.doctorId) === cf.doctor) &&
                (!cf.status || confirmStateOf(a) === cf.status),
        ),
    );
    const cfPaging = usePaging(cfRows, PER_PAGE);
    const dayOptions = [["", CONFIRM_TEXT.ALL_STATUSES]];
    for (let i = 0; i < 14; i += 1) {
        const k = addDays(today, i);
        if (!isSunday(k)) dayOptions.push([k, k === today ? TEXT.TODAY : shortDate(k)]);
    }

    const setter = (set, paging) => (key) => (value) => {
        set((f) => ({ ...f, [key]: value }));
        paging.setPage(1);
    };
    const setCiFilter = setter(setCi, ciPaging);
    const setCfFilter = setter(setCf, cfPaging);

    const now = clinicClock();
    const shift = now < "12:30" ? "Morning" : "Afternoon";
    const firstName = (getSessionUserName() ?? "").trim().split(" ").at(-1);
    const a = dialog?.item;
    const close = () => setDialog(null);

    const search = (id, value, onChange) => (
        <div className="flex min-w-56 flex-1 flex-col gap-1">
            <label htmlFor={id} className="text-caption text-muted">
                {CHECK_IN_TEXT.PATIENT}
            </label>
            <input id={id} type="search" className="input" placeholder={CHECK_IN_TEXT.SEARCH_PLACEHOLDER} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    );

    const patientCell = (row) => {
        const allergies = allergiesOf(row);
        return (
            <td data-primary>
                <span className="cell-primary block">{row.patientName}</span>
                {allergies.length > 0 && <span className="badge badge-danger mt-1 flex w-fit whitespace-normal">{CHECK_IN_TEXT.ALLERGY(allergies[0])}</span>}
            </td>
        );
    };

    const confirmCell = (row) => {
        const state = confirmStateOf(row);
        const [label, badge] = CONFIRM_TEXT.STATES[state];
        const when = state === "callback" ? callBackText(row) : null;
        return (
            <>
                <span className={cx("badge", badge)}>{label}</span>
                {when && <small className="block pt-0.5 text-caption text-muted">{CONFIRM_TEXT.CALL_BACK_AT(when)}</small>}
            </>
        );
    };

    const table = (columns, paging, empty, renderRow) => (
        <>
            {paging.pageItems.length ? (
                <div className="table-wrap rounded-none border-x-0">
                    <table className="table table-stack [&_td]:px-3 [&_td]:align-top [&_th]:px-3">
                        <thead>
                            <tr>
                                {columns.map((c, i) => (
                                    <th key={c}>{i === columns.length - 1 ? <span className="sr-only">{c}</span> : c}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>{paging.pageItems.map(renderRow)}</tbody>
                    </table>
                </div>
            ) : (
                <p className="px-6 py-8 text-center text-body-sm text-muted">{data ? empty : CHECK_IN_TEXT.LOADING}</p>
            )}
            {paging.footer}
        </>
    );

    return (
        <div className="app-content min-h-full space-y-5">
            <div>
                <h1 className="page-title">{TEXT.HELLO(firstName)}</h1>
                <p className="page-description first-letter:uppercase">
                    {TEXT.SHIFT_LINE(weekdayDate(today), `${TEXT.SHIFT_FULL[shift]} ${shiftHours(shift).join(" – ")}`)}
                </p>
            </div>

            <RevenueChart />

            {data && !data.ok && (
                <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                    <span className="flex-1">{TEXT.LOAD_ERROR}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={reload}>
                        {TEXT.RETRY}
                    </button>
                </div>
            )}

            <Card
                title={TEXT.CHECK_IN_TITLE}
                actions={
                    <Link to={ROUTES.RECEPTION_CHECK_IN} className="btn-link text-label">
                        {TEXT.CHECK_IN_LINK}
                    </Link>
                }
            >
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                    {search("dci-search", ci.keyword, setCiFilter("keyword"))}
                    <LabeledSelect
                        id="dci-slot"
                        label={CHECK_IN_TEXT.SLOT}
                        value={ci.slot}
                        options={[["", CHECK_IN_TEXT.ALL_SLOTS], ...[...new Set(notYet.map(slotOf).filter(Boolean))].sort().map((s) => [s, s])]}
                        onChange={setCiFilter("slot")}
                    />
                    <LabeledSelect id="dci-doctor" label={CHECK_IN_TEXT.DOCTOR} value={ci.doctor} options={doctorOptions(notYet)} onChange={setCiFilter("doctor")} />
                </div>
                {table(TEXT.CHECK_IN_COLUMNS, ciPaging, TEXT.CHECK_IN_EMPTY, (row) => (
                    <tr key={row.id}>
                        <td data-label={TEXT.CHECK_IN_COLUMNS[0]} className="num whitespace-nowrap">
                            {slotOf(row) || CHECK_IN_TEXT.WALK_IN_SLOT}
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
                            {endedIds.has(row.doctorId) && <small className="block text-caption text-danger">{CHECK_IN_TEXT.DOCTOR_ENDED}</small>}
                        </td>
                        <td data-label={TEXT.CHECK_IN_COLUMNS[5]}>
                            {row.status === "CONFIRMED" ? <span className="badge badge-success">{CONFIRM_TEXT.STATES.confirmed[0]}</span> : confirmCell(row)}
                        </td>
                        <td data-actions>
                            <div className="flex justify-end">
                                <button type="button" className="btn btn-primary h-8 px-3" onClick={() => setDialog({ type: "checkIn", item: row })}>
                                    {CHECK_IN_TEXT.CHECK_IN}
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Card>

            <Card
                title={TEXT.CONFIRM_TITLE}
                actions={
                    <Link to={ROUTES.RECEPTION_APPOINTMENTS} className="btn-link text-label">
                        {TEXT.CONFIRM_LINK}
                    </Link>
                }
            >
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                    {search("dcf-search", cf.keyword, setCfFilter("keyword"))}
                    <LabeledSelect id="dcf-day" label={TEXT.APPOINTMENT_DAY} value={cf.day} options={dayOptions} onChange={setCfFilter("day")} />
                    <LabeledSelect id="dcf-doctor" label={CHECK_IN_TEXT.DOCTOR} value={cf.doctor} options={doctorOptions(pending)} onChange={setCfFilter("doctor")} />
                    <LabeledSelect id="dcf-status" label={CONFIRM_TEXT.STATUS} value={cf.status} options={CF_STATUS} onChange={setCfFilter("status")} />
                </div>
                {table(TEXT.CONFIRM_COLUMNS, cfPaging, TEXT.CONFIRM_EMPTY, (row) => {
                    const open = (type) => () => setDialog({ type, item: row });
                    return (
                        <tr key={row.id}>
                            <td data-label={TEXT.CONFIRM_COLUMNS[0]} className="whitespace-nowrap font-semibold text-ink">
                                {row.appointmentDate === today ? TEXT.TODAY : shortDate(row.appointmentDate)}
                            </td>
                            <td data-label={TEXT.CONFIRM_COLUMNS[1]} className="num whitespace-nowrap">
                                {slotOf(row)}
                            </td>
                            {patientCell(row)}
                            <td data-label={TEXT.CONFIRM_COLUMNS[3]} className="num whitespace-nowrap">
                                {phoneText(row.patientPhoneNumber)}
                            </td>
                            <td data-label={TEXT.CONFIRM_COLUMNS[4]} className="min-w-36">
                                {row.doctorName ?? CHECK_IN_TEXT.NO_DOCTOR}
                            </td>
                            <td data-label={TEXT.CONFIRM_COLUMNS[5]} className="min-w-36">
                                <ServiceCell names={serviceNames(row)} />
                            </td>
                            <td data-label={TEXT.CONFIRM_COLUMNS[6]}>{confirmCell(row)}</td>
                            <td data-actions>
                                <div className="ml-auto grid w-max grid-cols-2 gap-2">
                                    <button type="button" className="btn btn-primary h-8 px-2.5" onClick={open("confirm")}>
                                        {CONFIRM_TEXT.CONFIRM}
                                    </button>
                                    <button type="button" className="btn btn-secondary h-8 px-2.5" onClick={open("call")}>
                                        {CONFIRM_TEXT.CALL_BACK}
                                    </button>
                                    <button type="button" className="btn btn-secondary h-8 px-2.5" onClick={open("reschedule")}>
                                        {CONFIRM_TEXT.RESCHEDULE}
                                    </button>
                                    <button type="button" className="btn btn-secondary h-8 px-2.5" onClick={open("cancel")}>
                                        {CONFIRM_TEXT.CANCEL}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </Card>

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
            {dialog?.type === "reschedule" && (
                <RescheduleDialog appointment={a} onClose={close} onSubmit={(v) => act(rescheduleAppointment(a.id, v), CONFIRM_TEXT.RESCHEDULED(a.patientName))} />
            )}
            {dialog?.type === "cancel" && <CancelDialog appointment={a} onClose={close} onSubmit={(reason) => act(cancelAppointment(a.id, reason), CONFIRM_TEXT.CANCELLED(a.patientName))} />}
        </div>
    );
};

export default ReceptionistDashboard;

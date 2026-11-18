import { useState } from "react";
import { CalendarDays, CircleAlert, ReceiptText, Stethoscope } from "lucide-react";
import { Link } from "react-router-dom";
import { Hotline } from "@/components/booking/BookingSchedule";
import BookingStateBox from "@/components/booking/BookingStateBox";
import RecentVisitsSection from "@/components/dashboard/RecentVisitsSection";
import StatCard from "@/components/dashboard/StatCard";
import TasksSection from "@/components/dashboard/TasksSection";
import TreatmentProgressSection from "@/components/dashboard/TreatmentProgressSection";
import UpcomingAppointmentsSection from "@/components/dashboard/UpcomingAppointmentsSection";
import useAsync from "@/hooks/useAsync";
import useSession from "@/hooks/useSession";
import { getMyAppointments } from "@/services/appointmentService";
import { getMyDues } from "@/services/invoiceDueService";
import { getMyTreatmentPlans } from "@/services/medicalBookService";
import { formatCurrency, formatDate, formatTime, formatWeekday, getClinicToday } from "@/utils/format";
import { APPOINTMENT_STATUS, BOOKING_ERROR_CODE, BOOKING_TEXT, EXAMINATION_STATUS, INVOICE_PAYMENT_STATUS, PAYMENT_STATUS, PLAN_STATUS, STAGE_STATUS } from "@/utils/messages";
import { ROUTES, getTreatmentPlanRoute } from "@/utils/routes";

const EMPTY_VALUE = "—";
const NEXT_APPOINTMENTS_LIMIT = 3;
const RECENT_VISITS_LIMIT = 3;
const UPCOMING_STATUSES = [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED];
const TODAY_STATUS_RANK = {
    [APPOINTMENT_STATUS.IN_SERVICE]: 0,
    [APPOINTMENT_STATUS.CHECKED_IN]: 1,
    [APPOINTMENT_STATUS.CONFIRMED]: 2,
    [APPOINTMENT_STATUS.PENDING]: 2,
};
const RECENT_EXAMINATION_STATUSES = [EXAMINATION_STATUS.COMPLETED, EXAMINATION_STATUS.LOCKED];
const TREATMENT_PLAN_ENABLED = true;
const OVERDUE_STATUS = "OVERDUE";
const EMPTY_DUES = { items: [], total: 0 };

const TEXT = {
    DUE_LABEL: "Còn nợ",
    DUE_CAPTION: (count) => `${count} khoản · thanh toán tại quầy`,
    NO_DUE: "Không có khoản còn nợ",
    UNLINKED_TEXT: "Vui lòng gọi",
    UNLINKED_TEXT_END: "để lễ tân gắn hồ sơ.",
};

const isUnlinked = ({ loading, error, value }) => !loading && !error && value?.code === BOOKING_ERROR_CODE.PROFILE_NOT_FOUND;

const toResource = (state) => {
    const { loading, error, value } = state;
    const unlinked = isUnlinked(state);
    const failed = !loading && !unlinked && (Boolean(error) || value?.success === false || !Array.isArray(value?.data));
    return { loading, failed, unlinked, data: !loading && !failed && !unlinked ? value.data : [] };
};

const toDueResource = (state) => {
    const { loading, error, value } = state;
    const unlinked = isUnlinked(state);
    const failed = !loading && !unlinked && (Boolean(error) || value?.success !== true || !Array.isArray(value?.data?.items));
    return { loading, failed, unlinked, data: !loading && !failed && !unlinked ? value.data : EMPTY_DUES };
};

const dateOf = (appointment) => (appointment.appointmentDate ?? "").slice(0, 10);

const compareTime = (a, b) => (a.timeSlotStart ?? "").localeCompare(b.timeSlotStart ?? "");

const compareDateTime = (a, b) => dateOf(a).localeCompare(dateOf(b)) || compareTime(a, b);

const getUpcoming = (appointments, today) =>
    appointments.filter((item) => UPCOMING_STATUSES.includes(item.status) && dateOf(item) >= today).sort(compareDateTime);

const getHighlighted = (appointments, today, upcoming) => {
    const [first] = appointments
        .filter((item) => dateOf(item) === today && Object.hasOwn(TODAY_STATUS_RANK, item.status))
        .sort((a, b) => TODAY_STATUS_RANK[a.status] - TODAY_STATUS_RANK[b.status] || compareTime(a, b));
    return first ?? upcoming.find((item) => dateOf(item) > today) ?? null;
};

const getNextAppointments = (upcoming, highlighted) =>
    upcoming.filter((item) => item.id !== highlighted?.id).slice(0, NEXT_APPOINTMENTS_LIMIT);

const getStatOneCaption = (upcoming, highlighted) => {
    const [nearest] = upcoming;
    if (nearest) return `Gần nhất: ${[formatDate(nearest.appointmentDate), formatTime(nearest.timeSlotStart)].filter(Boolean).join(" · ")}`;
    return highlighted ? "Không có lịch hẹn nào sau hôm nay" : "Chưa có lịch hẹn";
};

const getRecentVisits = (appointments) =>
    appointments
        .filter((item) => item.status === APPOINTMENT_STATUS.COMPLETED && RECENT_EXAMINATION_STATUSES.includes(item.examinationStatus))
        .sort((a, b) => compareDateTime(b, a))
        .slice(0, RECENT_VISITS_LIMIT);

const getActivePlan = (plans) =>
    plans
        .filter((plan) => plan.status === PLAN_STATUS.IN_PROGRESS)
        .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "") || b.treatmentPlanId - a.treatmentPlanId)[0] ?? null;

const sortStages = (stages) => [...(stages ?? [])].sort((a, b) => a.stageNumber - b.stageNumber);

const getStageProgress = (stages) => {
    const sorted = sortStages(stages);
    const active = sorted.filter((stage) => stage.stageStatus !== STAGE_STATUS.CANCELLED);
    const completed = active.filter((stage) => stage.stageStatus === STAGE_STATUS.COMPLETED).length;
    const currentIndex = active.findIndex((stage) => stage.stageStatus !== STAGE_STATUS.COMPLETED);
    const y = active.length;
    return {
        y,
        completed,
        x: currentIndex === -1 ? y : currentIndex + 1,
        currentStageId: currentIndex === -1 ? null : active[currentIndex].id,
        percent: y ? Math.round((completed / y) * 10000) / 100 : 0,
        stages: sorted,
    };
};

const getDueItems = (dues) => [...dues.items].sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id - b.id);

const taskStatus = (item) => {
    if (item.overdue) return OVERDUE_STATUS;
    return Object.hasOwn(INVOICE_PAYMENT_STATUS, item.paymentStatus) ? item.paymentStatus : PAYMENT_STATUS.UNPAID;
};

const getTasks = (plans, dueItems) => [
    ...plans
        .filter((plan) => plan.status === PLAN_STATUS.PROPOSED)
        .sort((a, b) => (b.proposedAt ?? "").localeCompare(a.proposedAt ?? "") || b.treatmentPlanId - a.treatmentPlanId)
        .map((plan) => ({
            kind: "plan",
            id: plan.treatmentPlanId,
            status: plan.status,
            planName: plan.planName,
            doctorName: plan.doctorName,
            proposedAt: plan.proposedAt,
            stageCount: getStageProgress(plan.stages).y,
            estimatedTotalCost: plan.estimatedTotalCost,
        })),
    ...dueItems.map((item) => ({
        kind: "invoice",
        id: item.id,
        debtId: item.debtId,
        status: taskStatus(item),
        invoiceNumber: item.invoiceNumber,
        remainder: item.due,
        appointmentDate: item.visitDate ?? undefined,
    })),
];

const getGreeting = (userName, today) => {
    const name = userName?.trim();
    return `Xin chào${name ? `, ${name}` : ""} · ${formatWeekday(today)}, ${formatDate(today)}`;
};

const getPlanStat = (activePlan, progress) => {
    if (!activePlan) return { value: EMPTY_VALUE, caption: "Chưa có kế hoạch đang điều trị" };
    if (progress.y === 0) return { value: EMPTY_VALUE, caption: activePlan.planName };
    return { value: `Giai đoạn ${progress.x}/${progress.y}`, caption: activePlan.planName };
};

const PatientDashboard = () => {
    const { userName } = useSession();
    const [today] = useState(getClinicToday);
    const appointments = toResource(useAsync(getMyAppointments, []));
    const plans = toResource(useAsync(getMyTreatmentPlans, []));
    const dues = toDueResource(useAsync(getMyDues, []));

    const upcoming = getUpcoming(appointments.data, today);
    const highlighted = getHighlighted(appointments.data, today, upcoming);
    const activePlan = getActivePlan(plans.data);
    const progress = getStageProgress(activePlan?.stages);
    const dueItems = getDueItems(dues.data);
    const planStat = plans.failed ? { value: EMPTY_VALUE } : getPlanStat(activePlan, progress);
    const unlinked = appointments.unlinked || dues.unlinked || plans.unlinked;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Tổng quan</h1>
                    <p className="page-description">{getGreeting(userName, today)}</p>
                </div>
                <Link to={ROUTES.BOOK_APPOINTMENT} className="btn btn-primary min-h-11 md:min-h-0">
                    Đặt lịch hẹn
                </Link>
            </div>
            {unlinked ? (
                <section className="card-app">
                    <BookingStateBox tone="warning" icon={CircleAlert} title={BOOKING_TEXT.UNLINKED_TITLE} headingLevel={2}>
                        {TEXT.UNLINKED_TEXT} <Hotline /> {TEXT.UNLINKED_TEXT_END}
                    </BookingStateBox>
                </section>
            ) : (
                <>
                    <div className={TREATMENT_PLAN_ENABLED ? "grid grid-cols-1 gap-4 xl:grid-cols-3" : "grid grid-cols-1 gap-4 md:grid-cols-2"}>
                        <StatCard
                            icon={CalendarDays}
                            label="Lịch hẹn sắp tới"
                            value={appointments.failed ? EMPTY_VALUE : upcoming.length}
                            caption={appointments.failed ? null : getStatOneCaption(upcoming, highlighted)}
                            to={ROUTES.APPOINTMENTS}
                            loading={appointments.loading}
                        />
                        {TREATMENT_PLAN_ENABLED && (
                            <StatCard
                                icon={Stethoscope}
                                label="Kế hoạch đang điều trị"
                                value={planStat.value}
                                caption={planStat.caption}
                                to={getTreatmentPlanRoute()}
                                loading={plans.loading}
                            />
                        )}
                        <StatCard
                            icon={ReceiptText}
                            label={TEXT.DUE_LABEL}
                            value={dues.failed ? EMPTY_VALUE : formatCurrency(dues.data.total)}
                            caption={dues.failed ? null : dueItems.length > 0 ? TEXT.DUE_CAPTION(dueItems.length) : TEXT.NO_DUE}
                            to={ROUTES.PAYMENT_DEBTS}
                            loading={dues.loading}
                        />
                    </div>
                    <div className="mt-6 flex flex-col gap-6">
                        <TasksSection
                            tasks={getTasks(plans.data, dueItems)}
                            loading={plans.loading || dues.loading}
                            failed={plans.failed || dues.failed}
                        />
                        <UpcomingAppointmentsSection
                            highlighted={highlighted}
                            highlightedIsToday={highlighted ? dateOf(highlighted) === today : false}
                            nextAppointments={getNextAppointments(upcoming, highlighted)}
                            loading={appointments.loading}
                            failed={appointments.failed}
                        />
                        {TREATMENT_PLAN_ENABLED && (
                            <TreatmentProgressSection
                                plan={activePlan && { ...activePlan, stages: progress.stages }}
                                progress={activePlan && progress}
                                loading={plans.loading}
                                failed={plans.failed}
                            />
                        )}
                        <RecentVisitsSection visits={getRecentVisits(appointments.data)} loading={appointments.loading} failed={appointments.failed} />
                    </div>
                </>
            )}
        </>
    );
};

export default PatientDashboard;

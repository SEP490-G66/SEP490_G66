import { PLAN_STATUS } from "./messages";

// Builds "Tất cả lần đến sắp tới": the patient's current appointment plus the sessions still ahead in each
// treatment plan being carried out. Plans come from getMyTreatmentPlans (toDashboardPlans shape).
// The appointment says which session it is for (appointment.planSession, set when the front desk books it);
// an appointment without one is a visit outside the plans.

const STAGE_DONE = ["Completed", "Cancelled"];

export const VISIT_STATE = { BOOKED: "booked", WAITING: "waiting", PLANNED: "planned", APPOINTMENT: "appointment" };

const day = (value) => String(value ?? "").slice(0, 10);

const isOpen = (stage) => !STAGE_DONE.includes(stage.stageStatus);

const activePlans = (plans) => (Array.isArray(plans) ? plans : []).filter((plan) => plan.status === PLAN_STATUS.IN_PROGRESS && plan.stages?.length);

// Sessions counted in "Buổi n/N": cancelled ones are left out.
const countedStages = (plan) => [...plan.stages].filter((stage) => stage.stageStatus !== "Cancelled").sort((a, b) => a.stageNumber - b.stageNumber);

// { plan, stage, index, total } of the open session booked by this appointment, or null.
export const findAppointmentSession = (appointment, plans) => {
    const session = appointment?.planSession;
    if (!session) return null;
    const plan = activePlans(plans).find((item) => item.treatmentPlanId === session.treatmentPlanId);
    if (!plan) return null;
    const stages = countedStages(plan);
    const index = stages.findIndex((stage) => stage.stageId === session.stageId);
    return index >= 0 ? { plan, stage: stages[index], index, total: stages.length } : null;
};

// The next open session of an active plan, earliest scheduled day first; for the "Buổi điều trị sắp tới" card.
export const findNextSession = (plans) =>
    activePlans(plans)
        .map((plan) => {
            const stages = countedStages(plan);
            const index = stages.findIndex(isOpen);
            return index >= 0 ? { plan, stage: stages[index], index, total: stages.length } : null;
        })
        .filter(Boolean)
        .sort((a, b) => (day(a.stage.scheduledDate) || "9999").localeCompare(day(b.stage.scheduledDate) || "9999"))[0] ?? null;

export const buildUpcomingVisits = (appointment, plans) => {
    const booked = findAppointmentSession(appointment, plans);
    const rows = [];

    if (appointment && !booked) {
        rows.push({ key: `appt-${appointment.id}`, date: day(appointment.appointmentDate), state: VISIT_STATE.APPOINTMENT, appointment, current: true });
    }

    activePlans(plans).forEach((plan) => {
        const stages = countedStages(plan);
        const nextIndex = stages.findIndex(isOpen);
        stages.forEach((stage, index) => {
            if (!isOpen(stage)) return;
            const isBooked = booked?.plan === plan && booked.stage === stage;
            rows.push({
                key: `stage-${plan.treatmentPlanId}-${stage.stageNumber}`,
                date: isBooked ? day(appointment.appointmentDate) : day(stage.scheduledDate),
                state: isBooked ? VISIT_STATE.BOOKED : index === nextIndex ? VISIT_STATE.WAITING : VISIT_STATE.PLANNED,
                plan,
                stage,
                number: index + 1,
                total: stages.length,
                appointment: isBooked ? appointment : null,
                current: isBooked,
            });
        });
    });

    // Sessions with no day yet go last.
    return rows.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
};

// "Lịch hẹn": a day and a time are set. "Buổi dự kiến": a session with only a planned day, the desk calls to set the time.
export const isBookedVisit = (row) => row.state === VISIT_STATE.APPOINTMENT || row.state === VISIT_STATE.BOOKED;

// The patient booked it themselves: they change it from "Lịch hẹn hiện tại". Everything else the clinic arranged.
export const isOwnVisit = (row) => row.state === VISIT_STATE.APPOINTMENT && row.appointment?.bookedByPatient === true;

export const visitSource = (row) => {
    if (row.stage) return `Buổi điều trị ${row.number}/${row.total}`;
    if (row.appointment?.bookedByPatient) return "Bạn đặt";
    return row.appointment?.parentAppointmentId != null ? "Tái khám bác sĩ hẹn" : "Lễ tân đặt hộ";
};

export const visitTitle = (row) => (row.stage ? row.stage.stageName || "Buổi điều trị" : row.appointment.serviceName);

export const visitDoctor = (row) => (row.stage && !row.appointment ? row.plan.doctorName : row.appointment?.doctorName);

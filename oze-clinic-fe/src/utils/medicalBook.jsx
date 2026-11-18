import { formatDate, formatTimeRange, formatWeekday, getClinicDateTimeParts, getClinicToday } from "./format";
import { imagingTypeLabel } from "./imagingRequest";
import { APPOINTMENT_STATUS, MEDICAL_RECORD_ADDENDUM_TYPE, MEDICAL_RECORD_HISTORY_GROUPS, MEDICAL_RECORD_TEXT, PLAN_STATUS } from "./messages";

const CLINIC = { name: "Nha khoa OZE" };
const GENDER = { Male: "Nam", Female: "Nữ" };
const NO_VALUE = "—";

const PLAN_STATUS_MAP = { Proposed: "proposed", Approved: "active", InProgress: "active", Completed: "done", Cancelled: "stopped" };
const STAGE_COMPLETED = "Completed";
const STAGE_IN_PROGRESS = "InProgress";
const STAGE_CANCELLED = "Cancelled";
const CHART_KIND = {
    Caries: { kind: "caries", st: "condition" },
    Filled: { kind: "filling", st: "done" },
    Crown: { kind: "crown", st: "done" },
    Implant: { kind: "implant", st: "done" },
    Denture: { kind: "denture", st: "done" },
    Missing: { kind: "missing", st: "missing" },
    Healthy: { kind: "healthy", st: "healthy" },
};
const dashboardStatus = (status) => ({ Proposed: PLAN_STATUS.PROPOSED, Approved: PLAN_STATUS.IN_PROGRESS, InProgress: PLAN_STATUS.IN_PROGRESS })[status] ?? null;

const UPCOMING_STATUSES = [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED];

const toNumber = (value) => Number(value) || 0;
const list = (value) => (Array.isArray(value) ? value : []);
const clinicDate = (value) => (value ? getClinicDateTimeParts(new Date(value)).date : "");

const toProfile = (book) => ({
    name: book.fullName ?? "",
    dob: formatDate(book.dateOfBirth),
    gender: GENDER[book.gender] ?? "",
    phone: (book.phoneNumber ?? "").replace(/^\+84/, "0"),
    addr: book.address ?? "",
});

const followUpText = (exam) => {
    const date = formatDate(exam.followUpDate);
    if (!date && !exam.followUpNotes) return "";
    const booked = date ? ` · ${exam.followUpBooked ? MEDICAL_RECORD_TEXT.FOLLOW_UP_BOOKED : MEDICAL_RECORD_TEXT.FOLLOW_UP_NOT_BOOKED}` : "";
    return `${[date && MEDICAL_RECORD_TEXT.FOLLOW_UP_ON(date), exam.followUpNotes].filter(Boolean).join(" – ")}${booked}`;
};

const toVisit = (exam, invoiceByAppointment) => {
    const services = list(exam.services).filter(Boolean);
    return {
        id: exam.id,
        code: exam.appointmentCode ?? "",
        stt: exam.queueNumber ?? null,
        date: formatDate(exam.date),
        wd: formatWeekday(exam.date),
        time: formatTimeRange(exam.timeSlotStart, exam.timeSlotEnd),
        service: services.join(", "),
        doctor: exam.doctorName ?? "",
        reason: exam.chiefComplaint ?? "",
        diag: list(exam.diagnoses).filter(Boolean).join("; "),
        done: services,
        notes: exam.clinicalNotes ?? "",
        addenda: list(exam.addenda).map((addendum) => ({
            type: MEDICAL_RECORD_ADDENDUM_TYPE[addendum.addendumType] ?? MEDICAL_RECORD_TEXT.ADDENDUM,
            content: addendum.content ?? "",
            date: clinicDate(addendum.createdAt),
        })),
        prescriptions: list(exam.prescriptions)
            .map((prescription) => ({ notes: prescription.notes ?? "", items: list(prescription.items) }))
            .filter((prescription) => prescription.items.length || prescription.notes),
        next: { text: followUpText(exam) },
        plans: list(exam.treatmentPlanIds),
        plan: list(exam.treatmentPlanIds)[0] ?? null,
        invoiceId: invoiceByAppointment.get(exam.appointmentId) ?? null,
    };
};

const stageNote = (stage) => {
    if (stage.status === STAGE_COMPLETED) return MEDICAL_RECORD_TEXT.STAGE_DONE_ON(formatDate(stage.actualDate) || NO_VALUE);
    if (stage.status === STAGE_IN_PROGRESS) return MEDICAL_RECORD_TEXT.STAGE_IN_PROGRESS;
    if (stage.status === STAGE_CANCELLED) return MEDICAL_RECORD_TEXT.STAGE_CANCELLED;
    return stage.scheduledDate ? MEDICAL_RECORD_TEXT.STAGE_SCHEDULED(formatDate(stage.scheduledDate)) : MEDICAL_RECORD_TEXT.STAGE_NOT_STARTED;
};

const toStages = (stages) => {
    const sorted = [...stages].sort((a, b) => a.number - b.number);
    const nextIndex = sorted.findIndex((stage) => stage.status !== STAGE_COMPLETED && stage.status !== STAGE_CANCELLED);
    return sorted.map((stage, index) => ({
        number: stage.number,
        name: stage.stageName || MEDICAL_RECORD_TEXT.STAGE(stage.number),
        status: stage.status === STAGE_COMPLETED ? "done" : index === nextIndex ? "next" : "todo",
        note: stageNote(stage),
        cost: toNumber(stage.estimatedCost),
        cancelled: stage.status === STAGE_CANCELLED,
        actualDate: stage.actualDate ?? null,
    }));
};

const toLog = (stages, visits) =>
    stages
        .filter((stage) => stage.status === "done")
        .map((stage, index, done) => {
            const date = formatDate(stage.actualDate);
            const visit = visits.find((item) => item.date === date);
            const following = stages.find((item) => item.number > stage.number && !item.cancelled && item.status !== "done");
            return {
                date: date || NO_VALUE,
                action: `${MEDICAL_RECORD_TEXT.STAGE(stage.number)} · ${stage.name}`,
                next: index === done.length - 1 && following ? `${MEDICAL_RECORD_TEXT.STAGE(following.number)} · ${following.name}` : NO_VALUE,
                visit: visit?.id ?? null,
            };
        });

const toPlan = (plan, visits) => {
    const stages = toStages(list(plan.stages));
    const status = PLAN_STATUS_MAP[plan.status] ?? "active";
    const counted = stages.filter((stage) => !stage.cancelled);
    return {
        id: plan.id,
        examinationId: plan.examinationId,
        variant: plan.planName || MEDICAL_RECORD_TEXT.PLAN,
        description: plan.description ?? "",
        status,
        doctor: plan.doctorName ?? "",
        diag: plan.diagnosis ?? "",
        start: clinicDate(status === "proposed" ? plan.createdAt : (plan.approvedAt ?? plan.createdAt)),
        sentOn: clinicDate(plan.createdAt),
        stages,
        log: toLog(stages, visits),
        total: counted.reduce((sum, stage) => sum + stage.cost, 0) || toNumber(plan.estimatedTotalCost),
    };
};

const toFilm = (film) => ({
    id: film.resultId,
    status: "concluded",
    date: clinicDate(film.createdAt),
    type: imagingTypeLabel(film.imagingType),
    area: film.targetArea ?? "",
    doctor: film.doctorName ?? "",
    result: film.doctorNotes ?? "",
    visit: film.examinationId,
    fileUrl: `/api/imaging-results/${film.resultId}/file`,
});

const toChartEntry = (entry, index) => {
    const mapped = CHART_KIND[entry.condition] ?? { kind: "finding", st: "note" };
    return {
        id: `c-${index}`,
        tooth: entry.toothNumber,
        surf: entry.surface ?? "",
        kind: mapped.kind,
        st: mapped.st,
        note: entry.notes ?? "",
        visit: entry.examinationId,
        date: formatDate(entry.date),
    };
};

const toFinding = (finding, index) => ({
    id: `f-${index}`,
    tooth: finding.toothNumber,
    surf: "",
    findingSurf: finding.surfaces ?? "",
    kind: "finding",
    st: "note",
    note: [finding.condition, finding.notes].filter(Boolean).join(" – "),
    visit: finding.examinationId,
    date: formatDate(finding.date),
});

const toHistory = (history) =>
    MEDICAL_RECORD_HISTORY_GROUPS.map((group) => ({
        key: group.key,
        title: group.title,
        items: history
            .filter((item) => item.recordType === group.type)
            .map((item) => ({
                title: item.title ?? "",
                text: item.description ?? "",
                severity: item.severity ?? "",
                date: clinicDate(item.updatedAt),
            })),
    }));

const toUpcoming = (appointments) => {
    const today = getClinicToday();
    return appointments
        .filter((item) => UPCOMING_STATUSES.includes(item.status) && String(item.appointmentDate ?? "").slice(0, 10) >= today)
        .map((item) => ({
            id: item.appointmentCode,
            date: formatDate(item.appointmentDate),
            wd: formatWeekday(item.appointmentDate),
            time: formatTimeRange(item.timeSlotStart, item.timeSlotEnd),
            service: item.serviceName,
            doctor: item.doctorName,
            status: String(item.status).toLowerCase(),
            method: "",
        }));
};

export const toMedicalRecord = (book, { invoices = [], appointments = [] } = {}) => {
    const invoiceByAppointment = new Map(invoices.filter((invoice) => invoice.appointmentId != null).map((invoice) => [invoice.appointmentId, invoice.id]));
    const visits = list(book.examinations).map((exam) => toVisit(exam, invoiceByAppointment));
    return {
        clinic: CLINIC,
        patient: { code: book.patientCode ?? "" },
        profile: toProfile(book),
        visits,
        upcoming: toUpcoming(appointments),
        plans: list(book.treatmentPlans).map((plan) => toPlan(plan, visits)),
        films: list(book.films).map(toFilm),
        chart: [...list(book.chart).map(toChartEntry), ...list(book.toothFindings).map(toFinding)],
        history: toHistory(list(book.history)),
    };
};

export const toDashboardPlans = (book) =>
    list(book.treatmentPlans)
        .filter((plan) => dashboardStatus(plan.status) != null)
        .map((plan) => ({
            treatmentPlanId: plan.id,
            planName: plan.planName ?? MEDICAL_RECORD_TEXT.PLAN,
            status: dashboardStatus(plan.status),
            doctorName: plan.doctorName ?? "",
            proposedAt: plan.createdAt,
            startDate: plan.approvedAt ?? plan.createdAt,
            estimatedTotalCost: toNumber(plan.estimatedTotalCost),
            stages: list(plan.stages).map((stage) => ({
                id: `${plan.id}-${stage.number}`,
                stageNumber: stage.number,
                stageName: stage.stageName,
                stageStatus: stage.status,
                scheduledDate: stage.scheduledDate,
            })),
        }));

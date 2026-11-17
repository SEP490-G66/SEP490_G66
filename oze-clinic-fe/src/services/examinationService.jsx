import api from "./api";
import { call } from "./receptionService";
import { getMyShifts } from "./myScheduleService";
import { EMPTY_PRESCRIPTION_DRAFT, EMPTY_TREATMENT_DRAFT } from "../utils/data/mockExamination";
import { icdName, newPlanSession, validatePlan } from "../utils/examination";
import { formatClock, getClinicDateTimeParts, getClinicToday } from "../utils/format";
import { AFTERNOON_STARTS_AT } from "../utils/shift";
import { imagingTypeLabel } from "../utils/imagingRequest";
import { QUEUE_STATUS } from "../utils/messages";

// Doctor's examination room ("Khám bệnh"). Every call returns the ApiResponse shape ({ success, message, data, errors }).
// Real API: the room queue (DoctorRoomController), call / skip (QueuesController), start / complete (AppointmentsController),
// step 2 "Khám & Chẩn đoán" (ExaminationsController: content, tooth findings, diagnoses), X-ray orders (ImagingRequestsController)
// and step 3 "Lập kế hoạch điều trị" (TreatmentPlansController: create / update / propose / approve; types from bookable-services).
// TODO(api): step 1 medical history and steps 4-5 (treatment, prescription) are still kept in the browser only.
//
// A queue item is identified by its appointment id (it does not change when the patient goes for an X-ray and comes back).

const success = (data, message = null) => ({ success: true, message, data, errors: null });
const failure = (message) => ({ success: false, message, data: null, errors: null });

const MESSAGES = [
    [/Patient is not in the waiting queue|not WAITING|is not waiting/i, "Bệnh nhân không còn trong hàng chờ."],
    [/already has an appointment in service|another .*in service/i, "Đang có bệnh nhân trong phòng. Kết thúc lượt khám trước khi gọi người tiếp theo."],
    [/off duty|not on shift|start your shift/i, "Bạn chưa bắt đầu ca làm. Bấm “Bắt đầu ca” trước khi khám."],
    [/at least one diagnosis|clinical notes/i, "Cần ít nhất một chẩn đoán hoặc ghi chú lâm sàng trước khi kết thúc lượt khám."],
    [/draft prescription/i, "Đơn thuốc nháp còn thuốc: chốt hoặc xoá đơn trước khi kết thúc."],
    [/only IN_SERVICE|must be in service|not in service/i, "Bệnh nhân không còn trong phòng khám (có thể đang đi chụp X-quang)."],
    [/Cannot request imaging because the examination is/i, "Lượt khám đã kết thúc, không gửi chỉ định chụp được."],
    [/Please enter clinical indication/i, "Nhập mục đích chụp."],
    [/Please enter target area/i, "Nhập vùng hoặc răng cần chụp."],
    [/Tooth surfaces must be/i, "Mặt răng chỉ gồm M, O, D, B, L."],
    [/tooth condition must be one of/i, "Trạng thái răng không hợp lệ."],
    [/severity is too long/i, "Mức độ tối đa 20 ký tự."],
    [/No change was recorded for this tooth/i, "Răng này chưa có thay đổi nào trong lần khám này."],
    [/tooth condition/i, "Nhập tình trạng răng (tối đa 100 ký tự)."],
    [/tooth number|FDI/i, "Số răng không hợp lệ."],
    [/Too many symptoms/i, "Quá nhiều triệu chứng hoặc triệu chứng quá dài."],
    [/record changed|changed meanwhile|modified by someone/i, "Phiếu khám vừa được thay đổi ở nơi khác. Tải lại trang rồi thử lại."],
    [/Scheduled date is invalid/i, "Ngày dự kiến không hợp lệ: không được ở quá khứ và phải theo thứ tự các buổi."],
    [/at least one treatment stage/i, "Thêm ít nhất một buổi điều trị."],
    [/Estimated cost is invalid/i, "Chi phí dự kiến không hợp lệ."],
    [/Only a draft or proposed treatment plan can be edited/i, "Kế hoạch đã được bệnh nhân đồng ý, không sửa được nữa."],
    [/already has an invoice/i, "Kế hoạch đã có hoá đơn, không sửa được nữa."],
    [/already has an open treatment plan/i, "Lượt khám này đã có kế hoạch điều trị. Tải lại trang để xem."],
    [/not available for booking|Service not found/i, "Có dịch vụ trong kế hoạch không còn hoạt động."],
    [/treatment stage is listed more than once/i, "Một buổi điều trị bị lặp. Tải lại trang rồi thử lại."],
    [/Only a draft treatment plan can be proposed|Only a proposed treatment plan can be approved/i, "Trạng thái kế hoạch vừa thay đổi. Tải lại trang rồi thử lại."],
];

const translate = (response) => {
    if (response.success || !response.message) return response;
    const match = MESSAGES.find(([pattern]) => pattern.test(response.message));
    return match ? { ...response, message: match[1] } : response;
};

const queueStatusByApi = { WAITING: QUEUE_STATUS.WAITING, CALLED: QUEUE_STATUS.CALLED, IN_PROGRESS: QUEUE_STATUS.IN_EXAMINATION };

// ---- Kept in the browser: the room as last loaded, step reached, drafts of the steps without an API ----

const state = {
    room: new Map(), // appointmentId → API queue item
    snapshot: null,
    local: new Map(), // appointmentId → { history, plan, treatment, prescription }
    saved: new Map(), // examinationId → last saved step 2 draft
    ids: new Map(), // "tooth-123" / "diag-123" (made on screen) → server id
    plans: new Map(), // examinationId → { id, status } of the treatment plan made in this visit
    stageIds: new Map(), // plan session id (made on screen) → treatment stage id
    planSaves: new Map(), // examinationId → the plan save on its way (saves of one plan run one after another)
    types: new Map(), // serviceId → [{ id, name, price }]: the service's variants ("Loại dịch vụ")
};

const stepKey = (examinationId) => `oze.exam.step.${examinationId}`;
const readStep = (examinationId) => {
    try {
        return Number(localStorage.getItem(stepKey(examinationId))) || 0;
    } catch {
        return 0;
    }
};
const writeStep = (examinationId, step) => {
    try {
        localStorage.setItem(stepKey(examinationId), String(step));
    } catch {
        // private window: the step is only lost on reload
    }
};
const clearStep = (examinationId) => {
    try {
        localStorage.removeItem(stepKey(examinationId));
    } catch {
        // nothing to clear
    }
};

const ageOf = (birthDate) => {
    if (!birthDate) return null;
    const [year, month, day] = birthDate.split("-").map(Number);
    const [nowYear, nowMonth, nowDay] = getClinicToday().split("-").map(Number);
    return nowYear - year - (nowMonth < month || (nowMonth === month && nowDay < day) ? 1 : 0);
};

const shortDate = (value) => (value ? getClinicDateTimeParts(value).date : "");

// The general check-up is the visit itself, so it gets no treatment plan line.
const isCheckup = (service) => /khám tổng quát/i.test(service.name ?? "");

const planFromServices = (item, doctorName) => ({
    code: `KH${String(item.appointmentId).padStart(6, "0")}`,
    doctorName,
    services: item.services
        .filter((service) => !isCheckup(service))
        .map((service, index) => ({
            id: `plan-${service.serviceId}-${index}`,
            serviceId: service.serviceId,
            name: service.name,
            status: "notStarted",
            sessions: [newPlanSession(`session-${service.serviceId}-${index}-1`)],
        })),
});

const localOf = (item, doctorName = "") => {
    if (!state.local.has(item.appointmentId)) {
        state.local.set(item.appointmentId, {
            history: { allergies: [], conditions: [], dental: [] },
            plan: planFromServices(item, doctorName),
            treatment: structuredClone(EMPTY_TREATMENT_DRAFT),
            prescription: structuredClone(EMPTY_PRESCRIPTION_DRAFT),
        });
    }
    return state.local.get(item.appointmentId);
};

// ---- Step 3 treatment plan: the screen's services → sessions, the backend's flat list of stages ----
// A session is one stage: title = StageName, date = ScheduledDate, cost = EstimatedCost. A stage has no variant column,
// so the chosen type ("Loại dịch vụ", a service variant) is kept on the first line of its Description, before the note.

const TYPE_LINE = "Loại: ";
const PLAN_OPEN_STATUSES = ["Draft", "Proposed", "Approved", "InProgress"];
const PLAN_EDITABLE_STATUSES = ["Draft", "Proposed"];

// The variants of every bookable service (GET api/appointments/bookable-services), loaded once
const loadPlanTypes = async () => {
    if (state.types.size) return;
    const response = await call(() => api.get("/api/appointments/bookable-services"));
    if (!response.success) return;
    for (const service of response.data ?? []) {
        state.types.set(
            service.serviceId,
            (service.variants ?? []).map((variant) => ({ id: String(variant.variantId), name: variant.variantName, price: Number(variant.referencePrice) || 0 })),
        );
    }
};

const typesOf = (serviceId) => state.types.get(serviceId) ?? [];

const describeSession = (serviceId, session) => {
    const type = typesOf(serviceId).find((option) => option.id === session.typeId);
    return [type && `${TYPE_LINE}${type.name}`, session.note?.trim()].filter(Boolean).join("\n") || null;
};

const readDescription = (serviceId, description) => {
    const [first = "", ...rest] = String(description ?? "").split("\n");
    if (!first.startsWith(TYPE_LINE)) return { typeId: "", note: description ?? "" };
    const name = first.slice(TYPE_LINE.length);
    return { typeId: typesOf(serviceId).find((option) => option.name === name)?.id ?? "", note: rest.join("\n") };
};

const serviceStatusOf = (sessions, stages) => {
    if (sessions.length && sessions.every((session) => session.status === "done")) return "done";
    return sessions.some((session) => session.status === "done") || stages.some((stage) => stage.stageStatus === "InProgress") ? "inProgress" : "notStarted";
};

// The backend's plan as the screen shows it: services in the order of their first stage, then the registered services
// the plan does not have yet (one empty session each, as a new plan).
const planFromApi = (plan, item, doctorName) => {
    const base = planFromServices(item, doctorName);
    const services = [];
    const stagesOf = new Map();
    for (const stage of [...plan.stages].sort((a, b) => a.stageNumber - b.stageNumber)) {
        let service = services.find((entry) => entry.serviceId === stage.serviceId);
        if (!service) {
            service = { id: `plan-${stage.serviceId}`, serviceId: stage.serviceId, name: stage.serviceName ?? "", sessions: [] };
            services.push(service);
            stagesOf.set(service.id, []);
        }
        const sessionId = `stage-${stage.id}`;
        state.stageIds.set(sessionId, stage.id);
        stagesOf.get(service.id).push(stage);
        service.sessions.push({
            id: sessionId,
            title: stage.stageName ?? "",
            ...readDescription(stage.serviceId, stage.description),
            date: stage.scheduledDate ?? "",
            cost: stage.estimatedCost == null ? null : Number(stage.estimatedCost),
            status: stage.stageStatus === "Completed" ? "done" : "pending",
        });
    }
    for (const service of services) service.status = serviceStatusOf(service.sessions, stagesOf.get(service.id));
    const missing = base.services.filter((entry) => !services.some((service) => service.serviceId === entry.serviceId));
    return {
        code: `KH${String(plan.treatmentPlanId).padStart(6, "0")}`,
        doctorName: plan.createdByDoctorName ?? doctorName,
        planId: plan.treatmentPlanId,
        status: plan.status,
        services: [...services, ...missing],
    };
};

// The plan made in this visit (ExaminationDetailResponse lists the plans of the examination), or null
const loadPlan = async (examinationId) => {
    const visit = await call(() => api.get(`/api/medical-records/examinations/${examinationId}`));
    const summary = (visit.success ? (visit.data?.treatmentPlans ?? []) : []).find((plan) => PLAN_OPEN_STATUSES.includes(plan.status));
    if (!summary) return null;
    const detail = await call(() => api.get(`/api/treatmentplans/${summary.id}`));
    if (!detail.success) return null;
    state.plans.set(examinationId, { id: detail.data.treatmentPlanId, status: detail.data.status });
    return detail.data;
};

// ---- Workspace (queue panel) ----

const shiftOf = (shifts) => {
    const now = formatClock(new Date());
    const shift =
        shifts.find((s) => s.actualStartTime && !s.actualEndTime) ??
        shifts.find((s) => now < String(s.shiftEnd ?? "").slice(0, 5)) ??
        shifts[shifts.length - 1];
    if (!shift) return { name: "Hôm nay", start: "", end: "", roomName: null };
    const start = String(shift.shiftStart ?? "").slice(0, 5);
    return { name: start < AFTERNOON_STARTS_AT ? "Ca sáng" : "Ca chiều", start, end: String(shift.shiftEnd ?? "").slice(0, 5), roomName: shift.roomName ?? null };
};

const toQueueItem = (item) => {
    const status = queueStatusByApi[item.status] ?? QUEUE_STATUS.WAITING;
    const badge = status === QUEUE_STATUS.WAITING ? (item.atImaging ? "AT_IMAGING" : item.isReturning ? "RETURNED" : undefined) : undefined;
    return {
        id: item.appointmentId,
        queueNumber: item.queueNumber,
        patientName: item.patientName,
        status,
        badge,
        atImaging: item.atImaging,
        step: status === QUEUE_STATUS.IN_EXAMINATION && item.examinationId ? readStep(item.examinationId) : undefined,
        startedAt: item.startedAt ? Date.parse(item.startedAt) : undefined,
    };
};

const loadWorkspace = async () => {
    const today = getClinicToday();
    const [roomResponse, shiftResponse] = await Promise.all([
        call(() => api.get("/api/doctor-room")),
        getMyShifts({ fromDate: today, toDate: today }),
    ]);
    if (!roomResponse.success) return translate(roomResponse);

    const room = roomResponse.data ?? { queue: [], done: [] };
    state.room = new Map(room.queue.map((item) => [item.appointmentId, item]));
    const shifts = shiftResponse.success ? (Array.isArray(shiftResponse.data) ? shiftResponse.data : (shiftResponse.data?.items ?? [])) : [];
    state.snapshot = {
        shift: shiftOf(shifts.filter((s) => String(s.workDate ?? today).slice(0, 10) === today)),
        queue: room.queue.map(toQueueItem),
        done: [...room.done].reverse().map((item) => ({
            id: item.appointmentId,
            queueNumber: item.queueNumber,
            patientName: item.patientName,
            finishedAt: formatClock(item.completedAt),
        })),
    };
    return success(state.snapshot);
};

const snapshotCopy = () => structuredClone(state.snapshot);

// Runs a queue action, then reloads the room so the page shows the new queue.
const thenReload = async (request, message) => {
    const response = translate(await call(request));
    if (!response.success) return response;
    const reloaded = await loadWorkspace();
    return reloaded.success ? success(reloaded.data, message) : reloaded;
};

const itemOf = (id) => state.room.get(id);

// Queue of the doctor's room for the current shift: { shift, queue, done }.
export const getExamWorkspace = () => loadWorkspace();

export const callPatient = async (id) => {
    const item = itemOf(id);
    if (!item || item.status !== "WAITING") return failure("Bệnh nhân không còn trong hàng chờ.");
    if (item.atImaging) return failure("Bệnh nhân đang đi chụp X-quang, chưa gọi vào được.");
    return thenReload(() => api.post(`/api/queues/${item.queueEntryId}/call`), `Đã gọi số ${item.queueNumber} · ${item.patientName} vào phòng khám.`);
};

// The doctor's "Báo vắng mặt": the patient goes to the end of the queue (only reception can mark a no-show).
export const markAbsent = async (id) => {
    const item = itemOf(id);
    if (!item || item.status !== "CALLED") return failure("Chỉ báo vắng mặt được bệnh nhân đã gọi.");
    return thenReload(() => api.post(`/api/queues/${item.queueEntryId}/skip`), `Đã chuyển số ${item.queueNumber} · ${item.patientName} xuống cuối hàng chờ.`);
};

export const startExamination = async (id) => {
    const item = itemOf(id);
    if (!item) return failure("Bệnh nhân không còn trong hàng chờ.");
    const response = translate(await call(() => api.post(`/api/appointments/${id}/start-examination`)));
    if (!response.success) return response;
    // A new examination starts at step 1; one resumed after an X-ray keeps the step it had reached
    if (!item.examinationId) writeStep(response.data.examinationId, 0);
    const reloaded = await loadWorkspace();
    return reloaded.success ? success(reloaded.data, `${item.examinationId ? "Khám tiếp" : "Bắt đầu khám"} ${item.patientName}.`) : reloaded;
};

// Moves the visit to another step (0-based, see EXAM_STEPS). Kept in the browser: the backend has no step.
export const setExamStep = async (id, step) => {
    const item = itemOf(id);
    if (!item?.examinationId || item.status !== "IN_PROGRESS") return failure("Lượt khám này không còn mở.");
    writeStep(item.examinationId, Math.max(readStep(item.examinationId), step));
    state.snapshot.queue = state.snapshot.queue.map((entry) => (entry.id === id ? { ...entry, step: readStep(item.examinationId) } : entry));
    return success(snapshotCopy());
};

export const endExamination = async (id) => {
    const item = itemOf(id);
    if (!item) return failure("Lượt khám này không còn mở.");
    const response = await thenReload(() => api.post(`/api/appointments/${id}/complete-examination`), `Đã kết thúc lượt khám của ${item.patientName}.`);
    if (response.success && item.examinationId) {
        clearStep(item.examinationId);
        state.saved.delete(item.examinationId);
        state.plans.delete(item.examinationId);
        state.planSaves.delete(item.examinationId);
        state.local.delete(id);
    }
    return response;
};

// ---- The record shown for one patient ----

const toEntry = (finding) => ({
    id: finding.id,
    tooth: Number(finding.toothNumber),
    condition: finding.condition,
    surfaces: finding.surfaces ?? [],
    note: finding.notes ?? "",
    ...(finding.isReplaced ? { replaced: true } : {}),
});

// One tooth of the dental chart: its standard state (TOOTH_STATES key); current = set in this visit, else from an earlier one
const toChartTooth = (tooth) => ({
    tooth: Number(tooth.toothNumber),
    condition: tooth.condition,
    severity: tooth.severity ?? "",
    current: Boolean(tooth.recordedInThisExamination),
});

const toDiagnosis = (diagnosis) => ({ id: diagnosis.id, code: diagnosis.diagnosisCode ?? "", teeth: diagnosis.teeth ?? [], note: diagnosis.description ?? "" });

const FILM_STATUS = { Pending: "requested", InProgress: "requested", Completed: "captured", Cancelled: "cancelled" };

const toFilm = (request, review) => ({
    id: request.id,
    code: `IR-${request.id}`,
    type: imagingTypeLabel(request.imagingType),
    area: request.targetArea ?? "",
    purpose: request.clinicalIndication ?? "",
    status:
        review?.status === "Approved" ? "reviewed" : review?.status === "Retake" ? "retake" : (FILM_STATUS[request.requestStatus] ?? "requested"),
    sentAt: formatClock(request.createdAt),
});

const loadFilms = async (examinationId) => {
    const [requests, reviews] = await Promise.all([
        call(() => api.get(`/api/examinations/${examinationId}/imaging-requests`)),
        call(() => api.get("/api/imaging-reviews")),
    ]);
    const reviewById = new Map((reviews.success ? reviews.data : []).map((review) => [review.id, review]));
    return (requests.success ? requests.data : []).slice().reverse().map((request) => toFilm(request, reviewById.get(request.id)));
};

const loadHistoryAndVisits = async (item) => {
    const response = await call(() => api.get(`/api/medical-records/patients/${item.patientId}`));
    if (!response.success) return { history: null, visits: [] };
    const profiles = response.data.medicalProfiles ?? [];
    const titles = (type) => profiles.filter((profile) => profile.recordType === type).map((profile) => profile.title).filter(Boolean);
    return {
        history: { allergies: titles("Allergy"), conditions: [...titles("Condition"), ...titles("History")], dental: [] },
        visits: (response.data.examinations ?? [])
            .filter((visit) => visit.id !== item.examinationId)
            .map((visit) => ({
                id: visit.id,
                date: visit.appointmentDate ? visit.appointmentDate.split("-").reverse().join("/") : "",
                doctor: visit.doctorName ?? "",
                summary: [visit.primaryDiagnosis, visit.chiefComplaint].filter(Boolean).join(" · "),
            })),
    };
};

// Everything the exam screen shows about one patient in the queue, including the step 2 draft (record.exam).
export const getExamRecord = async (id) => {
    const item = itemOf(id);
    if (!item) return failure("Không tìm thấy hồ sơ của bệnh nhân này.");

    const [work, films, past, savedPlan] = await Promise.all([
        item.examinationId ? call(() => api.get(`/api/examinations/${item.examinationId}`)) : Promise.resolve(null),
        item.examinationId ? loadFilms(item.examinationId) : Promise.resolve([]),
        loadHistoryAndVisits(item),
        item.examinationId ? loadPlan(item.examinationId) : Promise.resolve(null),
        loadPlanTypes(),
    ]);
    if (work && !work.success) return translate(work);

    const local = localOf(item);
    // The plan saved in this visit; until there is one, the draft made from the registered services
    if (savedPlan) local.plan = planFromApi(savedPlan, item, local.plan.doctorName);
    const planTypes = Object.fromEntries(local.plan.services.map((service) => [service.serviceId, typesOf(service.serviceId)]));
    if (past.history && !local.historyLoaded) {
        local.history = past.history;
        local.historyLoaded = true;
    }

    const data = work?.data;
    // The reason for the visit starts from what the patient said when booking / checking in
    const exam = data
        ? {
              chiefComplaint: data.chiefComplaint ?? item.reason ?? "",
              symptoms: data.symptoms ?? [],
              note: data.clinicalNotes ?? "",
              entries: (data.toothFindings ?? []).map(toEntry),
              chart: (data.dentalChart ?? []).map(toChartTooth),
              films,
              diagnoses: (data.diagnoses ?? []).map(toDiagnosis),
          }
        : { chiefComplaint: item.reason ?? "", symptoms: [], note: "", entries: [], chart: [], films, diagnoses: [] };
    if (data) state.saved.set(item.examinationId, { ...structuredClone(exam), chiefComplaint: data.chiefComplaint ?? "" });

    return success(
        structuredClone({
            encounterCode: item.appointmentCode,
            patient: {
                code: item.patientCode,
                name: item.patientName,
                gender: item.gender ? String(item.gender).toLowerCase() : null,
                birthdate: item.dateOfBirth ?? "",
                age: ageOf(item.dateOfBirth),
                phone: item.phoneNumber ?? "",
                emergencyPhone: item.emergencyContactPhone ?? "",
                address: item.address ?? "",
            },
            services: item.services.map((service) => ({ id: service.serviceId, name: service.name })),
            intake: {
                reason: item.reason ?? "",
                checkInAt: item.checkInAt ? formatClock(item.checkInAt) : "",
                appointmentTime: item.timeSlotStart ? item.timeSlotStart.slice(0, 5) : null,
            },
            history: local.history,
            visits: past.visits,
            exam,
            plan: local.plan,
            planTypes,
            treatment: local.treatment,
            prescription: local.prescription,
        }),
    );
};

// One previous visit: diagnoses, prescription and plans (medical-records/examinations/{id}).
export const getVisitDetail = async (_id, visitId) => {
    const response = await call(() => api.get(`/api/medical-records/examinations/${visitId}`));
    if (!response.success) return failure("Không tìm thấy chi tiết lần khám này.");
    const visit = response.data;
    const plan = visit.treatmentPlans?.[0];
    const prescription = visit.prescriptions?.[0];
    return success({
        id: visit.id,
        date: visit.appointmentDate ? visit.appointmentDate.split("-").reverse().join("/") : "",
        doctor: visit.doctorName ?? "",
        service: "",
        reason: visit.chiefComplaint ?? "",
        nextVisit: visit.followUpDate ? visit.followUpDate.split("-").reverse().join("/") : "",
        diagnoses: (visit.diagnoses ?? []).map((item) => ({ code: item.diagnosisCode ?? "", name: item.diagnosisName ?? "", teeth: (item.teeth ?? []).join(", ") })),
        done: visit.clinicalNotes ? [visit.clinicalNotes] : [],
        plan: plan ? { code: plan.planCode ?? plan.code ?? "", name: plan.title ?? plan.name ?? "", teeth: "", status: plan.status ?? "", start: shortDate(plan.createdAt), duration: "", stages: [] } : null,
        prescription: prescription
            ? {
                  note: prescription.notes ?? "",
                  items: (prescription.items ?? []).map((med, index) => ({
                      id: med.id ?? index,
                      name: med.medicationName ?? med.name ?? "",
                      strength: med.strength ?? "",
                      quantity: med.quantity ?? "",
                      usage: med.dosage ?? med.instructions ?? "",
                  })),
              }
            : null,
    });
};

// ---- Step 2 "Khám & Chẩn đoán": saved field by field (content, tooth findings, diagnoses) ----

const serverId = (id) => (typeof id === "number" ? id : (state.ids.get(id) ?? null));

const sameEntry = (a, b) =>
    Number(a.tooth) === Number(b.tooth) && a.condition === b.condition && (a.note ?? "") === (b.note ?? "") && Boolean(a.replaced) === Boolean(b.replaced) &&
    [...(a.surfaces ?? [])].sort().join() === [...(b.surfaces ?? [])].sort().join();

const sameDiagnosis = (a, b) => a.code === b.code && (a.note ?? "") === (b.note ?? "") && [...(a.teeth ?? [])].sort().join() === [...(b.teeth ?? [])].sort().join();

const findingBody = (entry) => ({
    toothNumber: String(entry.tooth),
    condition: entry.condition,
    surfaces: entry.surfaces ?? [],
    notes: entry.note || null,
    isReplaced: Boolean(entry.replaced),
});

const diagnosisBody = (diagnosis) => ({
    diagnosisCode: diagnosis.code,
    diagnosisName: icdName(diagnosis.code) || diagnosis.code,
    description: diagnosis.note || null,
    teeth: diagnosis.teeth ?? [],
});

// Saves one list (findings or diagnoses) against what the server has: new ones are added, changed ones updated,
// removed ones deleted. Ids made on screen are matched to the server ids the add returned.
const syncList = async ({ examinationId, path, current, saved, same, body, newIdOf }) => {
    const savedById = new Map(saved.map((item) => [item.id, item]));
    const keep = new Set();
    for (const item of current) {
        const id = serverId(item.id);
        if (id == null) {
            const response = await call(() => api.post(`/api/examinations/${examinationId}/${path}`, body(item)));
            if (!response.success) return response;
            const added = newIdOf(response.data, item);
            if (added != null) {
                state.ids.set(item.id, added);
                keep.add(added);
            }
            continue;
        }
        keep.add(id);
        const before = savedById.get(id);
        if (before && same(before, item)) continue;
        const response = await call(() => api.put(`/api/examinations/${examinationId}/${path}/${id}`, body(item)));
        if (!response.success) return response;
    }
    for (const item of saved) {
        if (keep.has(item.id)) continue;
        const response = await call(() => api.delete(`/api/examinations/${examinationId}/${path}/${item.id}`));
        if (!response.success && response.status !== 404) return response;
    }
    return success(null);
};

// The id the server gave to the item just added: the newest one that is not known yet and matches it.
const newestUnknown = (list, matches) => {
    const known = new Set(state.ids.values());
    return [...list].reverse().find((item) => !known.has(item.id) && matches(item))?.id ?? null;
};

// Draft save of step 2. exam: { symptoms, note, entries, films, diagnoses }.
export const saveExamDraft = async (id, exam) => {
    const item = itemOf(id);
    if (!item?.examinationId) return failure("Lượt khám này không còn mở.");
    const examinationId = item.examinationId;
    const saved = state.saved.get(examinationId) ?? { symptoms: [], note: "", entries: [], diagnoses: [], chiefComplaint: "" };
    const chiefComplaint = exam.chiefComplaint ?? "";

    // The content call replaces the reason, the notes and the symptoms together
    if (chiefComplaint !== saved.chiefComplaint || exam.note !== saved.note || exam.symptoms.join("|") !== saved.symptoms.join("|")) {
        const response = translate(
            await call(() =>
                api.put(`/api/examinations/${examinationId}/content`, {
                    chiefComplaint: chiefComplaint.trim() || null,
                    clinicalNotes: exam.note || null,
                    symptoms: exam.symptoms,
                }),
            ),
        );
        if (!response.success) return response;
    }

    const findings = await syncList({
        examinationId,
        path: "tooth-findings",
        current: exam.entries,
        saved: saved.entries.map((entry) => ({ ...entry, id: serverId(entry.id) ?? entry.id })),
        same: sameEntry,
        body: findingBody,
        newIdOf: (list, entry) =>
            newestUnknown(list, (finding) => finding.toothNumber === String(entry.tooth) && finding.condition === entry.condition.trim()),
    });
    if (!findings.success) return translate(findings);

    const diagnoses = await syncList({
        examinationId,
        path: "diagnoses",
        current: exam.diagnoses,
        saved: saved.diagnoses.map((diagnosis) => ({ ...diagnosis, id: serverId(diagnosis.id) ?? diagnosis.id })),
        same: sameDiagnosis,
        body: diagnosisBody,
        newIdOf: (list, diagnosis) => newestUnknown(list, (item) => (item.diagnosisCode ?? "") === diagnosis.code.toUpperCase()),
    });
    if (!diagnoses.success) return translate(diagnoses);

    state.saved.set(examinationId, {
        symptoms: [...exam.symptoms],
        note: exam.note,
        entries: exam.entries.map((entry) => ({ ...structuredClone(entry), id: serverId(entry.id) ?? entry.id })),
        diagnoses: exam.diagnoses.map((diagnosis) => ({ ...structuredClone(diagnosis), id: serverId(diagnosis.id) ?? diagnosis.id })),
        films: exam.films,
        chiefComplaint,
    });
    return success({ savedAt: Date.now() });
};

// ---- Step 2 dental chart: the standard state of a tooth, saved at once (not with the draft) ----
// The backend answers with the whole chart, so a reset shows the state the tooth had before this visit again.

const chartResponse = (response) => (response.success ? success((response.data ?? []).map(toChartTooth)) : translate(response));

// state: { condition (TOOTH_STATES key), severity? }. Returns the chart: [{ tooth, condition, severity, current }].
export const setToothState = async (id, tooth, { condition, severity }) => {
    const item = itemOf(id);
    if (!item?.examinationId) return failure("Lượt khám này không còn mở.");
    return chartResponse(
        await call(() => api.put(`/api/examinations/${item.examinationId}/dental-chart/${tooth}`, { condition, severity: severity?.trim() || null })),
    );
};

// Drops the change made to this tooth in this visit.
export const resetToothState = async (id, tooth) => {
    const item = itemOf(id);
    if (!item?.examinationId) return failure("Lượt khám này không còn mở.");
    return chartResponse(await call(() => api.delete(`/api/examinations/${item.examinationId}/dental-chart/${tooth}`)));
};

// Sends an X-ray order to the imaging technician: one request per selected type.
// request: { types: [ImagingType], area, purpose, needPrint }. Returns the new films.
// The patient then leaves the room for the imaging queue and comes back to the top of this queue once the film is done.
export const requestXray = async (id, request) => {
    const item = itemOf(id);
    if (!item?.examinationId) return failure("Lượt khám này không còn mở.");
    if (!request.types?.length || !request.area?.trim()) return failure("Chọn loại chụp và nhập vùng / răng cần chụp.");
    const purpose = [request.purpose?.trim(), request.needPrint ? "Bệnh nhân cần in ảnh" : ""].filter(Boolean).join(" · ");

    const films = [];
    for (const type of request.types) {
        const response = translate(
            await call(() =>
                api.post(`/api/examinations/${item.examinationId}/imaging-requests`, {
                    imagingType: type,
                    targetArea: request.area.trim(),
                    clinicalIndication: purpose || "Theo chỉ định của bác sĩ",
                }),
            ),
        );
        if (!response.success) {
            return films.length ? success(films, `Đã gửi ${films.length} yêu cầu; yêu cầu còn lại lỗi: ${response.message}`) : response;
        }
        films.push(toFilm(response.data));
    }
    return success(films, `Đã gửi ${films.length} yêu cầu chụp tới kỹ thuật viên. Bệnh nhân sang phòng chụp, chụp xong sẽ quay lại đầu hàng chờ.`);
};

// ---- Steps 1, 3-5: kept in the browser until their APIs are wired ----

const localDraft = (id) => {
    const item = itemOf(id);
    return item ? localOf(item) : null;
};

// Draft save of step 1. history: { allergies, conditions, dental }.
export const saveMedicalHistory = async (id, history) => {
    const local = localDraft(id);
    if (!local) return failure("Không tìm thấy hồ sơ của bệnh nhân này.");
    local.history = structuredClone(history);
    return success({ savedAt: Date.now() });
};

// Step 3 draft save. plan: { services: [...] } (see utils/examination). The plan of the visit is created on the first
// save that has a session (POST examinations/{id}/treatment-plans), then replaced as a whole (PUT treatmentplans/{id}):
// the stages are the sessions in treatment order, a session that is no longer there is removed by the backend.
// A plan the patient agreed to (Approved and later) is not changed any more.
const writePlan = async (item, plan) => {
    const examinationId = item.examinationId;
    const sessions = plan.services.flatMap((service) => service.sessions.map((session) => ({ service, session })));
    if (!sessions.length) return success({ savedAt: Date.now() });

    const dateErrors = Object.values(validatePlan(plan.services, (service) => typesOf(service.serviceId), getClinicToday()).sessions).some((errors) => errors.date);
    if (dateErrors) return failure("Ngày dự kiến chưa hợp lệ: không được ở quá khứ và phải theo thứ tự các buổi.");

    const saved = state.plans.get(examinationId);
    if (saved && !PLAN_EDITABLE_STATUSES.includes(saved.status)) return failure("Kế hoạch đã được bệnh nhân đồng ý, không sửa được nữa.");

    // A new plan has no stage ids yet; an update sends the id of every stage it keeps
    const stages = sessions.map(({ service, session }) => ({
        ...(saved && { id: state.stageIds.get(session.id) ?? null }),
        serviceId: service.serviceId,
        stageName: session.title.trim() || null,
        description: describeSession(service.serviceId, session),
        estimatedCost: Number.isFinite(session.cost) ? session.cost : null,
        scheduledDate: session.date || null,
    }));
    const names = plan.services.filter((service) => service.sessions.length).map((service) => service.name);
    const body = { planName: `Kế hoạch điều trị · ${names.join(", ")}`.slice(0, 200), description: null, stages };

    const response = translate(
        await call(() =>
            saved
                ? api.put(`/api/treatmentplans/${saved.id}`, body)
                : api.post(`/api/examinations/${examinationId}/treatment-plans`, body),
        ),
    );
    if (!response.success) return response;

    // The backend numbers the stages in the order they were sent: remember which stage each session became
    const result = response.data;
    const ordered = [...result.stages].sort((a, b) => a.stageNumber - b.stageNumber);
    sessions.forEach(({ session }, index) => {
        if (ordered[index]) state.stageIds.set(session.id, ordered[index].id);
    });
    state.plans.set(examinationId, { id: result.treatmentPlanId, status: result.status });
    const local = localOf(item);
    local.plan = { ...structuredClone(plan), planId: result.treatmentPlanId, status: result.status, code: `KH${String(result.treatmentPlanId).padStart(6, "0")}` };
    return success({ savedAt: Date.now() });
};

export const saveTreatmentPlan = async (id, plan) => {
    const item = itemOf(id);
    if (!item?.examinationId) return failure("Lượt khám này không còn mở.");
    // One save at a time per plan, so a quick second change never creates a second plan
    const previous = state.planSaves.get(item.examinationId) ?? Promise.resolve();
    const next = previous.then(() => writePlan(item, plan));
    state.planSaves.set(item.examinationId, next.catch(() => null));
    return next;
};

// "Hoàn thành": the doctor has agreed the plan with the patient in the room. Saves it, proposes it and records the
// patient's agreement (Draft → Proposed → Approved) so the treatment step can start its first session.
export const confirmTreatmentPlan = async (id, plan) => {
    const item = itemOf(id);
    if (!item?.examinationId) return failure("Lượt khám này không còn mở.");
    const saved = await saveTreatmentPlan(id, plan);
    if (!saved.success && !/không sửa được nữa/.test(saved.message ?? "")) return saved;

    const current = state.plans.get(item.examinationId);
    if (!current) return failure("Chưa có buổi điều trị nào để gửi.");
    if (current.status === "Draft") {
        const proposed = translate(await call(() => api.post(`/api/treatmentplans/${current.id}/propose`)));
        if (!proposed.success) return proposed;
        current.status = proposed.data.status;
    }
    if (current.status === "Proposed") {
        const approved = translate(await call(() => api.post(`/api/treatmentplans/${current.id}/approve`)));
        if (!approved.success) return approved;
        current.status = approved.data.status;
    }
    const local = localOf(item);
    local.plan = { ...local.plan, status: current.status };
    return success(structuredClone(local.plan), "Bệnh nhân đã đồng ý kế hoạch điều trị.");
};

// Draft save of step 4. treatment: see EMPTY_TREATMENT_DRAFT.
export const saveTreatmentDraft = async (id, treatment) => {
    const local = localDraft(id);
    if (!local) return failure("Không tìm thấy hồ sơ của bệnh nhân này.");
    local.treatment = structuredClone(treatment);
    return success({ savedAt: Date.now() });
};

// Leaving step 4 for the prescription: saves the draft and marks today's session done. Returns the updated plan.
export const completeTreatmentSession = async (id, treatment) => {
    const local = localDraft(id);
    if (!local) return failure("Không tìm thấy hồ sơ của bệnh nhân này.");
    if (!treatment.items.length) return failure("Thêm ít nhất một nội dung điều trị.");
    local.treatment = structuredClone(treatment);
    const service = local.plan.services.find((entry) => entry.sessions.some((session) => session.id === treatment.sessionId));
    if (service) {
        service.sessions = service.sessions.map((session) => (session.id === treatment.sessionId ? { ...session, status: "done" } : session));
        service.status = service.sessions.every((session) => session.status === "done") ? "done" : "inProgress";
    }
    return success(structuredClone(local.plan));
};

// Draft save of step 5. prescription: see EMPTY_PRESCRIPTION_DRAFT.
export const savePrescriptionDraft = async (id, prescription) => {
    const local = localDraft(id);
    if (!local) return failure("Không tìm thấy hồ sơ của bệnh nhân này.");
    if (local.prescription.status === "Finalized") return failure("Đơn thuốc đã được chốt, không sửa được nữa.");
    local.prescription = structuredClone(prescription);
    return success({ savedAt: Date.now() });
};

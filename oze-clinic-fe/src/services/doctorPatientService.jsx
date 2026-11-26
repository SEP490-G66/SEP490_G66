import api from "./api";
import { historyFromProfiles } from "./examinationService";
import { call } from "./receptionService";
import { getClinicToday } from "../utils/format";
import { ageOf } from "../utils/patientRecord";

// Doctor's "Hồ sơ bệnh án". Every call returns the ApiResponse shape ({ success, message, data, errors }).
// Real API: GET api/medical-records/patients (the doctor's patients), GET api/medical-records/patients/{id} (record),
// GET api/patients/{id} (administrative info), GET api/patients/{id}/treatment-plans + GET api/treatmentplans/{id}
// (plans in progress), GET api/doctor-room (is the patient in the room today), POST api/examinations/{id}/addenda.

const success = (data, message = null) => ({ success: true, message, data, errors: null });
const failure = (message) => ({ success: false, message, data: null, errors: null });

// "2026-10-14" -> "14/10/2026"
const dmy = (date) => (date ? String(date).slice(0, 10).split("-").reverse().join("/") : "");

const lowerGender = (gender) => (gender ? String(gender).toLowerCase() : null);

// Phones are stored as +84…; shown the national way (0909 000 003 with formatPhone)
const nationalPhone = (phone) => (phone ? String(phone).replace(/^\+84/, "0") : "");

// A plan still being carried out (agreed by the patient)
const ACTIVE_PLAN_STATUSES = ["Approved", "InProgress"];

const toListItem = (item) => ({
    id: item.patientId,
    code: item.patientCode,
    name: item.fullName,
    gender: lowerGender(item.gender),
    age: ageOf(item.dateOfBirth, getClinicToday()),
    phone: nationalPhone(item.phoneNumber),
    lastVisit: dmy(item.lastVisitDate),
});

// One page of the doctor's patients: { items, total }. keyword: name, patient code or phone.
export const getDoctorPatients = async ({ keyword = "", page = 1, pageSize = 8, signal } = {}) => {
    const response = await call(() =>
        api.get("/api/medical-records/patients", { signal, params: { searchKeyword: keyword.trim() || undefined, pageNumber: page, pageSize } }),
    );
    if (!response.success) return response;
    return success({ items: (response.data?.items ?? []).map(toListItem), total: response.data?.totalCount ?? 0 });
};

// Stages of a plan in order: done, the next one to do, the rest
const toStages = (stages, nextStageId) =>
    [...stages]
        .sort((a, b) => a.stageNumber - b.stageNumber)
        .map((stage) => ({
            id: stage.id,
            number: stage.stageNumber,
            name: stage.stageName || stage.serviceName || "",
            date: dmy(stage.actualDate ?? stage.scheduledDate),
            status: stage.stageStatus === "Completed" ? "done" : stage.stageStatus === "Cancelled" ? "cancelled" : stage.id === nextStageId ? "next" : "todo",
        }));

const toPlan = (plan) => ({
    id: plan.treatmentPlanId,
    name: plan.planName ?? "",
    status: plan.status,
    code: `KH${String(plan.treatmentPlanId).padStart(6, "0")}`,
    doctor: plan.createdByDoctorName ?? "",
    createdAt: dmy(plan.createdAt),
    done: plan.completedStages,
    total: Math.max(0, plan.totalStages - plan.cancelledStages),
    stages: toStages(plan.stages ?? [], plan.nextStage?.id),
});

// The patient's plans in progress, each with its stages (a plan whose detail cannot be read is left out)
const loadActivePlans = async (patientId) => {
    const list = await call(() => api.get(`/api/patients/${patientId}/treatment-plans`));
    if (!list.success) return [];
    const active = (list.data ?? []).filter((plan) => ACTIVE_PLAN_STATUSES.includes(plan.status));
    const details = await Promise.all(active.map((plan) => call(() => api.get(`/api/treatmentplans/${plan.id}`))));
    return details.filter((detail) => detail.success).map((detail) => toPlan(detail.data));
};

// The patient's entry in the doctor's room today, if any: { appointmentId, status, reason }
const loadRoomEntry = async (patientId) => {
    const room = await call(() => api.get("/api/doctor-room"));
    const entry = room.success ? (room.data?.queue ?? []).find((item) => item.patientId === patientId) : null;
    return entry ? { appointmentId: entry.appointmentId, status: entry.status, reason: entry.reason ?? "" } : null;
};

// The patient the doctor is examining right now (patient id), or null: "Hồ sơ bệnh án" then opens that record
export const getPatientInExam = async ({ signal } = {}) => {
    const room = await call(() => api.get("/api/doctor-room", { signal }));
    const entry = room.success ? (room.data?.queue ?? []).find((item) => item.status === "IN_PROGRESS") : null;
    return entry?.patientId ?? null;
};

// Everything the record page shows about one patient. Fails only when the record itself cannot be read
// (403: the doctor never examined the patient).
export const getDoctorPatientRecord = async (patientId) => {
    const [record, detail, plans, roomEntry] = await Promise.all([
        call(() => api.get(`/api/medical-records/patients/${patientId}`)),
        call(() => api.get(`/api/patients/${patientId}`)),
        loadActivePlans(patientId),
        loadRoomEntry(patientId),
    ]);
    if (!record.success) return record.status === 403 ? failure("Bạn chưa khám bệnh nhân này nên không xem được hồ sơ bệnh án.") : record;

    const data = record.data;
    const info = detail.success ? detail.data : {};
    const visits = (data.examinations ?? []).map((visit) => ({
        id: visit.id,
        date: dmy(visit.appointmentDate),
        doctor: visit.doctorName ?? "",
        summary: [visit.chiefComplaint, visit.primaryDiagnosis].filter(Boolean).join(" · "),
        locked: visit.examinationStatus === "Locked",
    }));

    return success({
        patient: {
            id: data.patientId,
            code: data.patientCode,
            name: data.fullName,
            birthdate: data.dateOfBirth ?? "",
            age: ageOf(data.dateOfBirth, getClinicToday()),
            gender: lowerGender(data.gender),
            phone: nationalPhone(data.phoneNumber),
            emergencyPhone: nationalPhone(info.emergencyContactPhone),
            address: info.address ?? "",
        },
        lastVisit: visits[0]?.date ?? "",
        history: historyFromProfiles(data.medicalProfiles ?? []),
        plans,
        visits,
        roomEntry,
    });
};

// "Bổ sung" on a locked visit of the doctor: a note added to the record, the visit itself is not changed
export const addVisitAddendum = async (examinationId, content) => {
    const response = await call(() => api.post(`/api/examinations/${examinationId}/addenda`, { addendumType: "Addition", content: content.trim() }));
    return response.success ? success(response.data, "Đã lưu nội dung bổ sung.") : response;
};

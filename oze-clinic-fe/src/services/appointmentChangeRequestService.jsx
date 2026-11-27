import api from "./api";
import { call } from "./receptionService";

// "Xin đổi / huỷ lịch" (AppointmentChangeRequestsController). A patient cannot move or cancel a visit the clinic
// arranged (a treatment session, a follow-up booked by the front desk): they send a request, the front desk calls
// back, changes it with its usual tools and records what it did.
// A request: { id, type (Reschedule|Cancel), status (Pending|Rescheduled|Cancelled|Kept|Withdrawn), reason,
// preferredTimes [string], note, createdAt, handledAt, handlerNote, patientId, patientCode, patientName,
// patientPhoneNumber, appointmentId, appointmentCode, treatmentPlanStageId, visitDate, timeSlotStart, timeSlotEnd,
// visitTitle, doctorName, planName, stageNumber, totalStages, isFollowUp }.

export const CHANGE_REQUEST_TYPE = { RESCHEDULE: "Reschedule", CANCEL: "Cancel" };
export const CHANGE_REQUEST_STATUS = { PENDING: "Pending", RESCHEDULED: "Rescheduled", CANCELLED: "Cancelled", KEPT: "Kept", WITHDRAWN: "Withdrawn" };

const MESSAGES = [
    [/choose the visit/i, "Chọn lần đến cần đổi."],
    [/Visit not found/i, "Không tìm thấy lần đến này."],
    [/booked this appointment yourself/i, "Lịch này do bạn tự đặt, bạn có thể tự đổi hoặc huỷ."],
    [/can no longer be changed/i, "Lần đến này không còn đổi được."],
    [/reschedule or cancel/i, "Chọn đổi lịch hoặc huỷ."],
    [/give a reason/i, "Chọn hoặc nhập lý do."],
    [/Reason must be at most/i, "Lý do tối đa 200 ký tự."],
    [/Note must be at most/i, "Ghi chú tối đa 500 ký tự."],
    [/at most 3 preferred times/i, "Tối đa 3 giờ mong muốn."],
    [/already sent a request/i, "Bạn đã gửi yêu cầu cho lần đến này, lễ tân sẽ gọi cho bạn."],
    [/Request not found/i, "Không tìm thấy yêu cầu."],
    [/already been handled/i, "Yêu cầu này đã được xử lý."],
    [/choose what was done/i, "Chọn kết quả xử lý."],
    [/Patient profile not found/i, "Tài khoản chưa được liên kết với hồ sơ bệnh nhân."],
];

const translate = (response) => {
    if (response.success || !response.message) return response;
    const match = MESSAGES.find(([pattern]) => pattern.test(response.message));
    return match ? { ...response, message: match[1] } : response;
};

const PATIENT_CALL = { skipErrorPage: true };
const listOf = (response) => (response.success ? { ...response, data: response.data ?? [] } : response);

// ---- Patient ----

export const getMyChangeRequests = async () => listOf(translate(await call(() => api.get("/api/appointment-change-requests/my", PATIENT_CALL))));

// target: { appointmentId } or { treatmentPlanStageId }. type: CHANGE_REQUEST_TYPE. preferredTimes: ["07/12 · Sáng"].
export const sendChangeRequest = async ({ appointmentId = null, treatmentPlanStageId = null, type, reason, preferredTimes = [], note = "" }) => {
    const response = translate(
        await call(() =>
            api.post(
                "/api/appointment-change-requests",
                { appointmentId, treatmentPlanStageId, type, reason: reason.trim(), preferredTimes, note: note.trim() || null },
                PATIENT_CALL,
            ),
        ),
    );
    return response.success ? { ...response, message: "Đã gửi yêu cầu. Lễ tân sẽ gọi cho bạn để sắp xếp." } : response;
};

export const withdrawChangeRequest = async (id) => {
    const response = translate(await call(() => api.post(`/api/appointment-change-requests/${id}/withdraw`, null, PATIENT_CALL)));
    return response.success ? { ...response, message: "Đã rút yêu cầu." } : response;
};

// ---- Front desk ----

// status: a CHANGE_REQUEST_STATUS or "" for every request
export const getChangeRequests = async (status = "") =>
    listOf(translate(await call(() => api.get("/api/appointment-change-requests", { params: status ? { status } : {} }))));

// outcome: RESCHEDULED | CANCELLED | KEPT. note: what was agreed with the patient.
export const resolveChangeRequest = async (id, { outcome, note = "" }) => {
    const response = translate(await call(() => api.post(`/api/appointment-change-requests/${id}/resolve`, { outcome, note: note.trim() || null })));
    return response.success ? { ...response, message: "Đã ghi nhận, bệnh nhân sẽ nhận được thông báo." } : response;
};

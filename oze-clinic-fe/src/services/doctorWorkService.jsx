import api from "./api";
import { callPatient, getExamWorkspace } from "./examinationService";
import { getMyShifts } from "./myScheduleService";
import { call } from "./receptionService";
import { formatClock, getClinicToday } from "../utils/format";
import { imagingTypeLabel } from "../utils/imagingRequest";
import { GENDER_LABELS, QUEUE_STATUS } from "../utils/messages";
import { serverNow, serverNowMs } from "@/services/clinicTimeService";

// Doctor's "Tổng quan". Every call returns the ApiResponse shape ({ success, message, data, errors }).
// Real API: the room of the shift (GET api/doctor-room), today's shifts (GET api/schedules/my),
// films waiting for the doctor (GET api/imaging-reviews?status=Pending).

export const DOCTOR_TASK_TYPES = {
    IMAGING_REVIEW: "imaging_review",
};

const success = (data, message = null) => ({ success: true, message, data, errors: null });
const failure = (message) => ({ success: false, message, data: null, errors: null });

const minutesSince = (value) => (value ? Math.max(0, Math.round((serverNowMs() - Date.parse(value)) / 60_000)) : 0);

const ageOf = (birthDate) => {
    if (!birthDate) return null;
    const [year, month, day] = birthDate.split("-").map(Number);
    const [nowYear, nowMonth, nowDay] = getClinicToday().split("-").map(Number);
    return nowYear - year - (nowMonth < month || (nowMonth === month && nowDay < day) ? 1 : 0);
};

// The shift running now, else the first one of today still to come, else the last one
const shiftOfToday = (shifts) => {
    const now = formatClock(serverNow());
    const shift =
        shifts.find((item) => item.actualStartTime && !item.actualEndTime) ??
        shifts.find((item) => now < String(item.shiftEnd ?? "").slice(0, 5)) ??
        shifts[shifts.length - 1];
    return shift ? { start: String(shift.shiftStart ?? "").slice(0, 5), end: String(shift.shiftEnd ?? "").slice(0, 5), roomName: shift.roomName ?? null } : null;
};

// A patient still waiting in the room's queue, as the dashboard shows it
const toWaiting = (item) => ({
    id: item.appointmentId,
    queueNumber: item.queueNumber,
    patientName: item.patientName,
    gender: GENDER_LABELS[String(item.gender ?? "").toLowerCase()] ?? null,
    age: ageOf(item.dateOfBirth),
    appointmentTime: item.timeSlotStart ? item.timeSlotStart.slice(0, 5) : null,
    checkInAt: item.checkInAt ? formatClock(item.checkInAt) : "",
    waitedMinutes: minutesSince(item.checkInAt),
    atImaging: item.atImaging,
    reason: item.reason || item.services?.map((service) => service.name).join(", ") || "",
});

const toTask = (review) => ({
    id: review.id,
    type: DOCTOR_TASK_TYPES.IMAGING_REVIEW,
    title: "Duyệt kết quả chụp",
    detail: [review.patient?.name, imagingTypeLabel(review.imagingType), review.capturedAt && `chụp lúc ${formatClock(review.capturedAt)}`].filter(Boolean).join(" · "),
    status: "Chờ duyệt",
});

// Everything the doctor's dashboard shows: today's shift, numbers, waiting queue and films to review.
// A part whose call fails is left empty; the page fails only when the room cannot be read.
export const getDoctorDashboard = async () => {
    const today = getClinicToday();
    const [room, shifts, reviews] = await Promise.all([
        call(() => api.get("/api/doctor-room")),
        getMyShifts({ fromDate: today, toDate: today }),
        call(() => api.get("/api/imaging-reviews", { params: { status: "Pending" } })),
    ]);
    if (!room.success) return room;

    const queue = room.data?.queue ?? [];
    const done = room.data?.done ?? [];
    const waiting = queue.filter((item) => item.status === "WAITING");
    const inExamination = queue.filter((item) => item.status === "CALLED" || item.status === "IN_PROGRESS").length;
    const tasks = reviews.success ? (reviews.data ?? []).map(toTask) : [];
    const todayShifts = shifts.success ? (Array.isArray(shifts.data) ? shifts.data : (shifts.data?.items ?? [])) : [];

    return success({
        shift: shiftOfToday(todayShifts),
        stats: {
            totalToday: queue.length + done.length,
            waiting: waiting.length,
            inExamination,
            completed: done.length,
            longestWaitMinutes: Math.max(0, ...waiting.map((item) => minutesSince(item.checkInAt))),
            pendingImagingResults: reviews.success ? tasks.length : null,
        },
        queue: waiting.map(toWaiting),
        tasks,
    });
};

// Calls the first patient in line who is not away for an X-ray, as the "Khám bệnh" page does.
export const callNextPatient = async () => {
    const workspace = await getExamWorkspace();
    if (!workspace.success) return workspace;
    const next = workspace.data.queue.find((item) => item.status === QUEUE_STATUS.WAITING && !item.atImaging);
    if (!next) return failure("Không còn bệnh nhân nào chờ gọi (có thể đang đi chụp X-quang).");
    return callPatient(next.id);
};

import api from "./api";
import { call } from "./receptionService";
import { loadPictures } from "./imagingPictures";
import { formatClock, getClinicDateTimeParts, getClinicToday } from "@/utils/format";
import { imagingTypeLabel } from "@/utils/imagingRequest";
import { serverNow } from "@/services/clinicTimeService";

// "Duyệt kết quả chụp": imaging requests the signed-in doctor ordered (ImagingReviewsController).
// Every call returns the ApiResponse shape ({ success, message, data, errors }).

const MESSAGES = [
    [/no image waiting for review/i, "Không còn ảnh nào chờ duyệt."],
    [/Cannot review because the imaging request is/i, "Chỉ định này chưa có kết quả để duyệt."],
    [/permission to review/i, "Bạn không phải bác sĩ chỉ định lần chụp này."],
    [/retake reason/i, "Vui lòng nhập lý do chụp lại (tối đa 500 ký tự)."],
    [/Cannot request imaging because the examination is/i, "Lượt khám đã kết thúc nên không gửi chụp lại được."],
    [/Imaging request not found/i, "Không tìm thấy kết quả chụp."],
];

const translate = (response) => {
    if (response.success || !response.message) return response;
    const match = MESSAGES.find(([pattern]) => pattern.test(response.message));
    return match ? { ...response, message: match[1] } : response;
};

// "08:40" today, "01/10 08:40" another day (clinic time).
const shortTime = (value) => {
    if (!value) return null;
    const { date } = getClinicDateTimeParts(value);
    const [day, month, year] = date.split("/");
    return `${year}-${month}-${day}` === getClinicToday() ? formatClock(value) : `${day}/${month} ${formatClock(value)}`;
};

const ageOf = (birthDate) => {
    if (!birthDate) return null;
    const born = new Date(birthDate);
    const now = serverNow();
    let age = now.getFullYear() - born.getFullYear();
    if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age -= 1;
    return age;
};

// API review → the page's review: { id, code, type, time, orderedAt, capturedAt, technician, status, retakeReason, patient, images }.
// images keep fileUrl; loadReviewPictures adds the url.
const toReview = (item) => ({
    id: item.id,
    examinationId: item.examinationId,
    code: `IR-${item.id}`,
    type: [imagingTypeLabel(item.imagingType), item.targetArea].filter(Boolean).join(" · "),
    time: shortTime(item.orderedAt)?.split(" ")[0] ?? "",
    orderedAt: shortTime(item.orderedAt),
    capturedAt: shortTime(item.capturedAt),
    technician: item.technicianName,
    status: String(item.status ?? "").toLowerCase(),
    retakeReason: item.retakeReason,
    clinicalIndication: item.clinicalIndication,
    patient: {
        name: item.patient?.name ?? "",
        code: item.patient?.code ?? "",
        gender: item.patient?.gender ? String(item.patient.gender).toLowerCase() : null,
        age: ageOf(item.patient?.birthDate),
        allergies: [],
    },
    images: (item.images ?? []).map((image) => ({ id: image.id, fileName: image.fileName, fileUrl: image.fileUrl, reviewStatus: image.reviewStatus })),
});

// All X-ray results of the doctor, newest first.
export const getImagingReviews = async () => {
    const response = translate(await call(() => api.get("/api/imaging-reviews")));
    return response.success ? { ...response, data: (response.data ?? []).map(toReview) } : response;
};

// The pictures of one review, fetched with the sign-in token (see imagingPictures).
export const loadReviewPictures = (review) => loadPictures(review.images);

export const approveImagingReview = async (id) => {
    const response = translate(await call(() => api.post(`/api/imaging-requests/${id}/approve`)));
    return response.success ? { ...response, data: toReview(response.data) } : response;
};

// The pictures are rejected and the same order goes back to the technician with the doctor's reason.
export const requestImagingRetake = async (id, reason) => {
    const response = translate(await call(() => api.post(`/api/imaging-requests/${id}/retake`, { reason })));
    return response.success ? { ...response, data: toReview(response.data) } : response;
};

// TODO(api): sample "Lịch sử chụp chiếu" rows until the backend has a history endpoint for the technician.
// Same fields as ImagingHistoryTable / ImagingHistoryDetailDialog.

const at = (daysAgo, time) => {
    const date = new Date(Date.now() - daysAgo * 86_400_000);
    const day = date.toISOString().slice(0, 10);
    return `${day}T${time}:00+07:00`;
};

const row = (id, daysAgo, time, patientName, patientCode, imagingType, targetArea, doctorName, deviceId, imageCount, extra = {}) => ({
    id,
    createdAt: at(daysAgo, time),
    completedAt: extra.cancelReason ? null : at(daysAgo, time.replace(/:(\d)\d$/, ":$15")),
    patientName,
    patientCode,
    gender: extra.gender ?? "female",
    birthDate: extra.birthDate ?? "1990-05-12",
    imagingType,
    targetArea,
    clinicalIndication: extra.clinicalIndication ?? "Đánh giá trước điều trị.",
    doctorName,
    deviceId,
    imageCount,
    status: extra.cancelReason ? "Cancelled" : "Completed",
    cancelReason: extra.cancelReason ?? null,
    cancelledAt: extra.cancelReason ? at(daysAgo, time) : null,
    technicianNote: extra.technicianNote ?? null,
    images: Array.from({ length: extra.cancelReason ? 0 : imageCount }, (_, index) => ({ id: `${id}-${index + 1}` })),
});

export const MOCK_IMAGING_HISTORY = [
    row(1032, 0, "09:02", "Ngô Minh Anh", "BN-261019-000152", "Panoramic", "Toàn hàm", "BS. Trần Minh Khoa", null, 0, { cancelReason: "Đã có phim chụp ở cơ sở khác trong tuần", gender: "male" }),
    row(1031, 0, "08:55", "Nguyễn Thị Hoa", "BN-261019-000032", "Panoramic", "Toàn hàm", "BS. Trần Minh Khoa", "XR-PANO-01", 1),
    row(1030, 0, "08:50", "Đặng Thị Hương", "BN-261019-000071", "Periapical X-ray", "Răng 46", "BS. Trần Minh Khoa", "XR-IO-01", 1),
    row(1029, 0, "08:44", "Phạm Thị Lan", "BN-261019-000176", "Panoramic", "Toàn hàm", "BS. Trần Minh Khoa", "XR-PANO-01", 1),
    row(1028, 0, "08:24", "Hoàng Minh Đức", "BN-261019-000121", "Periapical X-ray", "Răng 36", "BS. Lê Thu Hà", "XR-IO-01", 2, { gender: "male" }),
    row(1027, 1, "16:26", "Lâm Văn Tài", "BN-261018-000217", "Cephalometric", "Sọ mặt nghiêng", "BS. Lê Thu Hà", null, 1, {
        gender: "male",
        technicianNote: "Chụp trên máy Cephalometric phòng 2, máy giả lập không hỗ trợ.",
    }),
    row(1026, 1, "15:09", "Hồ Thị Yến", "BN-261018-000179", "Panoramic", "Toàn hàm", "BS. Trần Minh Khoa", "XR-PANO-01", 1),
    row(1025, 1, "12:52", "Phan Văn Lộc", "BN-261018-000131", "Periapical X-ray", "Răng 36", "BS. Lê Thu Hà", "XR-IO-01", 1, { gender: "male" }),
    row(1024, 1, "10:00", "Võ Minh Tuấn", "BN-261018-000165", "Intraoral Photo", "Răng cửa hàm trên", "BS. Lê Thu Hà", null, 1, { gender: "male" }),
    row(1023, 2, "14:31", "Trần Thị Mai", "BN-261017-000098", "Periapical X-ray", "Răng 11, 21", "BS. Lê Thu Hà", "XR-IO-01", 2),
    row(1022, 2, "09:40", "Bùi Quang Huy", "BN-261017-000044", "CBCT", "Hàm dưới", "BS. Trần Minh Khoa", null, 0, { cancelReason: "Bệnh nhân chuyển sang chụp ở bệnh viện", gender: "male" }),
    row(1021, 3, "11:15", "Lý Thu Trang", "BN-261016-000210", "Panoramic", "Toàn hàm", "BS. Trần Minh Khoa", "XR-PANO-01", 1),
];

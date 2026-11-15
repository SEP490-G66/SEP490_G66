// How the "Cấu hình hệ thống" page shows each setting of api/system-configs: its group, label, unit and limits.
// The backend sends the key, value, data type and description; a key not listed here goes to "Khác",
// labelled with its key. Labels are short names of the settings, not descriptions.

export const CONFIG_DATA_TYPES = {
    INT: "int",
    TIME: "time",
    TEXT: "text",
};

export const CONFIG_GROUPS = [
    { key: "booking", title: "Đặt lịch hẹn" },
    { key: "reception", title: "Cảnh báo cho lễ tân" },
    { key: "checkIn", title: "Check-in" },
    { key: "queue", title: "Hàng chờ" },
    { key: "clinic", title: "Giờ làm việc" },
    { key: "other", title: "Khác" },
];

export const OTHER_GROUP = "other";

const { INT, TIME, TEXT } = CONFIG_DATA_TYPES;

// min / max are the page's limits; the backend only asks for a whole number >= 0 (> 0 for the slot length and
// the booking window), a "HH:mm" time with opening before closing, and an active service code.
export const CONFIG_FIELDS = {
    "Booking.MaxDaysAhead": { group: "booking", label: "Thời hạn đặt lịch tối đa", dataType: INT, unit: "ngày", min: 1, max: 365 },
    "Booking.MinHoursAhead": { group: "booking", label: "Thời gian đặt lịch tối thiểu", dataType: INT, unit: "giờ", min: 0, max: 72 },
    "Booking.CancelCutoffHours": { group: "booking", label: "Hạn tự huỷ lịch hẹn", dataType: INT, unit: "giờ", min: 0, max: 168 },
    "Booking.GeneralExamServiceCode": { group: "booking", label: "Mã dịch vụ khám tổng quát", dataType: TEXT, maxLength: 20 },
    "Booking.PendingConfirmHours": { group: "reception", label: "Hạn xác nhận lịch hẹn", dataType: INT, unit: "giờ", min: 0, max: 168 },
    "Booking.PendingVisitSoonHours": { group: "reception", label: "Cảnh báo lịch sắp đến giờ khám", dataType: INT, unit: "giờ", min: 0, max: 168 },
    "CheckIn.EarlyMinutes": { group: "checkIn", label: "Thời gian check-in sớm", dataType: INT, unit: "phút", min: 0, max: 240 },
    "CheckIn.LateMinutes": { group: "checkIn", label: "Thời gian trễ hẹn tối đa", dataType: INT, unit: "phút", min: 0, max: 240 },
    "Queue.AutoExpireMinutes": { group: "queue", label: "Thời gian chờ tối đa", dataType: INT, unit: "phút", min: 5, max: 480 },
    "Clinic.WorkStartTime": { group: "clinic", label: "Giờ mở cửa", dataType: TIME },
    "Clinic.WorkEndTime": { group: "clinic", label: "Giờ đóng cửa", dataType: TIME },
    "Clinic.SlotDurationMinutes": { group: "clinic", label: "Độ dài khung giờ hẹn", dataType: INT, unit: "phút", min: 5, max: 240 },
};

export const WORK_START_KEY = "Clinic.WorkStartTime";
export const WORK_END_KEY = "Clinic.WorkEndTime";

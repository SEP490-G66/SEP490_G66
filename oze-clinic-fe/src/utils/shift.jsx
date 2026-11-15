export const SHIFT_SLOTS = {
    MORNING: "morning",
    AFTERNOON: "afternoon",
};

// Same hours as the shifts the backend seeds; a shift starting before 12:00 counts as a morning shift
// (LeaveRequestConstants.AfternoonStartsAt on the backend).
export const SHIFT_SLOT_OPTIONS = [
    { value: SHIFT_SLOTS.MORNING, label: "Ca sáng", start: "08:00", end: "12:00" },
    { value: SHIFT_SLOTS.AFTERNOON, label: "Ca chiều", start: "13:00", end: "17:00" },
];

export const AFTERNOON_STARTS_AT = "12:00";

export const SHIFT_STATUSES = {
    PRESENT: "present",
    ABSENT: "absent",
    LEAVE: "leave",
    // Assigned, but nobody has clocked in yet.
    PENDING: "pending",
    UNASSIGNED: "unassigned",
};

export const SHIFT_STATUS_OPTIONS = [
    { value: SHIFT_STATUSES.PRESENT, label: "Có mặt" },
    { value: SHIFT_STATUSES.ABSENT, label: "Vắng" },
    { value: SHIFT_STATUSES.LEAVE, label: "Nghỉ" },
    { value: SHIFT_STATUSES.PENDING, label: "Chưa điểm danh" },
    { value: SHIFT_STATUSES.UNASSIGNED, label: "Chưa phân ca" },
];

export const LEAVE_REQUEST_STATUSES = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
};

// Only approved requests take a person off a shift.
export const LEAVE_REQUEST_STATUS_LABELS = {
    [LEAVE_REQUEST_STATUSES.PENDING]: { label: "Chờ duyệt", badge: "badge-warning" },
    [LEAVE_REQUEST_STATUSES.APPROVED]: { label: "Đã duyệt", badge: "badge-success" },
    [LEAVE_REQUEST_STATUSES.REJECTED]: { label: "Từ chối", badge: "badge-danger" },
};

// The part of the day a leave request covers. slot null = the whole day.
export const LEAVE_SLOT_OPTIONS = [{ value: null, label: "Cả ngày" }, ...SHIFT_SLOT_OPTIONS];

export const leaveSlotLabel = (slot) => LEAVE_SLOT_OPTIONS.find((option) => option.value === slot)?.label ?? "";

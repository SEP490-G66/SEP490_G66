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
    // Withdrawn by the staff member before a decision
    CANCELLED: "cancelled",
};

// Only approved requests take a person off a shift.
export const LEAVE_REQUEST_STATUS_LABELS = {
    [LEAVE_REQUEST_STATUSES.PENDING]: { label: "Chờ duyệt", badge: "badge-warning" },
    [LEAVE_REQUEST_STATUSES.APPROVED]: { label: "Đã duyệt", badge: "badge-success" },
    [LEAVE_REQUEST_STATUSES.REJECTED]: { label: "Từ chối", badge: "badge-danger" },
    [LEAVE_REQUEST_STATUSES.CANCELLED]: { label: "Đã rút", badge: "badge-neutral" },
};

// Texts of ErrorConstants.LeaveRequestMessage, for the manager page and the staff member's own schedule.
const LEAVE_MESSAGES = {
    "Leave request not found.": "Không tìm thấy đơn xin nghỉ.",
    "Your staff profile was not found.": "Không tìm thấy hồ sơ nhân viên của bạn.",
    "Slot must be Morning, Afternoon or empty for the whole day.": "Buổi nghỉ không hợp lệ.",
    "Please enter the reason for the leave.": "Vui lòng nhập lý do xin nghỉ.",
    "Leave can only be requested for a future shift.": "Chỉ xin nghỉ được cho ca chưa diễn ra.",
    "You have no shift in that time to take leave from.": "Bạn không có ca làm nào trong thời gian này.",
    "A shift in that time has already started.": "Có ca trong thời gian này đã bắt đầu.",
    "You already have a pending or approved leave request for that time.": "Bạn đã có đơn chờ duyệt hoặc đã duyệt cho thời gian này.",
    "You can only cancel your own leave request.": "Bạn chỉ rút được đơn của chính mình.",
    "This leave request has already been decided.": "Đơn này đã được xử lý trước đó.",
    "Please enter the reason for rejecting.": "Vui lòng nhập lý do từ chối.",
    "These shifts have booked appointments. Choose a substitute or reschedule the appointments first.":
        "Các ca này đã có lịch hẹn. Hãy chọn người thay hoặc dời lịch hẹn trước.",
    "Substitute staff not found or inactive.": "Không tìm thấy người thay hoặc tài khoản đã bị khoá.",
    "The substitute must be another staff member.": "Người thay phải là nhân viên khác.",
    "The substitute must have the same role.": "Người thay phải cùng vai trò.",
    "The substitute already has a shift or leave in that time.": "Người thay đã có ca hoặc đang nghỉ trong thời gian này.",
    "Leave request has been sent.": "Đã gửi đơn xin nghỉ. Chờ quản lý duyệt.",
    "Leave request has been cancelled.": "Đã rút đơn xin nghỉ.",
    "Leave request has been approved.": "Đã duyệt đơn xin nghỉ.",
    "Leave request has been rejected.": "Đã từ chối đơn xin nghỉ.",
};

export const leaveMessage = (message) => LEAVE_MESSAGES[message] ?? message;

// The part of the day a leave request covers. slot null = the whole day.
export const LEAVE_SLOT_OPTIONS = [{ value: null, label: "Cả ngày" }, ...SHIFT_SLOT_OPTIONS];

export const leaveSlotLabel = (slot) => LEAVE_SLOT_OPTIONS.find((option) => option.value === slot)?.label ?? "";

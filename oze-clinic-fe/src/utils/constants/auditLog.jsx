import { BACKEND_ROLE_NAMES, ROLE_LABELS } from "../messages";

// Names for what api/audit-logs returns: the actions and record types of AuditConstants on the backend, the roles,
// and the fields of the values before / after (JSON with the backend's property names).

// variant: colour of the action badge (Badge). A value not listed shows as it is, in grey.
export const AUDIT_ACTION_LABELS = {
    APPOINTMENT_CREATED: { label: "Đặt lịch hẹn", variant: "success" },
    APPOINTMENT_CONFIRMED: { label: "Xác nhận lịch hẹn", variant: "info" },
    APPOINTMENT_CANCELLED: { label: "Huỷ lịch hẹn", variant: "danger" },
    APPOINTMENT_CHECKED_IN: { label: "Check-in", variant: "info" },
    APPOINTMENT_RESCHEDULED: { label: "Đổi lịch hẹn", variant: "warning" },
    APPOINTMENT_PRIORITY_CHANGED: { label: "Đổi mức ưu tiên", variant: "warning" },
    APPOINTMENT_EXAMINATION_STARTED: { label: "Bắt đầu khám", variant: "info" },
    APPOINTMENT_COMPLETED: { label: "Hoàn thành khám", variant: "success" },
    APPOINTMENT_NO_SHOW: { label: "Đánh dấu lỡ hẹn", variant: "danger" },
    APPOINTMENT_NO_SHOW_REVERTED: { label: "Bỏ đánh dấu lỡ hẹn", variant: "warning" },
    APPOINTMENT_DOCTOR_REASSIGNED: { label: "Đổi bác sĩ", variant: "warning" },
    APPOINTMENT_FOLLOW_UP_SCHEDULED: { label: "Đặt lịch tái khám", variant: "success" },
    STAFF_SHIFT_STARTED: { label: "Vào ca", variant: "info" },
    STAFF_SHIFT_ENDED: { label: "Kết thúc ca", variant: "info" },
    STAFF_SHIFT_REOPENED: { label: "Mở lại ca", variant: "warning" },
    EXAMINATION_FOLLOW_UP_SET: { label: "Hẹn tái khám", variant: "info" },
    EXAMINATION_ADDENDUM_ADDED: { label: "Bổ sung bệnh án", variant: "warning" },
    FOLLOW_UP_REMINDED: { label: "Nhắc tái khám", variant: "info" },
    FOLLOW_UP_CONTACT_RECORDED: { label: "Ghi nhận cuộc gọi tái khám", variant: "info" },
    INVOICE_CREATED: { label: "Tạo hoá đơn", variant: "success" },
    INVOICE_UPDATED: { label: "Sửa hoá đơn", variant: "warning" },
    INVOICE_CANCELLED: { label: "Huỷ hoá đơn", variant: "danger" },
    PAYMENT_RECORDED: { label: "Ghi nhận thanh toán", variant: "success" },
    PAYMENT_CONFIRMED: { label: "Xác nhận thanh toán", variant: "success" },
    PAYMENT_VOIDED: { label: "Huỷ thanh toán", variant: "danger" },
    PAYMENT_REMINDED: { label: "Nhắc thanh toán", variant: "info" },
    INSTALLMENT_PLAN_CREATED: { label: "Tạo kế hoạch trả góp", variant: "success" },
    INSTALLMENT_PERIOD_PAID: { label: "Thanh toán kỳ trả góp", variant: "success" },
    REFUND_REQUESTED: { label: "Yêu cầu hoàn tiền", variant: "info" },
    REFUND_WORK_DONE_SET: { label: "Ghi phần việc đã làm", variant: "warning" },
    REFUND_APPROVED: { label: "Duyệt hoàn tiền", variant: "success" },
    REFUND_REJECTED: { label: "Từ chối hoàn tiền", variant: "danger" },
    REFUND_PROCESSED: { label: "Đã hoàn tiền", variant: "success" },
    LEAVE_REQUESTED: { label: "Gửi đơn xin nghỉ", variant: "info" },
    LEAVE_CANCELLED: { label: "Rút đơn xin nghỉ", variant: "warning" },
    LEAVE_APPROVED: { label: "Duyệt đơn xin nghỉ", variant: "success" },
    LEAVE_REJECTED: { label: "Từ chối đơn xin nghỉ", variant: "danger" },
    CASH_SESSION_OPENED: { label: "Mở ca thu ngân", variant: "info" },
    CASH_EXPENSE_ADDED: { label: "Thêm khoản chi", variant: "warning" },
    CASH_EXPENSE_REMOVED: { label: "Xoá khoản chi", variant: "danger" },
    CASH_SESSION_CLOSED: { label: "Đóng ca thu ngân", variant: "info" },
    DAILY_RECONCILED: { label: "Chốt đối soát ngày", variant: "success" },
    CONSULTATION_HANDLED: { label: "Xử lý yêu cầu tư vấn", variant: "info" },
    SYSTEM_CONFIG_UPDATED: { label: "Sửa cấu hình hệ thống", variant: "warning" },
};

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS)
    .map(([value, { label }]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));

export const auditActionLook = (action) => AUDIT_ACTION_LABELS[action] ?? { label: action, variant: "neutral" };

export const AUDIT_ENTITY_OPTIONS = [
    { value: "Appointment", label: "Lịch hẹn" },
    { value: "Examination", label: "Lượt khám" },
    { value: "StaffSchedule", label: "Ca làm việc" },
    { value: "LeaveRequest", label: "Đơn xin nghỉ" },
    { value: "Invoice", label: "Hoá đơn" },
    { value: "Payment", label: "Thanh toán" },
    { value: "InstallmentPlan", label: "Kế hoạch trả góp" },
    { value: "InstallmentPeriod", label: "Kỳ trả góp" },
    { value: "RefundAdjustmentRequest", label: "Yêu cầu hoàn tiền" },
    { value: "CashSession", label: "Ca thu ngân" },
    { value: "DailyReconciliation", label: "Đối soát ngày" },
    { value: "ConsultationRequest", label: "Yêu cầu tư vấn" },
    { value: "SystemConfiguration", label: "Cấu hình hệ thống" },
];

export const auditEntityLabel = (entityType) => AUDIT_ENTITY_OPTIONS.find((option) => option.value === entityType)?.label ?? entityType ?? "—";

// Backend role name ("Doctor") -> "Bác sĩ".
export const auditRoleLabel = (backendRole) => {
    const role = Object.keys(BACKEND_ROLE_NAMES).find((key) => BACKEND_ROLE_NAMES[key] === backendRole);
    return role ? ROLE_LABELS[role] : (backendRole ?? "");
};

// An entry without a user was made by the system itself (a background job).
export const SYSTEM_ACTOR = "Hệ thống";

// Fields of the values before / after; a field not listed shows its own name.
export const AUDIT_FIELD_LABELS = {
    Status: "Trạng thái",
    ExaminationStatus: "Trạng thái lượt khám",
    NoShowStatus: "Trạng thái lỡ hẹn",
    Priority: "Mức ưu tiên",
    AppointmentDate: "Ngày hẹn",
    TimeSlotStart: "Giờ bắt đầu",
    TimeSlotEnd: "Giờ kết thúc",
    DoctorId: "Mã bác sĩ",
    Id: "Mã",
    Value: "Giá trị",
    Description: "Mô tả",
    Amount: "Số tiền",
    RefundTotal: "Tổng hoàn",
    Reason: "Lý do",
    RejectionReason: "Lý do từ chối",
    Note: "Ghi chú",
    HandleNote: "Ghi chú xử lý",
    Outcome: "Kết quả",
    CallBackDate: "Ngày gọi lại",
    Slot: "Buổi",
    LeaveDate: "Ngày nghỉ",
    SubstituteStaffProfileId: "Người thay",
    InstallmentPeriodId: "Kỳ trả góp",
    OpeningCash: "Tiền mặt đầu ca",
    CashCollected: "Tiền mặt đã thu",
    ExpectedCash: "Tiền mặt dự kiến",
    CountedCash: "Tiền mặt kiểm đếm",
    Difference: "Chênh lệch",
    CashDifference: "Chênh lệch tiền mặt",
    PendingTransferCount: "Chuyển khoản chờ xác nhận",
    HandoverToUserId: "Bàn giao cho",
    Category: "Loại",
    Channels: "Kênh",
    Content: "Nội dung",
    OriginalContent: "Nội dung ban đầu",
    AddendumType: "Loại bổ sung",
};

export const auditFieldLabel = (field) => AUDIT_FIELD_LABELS[field] ?? field;

import { USER_ROLES } from "../messages";

// Staff account status on the page; the Staff API sends isActive (a locked account is inactive).
export const ACCOUNT_STATUSES = {
    ACTIVE: "active",
    LOCKED: "locked",
};

// Short role names used in the staff table (ROLE_LABELS in messages has the long ones).
export const STAFF_ROLE_OPTIONS = [
    { value: USER_ROLES.CLINIC_MANAGER, label: "Quản lý" },
    { value: USER_ROLES.DOCTOR, label: "Bác sĩ" },
    { value: USER_ROLES.DENTAL_IMAGING_TECHNICIAN, label: "KTV hình ảnh" },
    { value: USER_ROLES.RECEPTIONIST, label: "Lễ tân" },
];

export const ACCOUNT_STATUS_OPTIONS = [
    { value: ACCOUNT_STATUSES.ACTIVE, label: "Hoạt động" },
    { value: ACCOUNT_STATUSES.LOCKED, label: "Đã khoá" },
];

// For StatusBadge.
export const ACCOUNT_STATUS_LABELS = {
    [ACCOUNT_STATUSES.ACTIVE]: { label: "Hoạt động", badge: "badge-success" },
    [ACCOUNT_STATUSES.LOCKED]: { label: "Đã khoá", badge: "badge-danger" },
};

export const staffRoleLabel = (role) => STAFF_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role ?? "";

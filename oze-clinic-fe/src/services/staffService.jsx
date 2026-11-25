import { BACKEND_ROLE_NAMES, USER_ROLES, VALIDATION_MESSAGES } from "../utils/messages";
import { ACCOUNT_STATUSES } from "../utils/constants/staff";
import { normalizePhone } from "../utils/validation";
import api from "./api";
import { call } from "./receptionService";

// Staff accounts (api/Staff, ClinicManager only). The backend returns the whole list; it is small, so the paging
// is done here. Locking an account = deactivate (the staff member can no longer sign in), unlocking = activate.

export const STAFF_PAGE_SIZE = 10;

const GENERIC_ERROR = "Có lỗi xảy ra, vui lòng thử lại sau.";

// Texts of ErrorConstants (StaffMessage / AuthMessage), put on the form field they are about.
const FIELD_MESSAGES = {
    "Email already exists in the system.": ["email", VALIDATION_MESSAGES.EMAIL_IN_USE],
    "Email is invalid. Please check again.": ["email", VALIDATION_MESSAGES.EMAIL_INVALID],
    "Phone number already exists in the system.": ["phone", VALIDATION_MESSAGES.PHONE_IN_USE],
    "Phone number is invalid. Please check again.": ["phone", VALIDATION_MESSAGES.PHONE_INVALID],
    "License number already exists in the system.": ["licenseNumber", "Số chứng chỉ hành nghề đã tồn tại."],
    "Please enter license number.": ["licenseNumber", "Vui lòng nhập số chứng chỉ hành nghề."],
    "License number is invalid. Please check again.": ["licenseNumber", "Số chứng chỉ hành nghề không hợp lệ."],
    "Specialization is invalid. Please check again.": ["specialization", "Chuyên khoa không hợp lệ."],
    "Full name is invalid. Please check again.": ["fullName", VALIDATION_MESSAGES.FULL_NAME_TOO_LONG],
    "Role is invalid. Please check again.": ["role", "Vai trò không hợp lệ."],
};

// Messages shown for the whole form or as a toast.
const MESSAGES = {
    "Create staff success!": "Đã tạo tài khoản. Thông tin đăng nhập đã được gửi qua email của nhân viên.",
    "Update staff success!": "Đã cập nhật tài khoản.",
    "Deactivate staff success!": "Đã khoá tài khoản.",
    "Activate staff success!": "Đã mở khoá tài khoản.",
    "Staff not found.": "Tài khoản không còn tồn tại.",
    "You cannot change your own role.": "Bạn không thể đổi vai trò của chính mình.",
    "You cannot deactivate your own account.": "Bạn không thể khoá tài khoản của chính mình.",
    "Cannot deactivate because staff is inactive.": "Tài khoản đã bị khoá trước đó.",
    "Cannot activate because staff is active.": "Tài khoản đang hoạt động.",
    "This staff member still has shifts or appointments from now on; move or cancel them first":
        "Nhân viên vẫn còn ca làm hoặc lịch hẹn sắp tới. Hãy chuyển hoặc huỷ chúng trước.",
    "The clinic must keep at least one active clinic manager": "Phòng khám phải còn ít nhất một quản lý đang hoạt động.",
    "Could not send the email. Please try again later.": "Không gửi được email thông tin đăng nhập. Vui lòng thử lại sau.",
};

const toVietnamese = (message) => MESSAGES[message] ?? message ?? GENERIC_ERROR;

const roleFromBackend = (backendRole) => Object.keys(BACKEND_ROLE_NAMES).find((key) => BACKEND_ROLE_NAMES[key] === backendRole) ?? "";

// The backend stores phones as +84...; the page shows and edits them as 0...
const toLocalPhone = (phone) => (phone ?? "").replace(/^\+84/, "0");

const toMember = (item) => ({
    id: item.userId,
    fullName: item.fullName,
    email: item.email ?? "",
    phone: toLocalPhone(item.phoneNumber),
    role: roleFromBackend(item.role),
    specialization: item.specialization ?? "",
    licenseNumber: item.licenseNumber ?? "",
    status: item.isActive ? ACCOUNT_STATUSES.ACTIVE : ACCOUNT_STATUSES.LOCKED,
    temporaryPassword: item.temporaryPassword ?? undefined,
});

// Specialization and license number are only kept for doctors (the backend drops them for other roles).
const toApiRequest = (request) => {
    const isDoctor = request.role === USER_ROLES.DOCTOR;
    return {
        fullName: request.fullName.trim(),
        email: request.email.trim(),
        phoneNumber: normalizePhone(request.phone),
        role: BACKEND_ROLE_NAMES[request.role],
        specialization: isDoctor ? request.specialization.trim() || null : null,
        licenseNumber: isDoctor ? request.licenseNumber.trim() || null : null,
    };
};

// A failure tied to a field goes to errors[field]; any other one to message (shown at the top of the form or in a toast).
const toFailure = (result) => {
    const field = FIELD_MESSAGES[result.message];
    if (field) return { ...result, message: null, errors: { [field[0]]: field[1] } };
    return { ...result, message: toVietnamese(result.message), errors: null };
};

const toResult = (result) => (result.success ? { ...result, message: toVietnamese(result.message), data: toMember(result.data) } : toFailure(result));

// Search by name, email or phone (done by the backend); filter by role and status.
export const getStaffAccounts = async ({ keyword = "", role = "", status = "", page = 1, pageSize = STAFF_PAGE_SIZE } = {}) => {
    const result = await call(() =>
        api.get("/api/Staff", {
            params: {
                keyword: keyword || undefined,
                role: BACKEND_ROLE_NAMES[role],
                isActive: status ? status === ACCOUNT_STATUSES.ACTIVE : undefined,
            },
        }),
    );
    if (!result.success) return { ...result, message: toVietnamese(result.message) };

    const members = result.data.map(toMember);
    const totalItems = members.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * pageSize;

    return { ...result, data: { items: members.slice(start, start + pageSize), page: currentPage, pageSize, totalItems, totalPages } };
};

// request: { fullName, role, email, phone, specialization, licenseNumber }.
// The backend makes a temporary password and emails the login information to the staff member.
export const createStaffAccount = async (request) => toResult(await call(() => api.post("/api/Staff", toApiRequest(request))));

export const updateStaffAccount = async (id, request) => toResult(await call(() => api.put(`/api/Staff/${id}`, toApiRequest(request))));

// The backend refuses while the staff member still has upcoming shifts or appointments.
export const lockStaffAccount = async (id) => toResult(await call(() => api.put(`/api/Staff/${id}/deactivate`)));

export const unlockStaffAccount = async (id) => toResult(await call(() => api.put(`/api/Staff/${id}/activate`)));

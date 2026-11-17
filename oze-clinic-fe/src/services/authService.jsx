import api from "./api";
import { BACKEND_LOGIN_CODES, CHANGE_PASSWORD_TEXT, GENERIC_ERROR_MESSAGE, MESSAGES, VALIDATION_MESSAGES, VERIFICATION_METHOD } from "../utils/messages";
import { getDefaultMockUserId, setMockCurrentUserId } from "../utils/data/mockData";
import { invalidMessage } from "../utils/validation";
import { clearSession, getSessionRefreshToken, getSessionToken, isAccessTokenExpired, saveSession, sessionFromAuthResult } from "./sessionStore";

const failure = (message) => ({ success: false, message, data: null, errors: null });

const success = (data) => ({ success: true, message: null, data, errors: null });

const AUTH_REQUEST_CONFIG = { skipAuthRefresh: true };

const loginFailure = (code) => {
    if (code === BACKEND_LOGIN_CODES.INVALID_CREDENTIALS) return failure(MESSAGES.MSG24);
    if (code === BACKEND_LOGIN_CODES.LOCKED_OUT) return failure(MESSAGES.MSG26);
    if (code === BACKEND_LOGIN_CODES.ACCOUNT_DISABLED) return failure(MESSAGES.MSG80);
    return failure(GENERIC_ERROR_MESSAGE);
};

const sendLogout = (refreshToken) => {
    api.post("/api/Auth/logout", { refreshToken }, AUTH_REQUEST_CONFIG).catch(() => { });
};

// The default mock user of the role is kept as the current mock user, for the pages not wired to the API yet.
const completeSignIn = (body) => {
    if (body?.success !== true) return loginFailure(body?.code);

    const data = body.data;
    if (typeof data?.token !== "string" || typeof data?.refreshToken !== "string" || !data.token || !data.refreshToken) {
        return failure(GENERIC_ERROR_MESSAGE);
    }

    const session = sessionFromAuthResult(data);
    if (!session) {
        sendLogout(data.refreshToken);
        return failure(GENERIC_ERROR_MESSAGE);
    }

    setMockCurrentUserId(getDefaultMockUserId(session.role));
    saveSession(session);
    return success({ role: session.role });
};

// A failure without an ApiResponse code (network error, timeout, server error) gets the generic message.
export const signIn = async ({ identifier, password }) => {
    try {
        const response = await api.post("/api/Auth/login", { identifier, password }, AUTH_REQUEST_CONFIG);
        return completeSignIn(response.data);
    } catch (error) {
        return loginFailure(error.response?.data?.code);
    }
};

export const signOut = () => {
    const token = getSessionToken();
    const refreshToken = getSessionRefreshToken();
    const expired = token !== null && isAccessTokenExpired(token);

    setMockCurrentUserId(null);
    clearSession();
    if (refreshToken) sendLogout(refreshToken);
    return { expired };
};

const GENERIC_ERROR = "Có lỗi xảy ra, vui lòng thử lại sau.";

const PHONE_EXISTS_PATTERN = /^Patient with phone number .+ already exists/;

const RESET_SESSION_INVALID = "Password reset session is invalid or expired, please request a new code";

// The texts of ErrorConstants.AuthMessage that Register and Forgot Password can show. TODO(be): match stable codes once these responses have them.
const AUTH_MESSAGES = {
    "Full name is invalid. Please check again.": invalidMessage("Họ và tên"),
    "Date of birth is invalid. Please check again.": invalidMessage("Ngày sinh"),
    "Phone number is invalid. Please check again.": VALIDATION_MESSAGES.PHONE_INVALID,
    "Email is invalid. Please check again.": VALIDATION_MESSAGES.EMAIL_INVALID,
    "Email already exists in the system.": VALIDATION_MESSAGES.EMAIL_IN_USE,
    "OTP is invalid. Please check again.": invalidMessage("Mã xác minh"),
    "OTP has been sent to your phone number.": "Mã xác minh đã được gửi đến số điện thoại của bạn.",
    "OTP has been sent to your email.": "Mã xác minh đã được gửi đến email của bạn.",
    "Could not send the OTP. Please try again later.": "Không thể gửi mã xác minh. Vui lòng thử lại sau.",
    "OTP has expired. Please register again.": "Mã xác minh đã hết hạn. Vui lòng đăng ký lại.",
    "Please wait before requesting another OTP.": "Vui lòng chờ một lát trước khi yêu cầu mã mới.",
    "This phone number belongs to more than one patient record. Please contact the reception desk.":
        "Số điện thoại này thuộc nhiều hồ sơ bệnh nhân. Vui lòng liên hệ quầy lễ tân.",
    "Too many codes were requested for this phone number or email. Please try again later":
        "Bạn đã yêu cầu quá nhiều mã cho số điện thoại hoặc email này. Vui lòng thử lại sau.",
    "Too many requests. Please wait a moment and try again": "Có quá nhiều yêu cầu. Vui lòng chờ một lát rồi thử lại.",
    "Create account success!": "Tạo tài khoản thành công!",
    [RESET_SESSION_INVALID]: "Phiên khôi phục mật khẩu đã hết hạn. Vui lòng yêu cầu mã mới.",
    "Reset password failed": "Không đặt lại được mật khẩu. Vui lòng thử lại.",
};

const withVietnameseMessage = (body) => {
    if (PHONE_EXISTS_PATTERN.test(body.message)) return { ...body, message: VALIDATION_MESSAGES.PHONE_IN_USE };
    return { ...body, message: AUTH_MESSAGES[body.message] ?? (body.success ? body.message : GENERIC_ERROR) };
};

// The backend answers failures with the same ApiResponse shape, so screens only check result.success.
// Every failure stays on the screen, also 429 and 5xx, which would otherwise leave the form for the error page.
const sendAuthRequest = async (url, body) => {
    try {
        const response = await api.post(url, body, AUTH_REQUEST_CONFIG);
        return response.data;
    } catch (error) {
        // Anything that is not an ApiResponse (e.g. the HTML 404 page when VITE_API_URL is missing) gets a generic message.
        const data = error.response?.data;
        return typeof data?.success === "boolean" ? data : null;
    }
};

const toResult = (body) => (body ? withVietnameseMessage(body) : failure(GENERIC_ERROR));

const postApi = async (url, body) => toResult(await sendAuthRequest(url, body));

// The backend expects "Male"/"Female" and "Sms"/"Email".
const GENDER_VALUES = { male: "Male", female: "Female" };
const BACKEND_VERIFICATION_METHOD = { [VERIFICATION_METHOD.SMS]: "Sms", [VERIFICATION_METHOD.EMAIL]: "Email" };

// Returns data: { sessionId, verificationMethod, maskedDestination, expiresAt, resendAvailableAt }.
export const register = async ({ fullname, birthdate, gender, phone, email, password, confirmPassword, method }) =>
    postApi("/api/Auth/register", {
        fullName: fullname.trim(),
        dateOfBirth: birthdate,
        gender: GENDER_VALUES[gender],
        phoneNumber: phone,
        email: email.trim() || null,
        password,
        confirmPassword,
        verificationMethod: BACKEND_VERIFICATION_METHOD[method],
    });

export const verifyRegisterOtp = async ({ sessionId, code }) =>
    postApi("/api/Auth/verify-otp", { sessionId, otp: code });

export const resendRegisterOtp = async ({ sessionId }) => postApi("/api/Auth/resend-otp", { sessionId });

const RESET_ERROR_MESSAGES = new Map([
    ["Passwords must have at least one digit ('0'-'9').", VALIDATION_MESSAGES.PASSWORD_DIGIT],
    ["Passwords must have at least one lowercase ('a'-'z').", VALIDATION_MESSAGES.PASSWORD_LOWERCASE],
]);

const RESET_CODE_USED = "This code has already been used. Continue with the new password";

export const requestPasswordReset = async ({ identifier }) => postApi("/api/Auth/forgot-password", { identifier });

export const verifyResetOtp = async ({ sessionId, code }) => {
    const body = await sendAuthRequest("/api/Auth/verify-reset-otp", { sessionId, otp: code });
    return body?.message === RESET_CODE_USED ? success(null) : toResult(body);
};

export const resetPassword = async ({ sessionId, password, confirmPassword }) => {
    const body = await sendAuthRequest("/api/Auth/reset-password", { sessionId, newPassword: password, confirmPassword });
    const known = (body?.errors ?? []).map((error) => RESET_ERROR_MESSAGES.get(error)).find(Boolean);
    if (known) return failure(known);
    const result = toResult(body);
    return body?.message === RESET_SESSION_INVALID ? { ...result, data: { sessionExpired: true } } : result;
};

const INCORRECT_PASSWORD = "Incorrect password.";
const SAME_PASSWORD = "New password cannot be the same as current password";
const CONFIRM_MISMATCH = "New password and confirmation password do not match";

const changePasswordError = (body) => {
    const errors = body?.errors ?? [];
    if (errors.includes(INCORRECT_PASSWORD)) return { field: "currentPassword", message: CHANGE_PASSWORD_TEXT.INCORRECT_CURRENT };
    if (body?.message === SAME_PASSWORD) return { field: "newPassword", message: MESSAGES.MSG25 };
    const rule = errors.map((error) => RESET_ERROR_MESSAGES.get(error)).find(Boolean);
    if (rule) return { field: "newPassword", message: rule };
    if (body?.message === CONFIRM_MISMATCH) return { field: "confirmPassword", message: CHANGE_PASSWORD_TEXT.CONFIRM_MISMATCH };
    return { field: null, message: CHANGE_PASSWORD_TEXT.FAILED };
};

export const changePassword = async ({ currentPassword, newPassword, confirmPassword }) => {
    const refreshToken = getSessionRefreshToken();
    try {
        await api.post(
            "/api/Auth/change-password",
            { currentPassword, newPassword, confirmPassword, refreshToken },
            { skipErrorPage: true },
        );
        return success({ sessionReplaced: getSessionRefreshToken() !== refreshToken });
    } catch (error) {
        const { field, message } = changePasswordError(error.response?.data);
        return { ...failure(message), data: { field } };
    }
};

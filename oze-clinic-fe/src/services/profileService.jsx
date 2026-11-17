import api from "./api";
import { getMockCurrentUser, updateMockUser } from "../utils/data/mockData";
import { BACKEND_ROLE_NAMES, CHANGE_PASSWORD_TEXT, PROFILE_MESSAGES, VALIDATION_MESSAGES } from "../utils/messages";
import { invalidMessage } from "../utils/validation";
<<<<<<< HEAD
import api from "./api";
import { call } from "./receptionService";
import { getSessionRole, updateSessionUserName } from "./sessionStore";

// The profile is read from GET /api/Me; PUT /api/Me and its OTP endpoints are still mocked here (SCRUM-105).
// TODO(be): code, status, emergencyContact, health, certificates and identity requests are not in /api/Me yet.
=======
import { getSessionRole, updateSessionUserName } from "./sessionStore";

const PROFILE_REQUEST_CONFIG = { skipErrorPage: true };
>>>>>>> main

const MOCK_DELAY_MS = 500;

export const PROFILE_FEATURES = {
    identityRequest: false,
    emergencyContact: false,
    healthInfo: false,
    certificates: false,
    summaryDetails: false,
};

const EMPTY_HEALTH = { medicalHistory: "", allergies: [], medications: "", specialConditions: "" };

const GENDER_FROM_BACKEND = { Male: "male", Female: "female" };
const GENDER_TO_BACKEND = { male: "Male", female: "Female" };

const PHONE_EXISTS_PATTERN = /^Patient with phone number .+ already exists/;

const ERRORS = new Map([
    ["Email already exists in the system.", { field: "email", message: VALIDATION_MESSAGES.EMAIL_IN_USE }],
    ["Email is invalid. Please check again.", { field: "email", message: VALIDATION_MESSAGES.EMAIL_INVALID }],
    ["Address is invalid. Please check again.", { field: "address", message: VALIDATION_MESSAGES.ADDRESS_TOO_LONG }],
    ["Phone number is invalid. Please check again.", { field: "phone", message: VALIDATION_MESSAGES.PHONE_INVALID }],
    ["Incorrect password.", { field: "currentPassword", message: CHANGE_PASSWORD_TEXT.INCORRECT_CURRENT }],
    ["Your account is not linked to a patient record. Please contact the reception desk.", { message: PROFILE_MESSAGES.NOT_LINKED }],
    ["OTP is invalid. Please check again.", { message: invalidMessage("Mã xác minh") }],
    ["OTP has expired. Please update your profile again.", { message: PROFILE_MESSAGES.OTP_EXPIRED }],
    ["Your profile was changed after this code was sent. Please make the change again", { message: PROFILE_MESSAGES.CHANGED_MEANWHILE }],
    ["Please wait before requesting another OTP.", { message: "Vui lòng chờ một lát trước khi yêu cầu mã mới." }],
    ["Could not send the OTP. Please try again later.", { message: "Không thể gửi mã xác minh. Vui lòng thử lại sau." }],
    [
        "Too many codes were requested for this phone number or email. Please try again later",
        { message: "Bạn đã yêu cầu quá nhiều mã cho số điện thoại hoặc email này. Vui lòng thử lại sau." },
    ],
    ["Please enter gender.", { message: PROFILE_MESSAGES.MISSING_IDENTITY }],
    ["Please enter date of birth.", { message: PROFILE_MESSAGES.MISSING_IDENTITY }],
]);

const success = (data, message = null) => ({ success: true, message, data, errors: null });

const failure = ({ field, message }) => ({ success: false, message, data: null, errors: field ? { [field]: message } : null });

const toFailure = (error) => {
    const body = error.response?.data;
    const message = body?.message ?? "";
    if (PHONE_EXISTS_PATTERN.test(message)) return failure({ field: "phone", message: VALIDATION_MESSAGES.PHONE_IN_USE });
    const known = ERRORS.get(message) ?? (body?.errors ?? []).map((item) => ERRORS.get(item)).find(Boolean);
    return failure(known ?? { message: PROFILE_MESSAGES.UPDATE_FAILED });
};

const roleFromBackend = (roles) => {
    const keys = (roles ?? []).map((name) => Object.keys(BACKEND_ROLE_NAMES).find((key) => BACKEND_ROLE_NAMES[key] === name)).filter(Boolean);
    return keys.find((key) => key === getSessionRole()) ?? keys[0] ?? "";
};

const toProfile = (data) => ({
    fullname: data.fullName ?? "",
    birthdate: data.dateOfBirth ?? "",
    gender: GENDER_FROM_BACKEND[data.gender] ?? "",
    phone: (data.phoneNumber ?? "").replace(/^\+84/, "0"),
    email: data.email ?? "",
    address: data.address ?? "",
    emailConfirmed: data.emailConfirmed,
    role: roleFromBackend(data.roles),
    code: data.patientCode ?? "",
    createdAt: data.createdAt ?? "",
    lastVisitAt: data.lastVisitAt ?? "",
    emergencyContact: null,
    health: EMPTY_HEALTH,
    certificates: [],
    pendingIdentityRequest: null,
});

const toUpdateRequest = (profile, changes) => ({
    fullName: profile.fullname,
    dateOfBirth: profile.birthdate || null,
    gender: GENDER_TO_BACKEND[profile.gender] ?? null,
    phoneNumber: profile.phone,
    email: profile.email || null,
    address: profile.address || null,
    ...changes,
});

const toOtpSession = (session) => ({
    otpRequired: true,
    sessionId: session.sessionId,
    maskedDestination: session.maskedDestination,
});

export const getMyProfile = async () => {
    try {
        const response = await api.get("/api/me");
        return success(toProfile(response.data.data));
    } catch {
        return failure({ message: PROFILE_MESSAGES.LOAD_FAILED });
    }
};

const putProfile = async (body) => {
    try {
        const response = await api.put("/api/me", body, PROFILE_REQUEST_CONFIG);
        const data = response.data.data;
        if (data?.otpRequired) return success(toOtpSession(data.otpSession));
        return success(toProfile(data.profile));
    } catch (error) {
        return toFailure(error);
    }
};

export const updateContactInfo = async ({ email, address }, profile) => {
    const result = await putProfile(toUpdateRequest(profile, { email: email || null, address: address || null }));
    if (!result.success) return result;
    const emailChanged = email !== "" && email.toLowerCase() !== profile.email.toLowerCase();
    return { ...result, message: emailChanged ? PROFILE_MESSAGES.EMAIL_LINK_SENT : PROFILE_MESSAGES.UPDATE_SUCCESS };
};

export const requestPhoneChange = ({ phone, currentPassword }, profile) =>
    putProfile(toUpdateRequest(profile, { phoneNumber: phone, currentPassword }));

export const verifyProfileOtp = async ({ sessionId, code }) => {
    try {
        const response = await api.post("/api/me/verify-phone-otp", { sessionId, otp: code }, PROFILE_REQUEST_CONFIG);
        const profile = toProfile(response.data.data);
        updateSessionUserName(profile.fullname);
        return success(profile, PROFILE_MESSAGES.UPDATE_SUCCESS);
    } catch (error) {
        return toFailure(error);
    }
};

export const resendProfileOtp = async ({ sessionId }) => {
    try {
        const response = await api.post("/api/me/resend-phone-otp", { sessionId }, PROFILE_REQUEST_CONFIG);
        return success({ maskedDestination: response.data.data?.maskedDestination });
    } catch (error) {
        return toFailure(error);
    }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const today = () => new Date().toLocaleDateString("en-CA");

const mockFailure = (message) => ({ success: false, message, data: null, errors: null });

const withCurrentUser = async (fn) => {
    await wait(MOCK_DELAY_MS);
    const user = getMockCurrentUser();
    return user ? fn(user) : mockFailure(PROFILE_MESSAGES.LOAD_FAILED);
};

<<<<<<< HEAD
const save = (user, changes, message) => success(toProfile(updateMockUser(user.id, changes)), message);

// Changes waiting for the OTP: nothing is saved until the code is verified.
// Kept in memory, so reloading the OTP page drops them and the user starts again from the profile.
let pendingChanges = null;

const startOtp = (user, changes, destination) => {
    pendingChanges = { userId: user.id, values: changes };
    return success({
        otpRequired: true,
        isEmail: destination.includes("@"),
        maskedDestination: maskDestination(destination),
    });
};

export const hasPendingProfileChanges = () => pendingChanges !== null;

// GET api/Me gives name, birth date, gender, phone, email and address. The rest of the page (code, status,
// emergency contact, health, certificates, identity request) still comes from the mock user of the role.
// TODO(api): the changes below are still saved in the mock; the six fields above come back from the backend on reload.
export const getMyProfile = async () => {
    const response = await call(() => api.get("/api/Me"));
    if (!response.success) return response;

    const me = response.data ?? {};
    const mockUser = getMockCurrentUser();
    const base = mockUser ? toProfile(mockUser) : toProfile({ role: getSessionRole() });
    return success({
        ...base,
        fullname: me.fullName ?? "",
        birthdate: me.dateOfBirth ?? "",
        gender: me.gender ? me.gender.toLowerCase() : "",
        phone: me.phoneNumber ?? "",
        email: me.email ?? "",
        address: me.address ?? "",
        role: getSessionRole() ?? base.role,
    });
};

// Email, address and (patients) emergency contact. A new email is confirmed by an OTP sent to it;
// otherwise the changes are saved straight away. Returns data.otpRequired, or the updated profile.
export const updateContactInfo = (values) =>
    withCurrentUser((user) => {
        if (values.email && otherUsers(user).some((u) => u.email && sameEmail(u.email, values.email))) {
            return failure(VALIDATION_MESSAGES.EMAIL_IN_USE, { email: VALIDATION_MESSAGES.EMAIL_IN_USE });
        }

        const emailChanged = values.email && !sameEmail(values.email, user.email ?? "");
        if (emailChanged) return startOtp(user, values, values.email);

        return save(user, values, "Cập nhật thông tin liên hệ thành công!");
    });

// The phone number signs the user in, so it changes only after an SMS OTP sent to the new number.
export const requestPhoneChange = (phone) =>
    withCurrentUser((user) => {
        if (phone === user.phone) return failure("Số điện thoại mới trùng với số hiện tại.", { phone: "Số điện thoại mới trùng với số hiện tại." });
        if (otherUsers(user).some((u) => u.phone === phone)) {
            return failure(VALIDATION_MESSAGES.PHONE_IN_USE, { phone: VALIDATION_MESSAGES.PHONE_IN_USE });
        }
        return startOtp(user, { phone }, phone);
    });

export const resendProfileOtp = async () => {
    await wait(MOCK_DELAY_MS);
    return pendingChanges ? success(null) : failure(EXPIRED_MESSAGE);
};

export const verifyProfileOtp = async ({ code }) => {
    await wait(MOCK_DELAY_MS);
    if (!pendingChanges) return failure(EXPIRED_MESSAGE);
    if (code !== MOCK_OTP_CODE) return failure(invalidMessage("Mã xác minh"));

    const { userId, values } = pendingChanges;
    pendingChanges = null;
    const user = updateMockUser(userId, values);
    updateSessionUserName(user.fullname);
    return success(toProfile(user));
};

export const cancelProfileOtp = () => {
    pendingChanges = null;
=======
const save = (user, changes, message) => {
    updateMockUser(user.id, changes);
    return success(null, message);
>>>>>>> main
};

// Name, birth date and gender are changed by the receptionist after checking the ID card. One request at a time.
export const submitIdentityRequest = ({ field, newValue, reason }) =>
    withCurrentUser((user) => {
        if (user.pendingIdentityRequest) return mockFailure("Bạn đang có một yêu cầu chờ duyệt.");
        const request = { field, oldValue: user[field] ?? "", newValue, reason, createdAt: today() };
        return save(user, { pendingIdentityRequest: request }, "Đã gửi yêu cầu thay đổi. Lễ tân sẽ liên hệ để kiểm tra giấy tờ.");
    });

export const cancelIdentityRequest = () =>
    withCurrentUser((user) => save(user, { pendingIdentityRequest: null }, "Đã huỷ yêu cầu thay đổi."));

export const updateHealthInfo = (health) =>
    withCurrentUser((user) => save(user, { health }, "Đã cập nhật thông tin sức khoẻ."));

// Adds a certificate, or replaces the one with the same id.
export const saveCertificate = (certificate) =>
    withCurrentUser((user) => {
        const certificates = user.certificates ?? [];
        const exists = certificates.some((item) => item.id === certificate.id);
        const next = exists
            ? certificates.map((item) => (item.id === certificate.id ? certificate : item))
            : [...certificates, { ...certificate, id: `cert-${Date.now()}` }];
        return save(user, { certificates: next }, exists ? "Đã cập nhật chứng chỉ." : "Đã thêm chứng chỉ.");
    });

export const deleteCertificate = (id) =>
    withCurrentUser((user) =>
        save(user, { certificates: (user.certificates ?? []).filter((item) => item.id !== id) }, "Đã xoá chứng chỉ."),
    );

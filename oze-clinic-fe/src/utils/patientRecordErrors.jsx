import { PATIENT_RECORD_ERRORS, PATIENT_RECORD_ERROR_PREFIXES, PATIENT_RECORD_GENERIC_ERRORS as GENERIC, PATIENT_RECORD_TEXT as TEXT } from "./messages";

export const BE_MESSAGES = {
    PATIENT_NOT_FOUND: ["Patient not found in system", "Patient not found"],
    PHONE_EXISTS: "Phone number already exists in system",
    GENDER: "Gender must be one of: Male, Female, Other",
    BLOOD_TYPE: "Blood type must be one of:",
    DOB_FUTURE: "Date of birth cannot be in the future",
    PHONE_INVALID: "Phone number is invalid. Please check again.",
    EMAIL_INVALID: "Email is invalid. Please check again.",
    FULL_NAME: ["Please enter full name.", "FullName is required.", "FullName is required"],
    PROFILE_GONE: "No patient profile is linked to this account",
    UNFINISHED: "You already have an appointment that is not finished.",
    PLAN_NOT_FOUND: "Treatment plan not found.",
    PLAN_NOT_PROPOSED: "Only a proposed treatment plan can be approved.",
    CONCURRENCY: "This record was changed by someone else.",
};

const messageOf = (result) => (typeof result?.message === "string" ? result.message.trim() : "");

export const hasMessage = (result, expected) => {
    const message = messageOf(result);
    const list = Array.isArray(expected) ? expected : [expected];
    return list.some((m) => message === m || (m.endsWith(".") || m.endsWith(":") ? message.startsWith(m) : false));
};

export const isPatientGone = (result) => result?.status === 404 || hasMessage(result, BE_MESSAGES.PATIENT_NOT_FOUND);

export const isUncertain = (result, { conflictToo = false } = {}) => {
    if (!result || result.success || result.aborted) return false;
    if (result.status === 401) return false;
    if (result.noResponse) return true;
    if (Number(result.status) >= 500) return true;
    return conflictToo && result.status === 409;
};

export const errorText = (result, where) => {
    const message = messageOf(result);
    if (message && PATIENT_RECORD_ERRORS[message]) return PATIENT_RECORD_ERRORS[message];
    const prefix = PATIENT_RECORD_ERROR_PREFIXES.find(([p]) => message.startsWith(p));
    if (prefix) return prefix[1];
    if (result?.status === 403) return where === "plan" ? GENERIC.FORBIDDEN_PLAN : GENERIC.FORBIDDEN;
    if (result?.noResponse) return GENERIC.NO_RESPONSE;
    if (result?.fieldErrors) return TEXT.ERR_FORM_INVALID;
    return GENERIC.OTHER;
};

const FIELD_BY_MESSAGE = [
    [BE_MESSAGES.PHONE_EXISTS, "phoneNumber"],
    [BE_MESSAGES.GENDER, "gender"],
    [BE_MESSAGES.BLOOD_TYPE, "bloodType"],
    [BE_MESSAGES.DOB_FUTURE, "dateOfBirth"],
    [BE_MESSAGES.PHONE_INVALID, "phoneNumber"],
    [BE_MESSAGES.EMAIL_INVALID, "email"],
    [BE_MESSAGES.FULL_NAME, "fullName"],
];

export const fieldOfMessage = (result) => FIELD_BY_MESSAGE.find(([m]) => hasMessage(result, m))?.[1] ?? null;

const FIELD_KEYS = {
    fullname: "fullName",
    dateofbirth: "dateOfBirth",
    gender: "gender",
    phonenumber: "phoneNumber",
    email: "email",
    address: "address",
    emergencycontactphone: "emergencyContactPhone",
    bloodtype: "bloodType",
};

const fieldMessage = (field, texts) => {
    const joined = texts.join(" ").toLowerCase();
    if (joined.includes("maximum length") || joined.includes("cannot exceed")) return TEXT.ERR_TOO_LONG;
    if (field === "email") return TEXT.ERR_EMAIL;
    if (field === "phoneNumber") return TEXT.ERR_PHONE_INVALID;
    return TEXT.ERR_FIELD_INVALID;
};

export const fieldErrorsOf = (result) => {
    const source = result?.fieldErrors;
    if (!source) return { fields: {}, other: false };
    const fields = {};
    let other = false;
    Object.entries(source).forEach(([rawKey, value]) => {
        const field = FIELD_KEYS[rawKey.replace(/^\$\./, "").toLowerCase()];
        const texts = (Array.isArray(value) ? value : [value]).map(String);
        if (!field) other = true;
        else fields[field] ??= fieldMessage(field, texts);
    });
    return { fields, other };
};

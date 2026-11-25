import { HISTORY_ALLERGY_OPTIONS, HISTORY_CONDITION_OPTIONS, HISTORY_DENTAL_OPTIONS, HISTORY_FEMALE_CONDITION_OPTIONS, PATIENT_RECORD_TEXT as TEXT } from "./messages";
import { dmy } from "@/components/reception/receptionUtils";
import { genderOf, historyKey, isCompactPhone, isValidBloodType, isValidPhone, phoneDisplay, subscriberDigits } from "./patientRecord";

export const ADMIN_FIELDS = ["fullName", "dateOfBirth", "gender", "phoneNumber", "email", "address", "emergencyContactName", "emergencyContactPhone", "bloodType"];

export const FORM_LIMITS = { fullName: 200, emergencyContactName: 100, emergencyContactPhone: 20, email: 100, address: 500, historyTitle: 200 };

export const HISTORY_TYPES = ["Allergy", "Condition", "History"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMERGENCY_PATTERN = /^[\d\s.+-]+$/;

export const emptyHistory = () => ({ Allergy: [], Condition: [], History: [] });

export const emptyForm = () => ({
    fullName: "",
    dateOfBirth: "",
    gender: "",
    phoneNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    email: "",
    address: "",
    bloodType: "",
});

export const formFromPatient = (patient) => ({
    fullName: patient.fullName ?? "",
    dateOfBirth: patient.dateOfBirth ? String(patient.dateOfBirth).slice(0, 10) : "",
    gender: genderOf(patient.gender).code ?? "",
    phoneNumber: patient.phoneNumber ? phoneDisplay(patient.phoneNumber) : "",
    emergencyContactName: patient.emergencyContactName ?? "",
    emergencyContactPhone: patient.emergencyContactPhone && isValidPhone(patient.emergencyContactPhone) ? phoneDisplay(patient.emergencyContactPhone) : (patient.emergencyContactPhone ?? ""),
    email: patient.email ?? "",
    address: patient.address ?? "",
    bloodType: "",
});

const hasValue = (value) => value != null && String(value).trim() !== "";

export const needsPhoneFix = (patient) =>
    Boolean(patient && hasValue(patient.phoneNumber) && !patient.userId && !isCompactPhone(patient.phoneNumber) && isValidPhone(patient.phoneNumber));

export const adminLockOf = (patient, dupCheck) => {
    if (!patient || !hasValue(patient.phoneNumber) || isCompactPhone(patient.phoneNumber)) return null;
    if (patient.userId) return { reason: "account" };
    if (!isValidPhone(patient.phoneNumber)) return null;
    if (!dupCheck || dupCheck.status === "loading") return { reason: "checking" };
    if (dupCheck.status === "error") return { reason: "unknown" };
    if (dupCheck.match) return { reason: "duplicate", match: dupCheck.match };
    return null;
};

export const adminChanged = (values, baseline) => ADMIN_FIELDS.some((k) => String(values[k] ?? "").trim() !== String(baseline[k] ?? "").trim());

export const validateForm = ({ values, edited, patient, mode, today }) => {
    const errors = {};
    const editing = mode === "edit";
    const touched = (k) => !editing || edited.has(k);
    const had = (k) => editing && hasValue(patient?.[k]);
    const gender = editing ? genderOf(patient?.gender) : null;
    if (!values.fullName.trim()) errors.fullName = TEXT.ERR_FULL_NAME;
    if (!values.dateOfBirth) {
        if (!editing) errors.dateOfBirth = TEXT.ERR_DOB;
        else if (had("dateOfBirth")) errors.dateOfBirth = TEXT.ERR_CANNOT_CLEAR;
    } else if (values.dateOfBirth > today) errors.dateOfBirth = TEXT.ERR_DOB_FUTURE;
    if (!values.gender) {
        if (!editing || gender.unknown) errors.gender = TEXT.ERR_GENDER;
        else if (had("gender")) errors.gender = TEXT.ERR_CANNOT_CLEAR;
    }
    if (!patient?.userId) {
        if (!values.phoneNumber.trim()) {
            if (!editing) errors.phoneNumber = TEXT.ERR_PHONE;
            else if (had("phoneNumber")) errors.phoneNumber = TEXT.ERR_CANNOT_CLEAR;
        } else if (touched("phoneNumber") && !isValidPhone(values.phoneNumber)) errors.phoneNumber = TEXT.ERR_PHONE_INVALID;
        if (!values.email.trim()) {
            if (had("email")) errors.email = TEXT.ERR_CANNOT_CLEAR;
        } else if (touched("email") && !EMAIL_PATTERN.test(values.email.trim())) errors.email = TEXT.ERR_EMAIL;
    }
    if (touched("emergencyContactPhone") && values.emergencyContactPhone.trim() && !EMERGENCY_PATTERN.test(values.emergencyContactPhone.trim())) {
        errors.emergencyContactPhone = TEXT.ERR_EMERGENCY_PHONE;
    }
    if (editing && patient && !isValidBloodType(patient.bloodType) && !values.bloodType) errors.bloodType = TEXT.ERR_BLOOD_TYPE;
    return errors;
};

export const firstErrorField = (errors) => ADMIN_FIELDS.find((k) => errors[k]) ?? null;

export const showBloodType = (patient) => Boolean(patient) && !isValidBloodType(patient.bloodType);

export const BLOOD_UNKNOWN = "none";

const cleanBloodType = (value) => (hasValue(value) ? String(value).trim().toUpperCase() : null);

const emergencyToSend = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    return isValidPhone(trimmed) ? `0${subscriberDigits(trimmed)}` : trimmed;
};

export const createBody = (values) => {
    const phone = subscriberDigits(values.phoneNumber);
    return {
        fullName: values.fullName.trim(),
        dateOfBirth: values.dateOfBirth || null,
        gender: values.gender || null,
        phoneNumber: phone ? `0${phone}` : null,
        email: values.email.trim() || null,
        emergencyContactName: values.emergencyContactName.trim() || null,
        emergencyContactPhone: emergencyToSend(values.emergencyContactPhone),
        address: values.address.trim() || null,
    };
};

export const phoneToSend = ({ values, edited, original, latest }) => {
    const typed = subscriberDigits(values.phoneNumber);
    if (!latest.userId && edited.has("phoneNumber") && typed && typed !== subscriberDigits(original.phoneNumber)) return `0${typed}`;
    if (isCompactPhone(latest.phoneNumber)) return latest.phoneNumber;
    if (needsPhoneFix(latest)) return `0${subscriberDigits(latest.phoneNumber)}`;
    return null;
};

export const updateBody = ({ values, edited, original, latest }) => {
    const email = values.email.trim();
    const bloodType = isValidBloodType(original.bloodType)
        ? cleanBloodType(latest.bloodType)
        : values.bloodType === BLOOD_UNKNOWN
          ? null
          : values.bloodType || null;
    return {
        fullName: values.fullName.trim(),
        dateOfBirth: values.dateOfBirth || null,
        gender: values.gender || null,
        phoneNumber: phoneToSend({ values, edited, original, latest }),
        email: !latest.userId && edited.has("email") && email && email !== (original.email ?? "") ? email : null,
        emergencyContactPhone: edited.has("emergencyContactPhone") ? emergencyToSend(values.emergencyContactPhone) : (latest.emergencyContactPhone ?? null),
        address: values.address.trim() || null,
        insuranceNumber: latest.insuranceNumber ?? null,
        bloodType,
        emergencyContactName: edited.has("emergencyContactName") ? values.emergencyContactName.trim() || null : (latest.emergencyContactName ?? null),
        notes: latest.notes ?? null,
    };
};

const same = (a, b) => String(a ?? "").trim() === String(b ?? "").trim();

export const bodyMatches = (body, fresh) => {
    if (!fresh) return false;
    if (!same(body.fullName, fresh.fullName)) return false;
    if (!same(body.dateOfBirth, fresh.dateOfBirth ? String(fresh.dateOfBirth).slice(0, 10) : null)) return false;
    if (genderOf(body.gender).code !== genderOf(fresh.gender).code) return false;
    if (!same(body.address, fresh.address)) return false;
    if (!same(body.emergencyContactPhone, fresh.emergencyContactPhone)) return false;
    if (!same(body.emergencyContactName, fresh.emergencyContactName)) return false;
    if (body.phoneNumber != null && subscriberDigits(body.phoneNumber) !== subscriberDigits(fresh.phoneNumber)) return false;
    if (body.email != null && !same(body.email.toLowerCase(), String(fresh.email ?? "").toLowerCase())) return false;
    if (!same(cleanBloodType(body.bloodType), cleanBloodType(fresh.bloodType))) return false;
    return true;
};

const profileIds = (patient) => (patient?.medicalProfiles ?? []).map((m) => Number(m.id)).sort((a, b) => a - b);

export const stampOf = (patient) => ({
    updatedAt: patient?.updatedAt ?? null,
    userId: patient?.userId ?? null,
    ids: profileIds(patient),
    profiles: patient?.medicalProfiles ?? [],
});

export const addToStamp = (stamp, profile) => ({
    ...stamp,
    ids: [...stamp.ids, Number(profile.id)].sort((a, b) => a - b),
    profiles: [...stamp.profiles, profile],
});

export const sameStamp = (stamp, fresh, ownIds = new Set()) => {
    const next = stampOf(fresh);
    if (String(stamp.userId ?? "") !== String(next.userId ?? "")) return false;
    if (String(stamp.updatedAt ?? "") !== String(next.updatedAt ?? "")) return false;
    const strip = (ids) => ids.filter((id) => !ownIds.has(id)).join(",");
    return strip(stamp.ids) === strip(next.ids);
};

export const accountChanged = (stamp, fresh) => String(stamp.userId ?? "") !== String(fresh?.userId ?? "");

const groupOptions = (recordType, gender) => {
    if (recordType === "Allergy") return HISTORY_ALLERGY_OPTIONS;
    if (recordType === "History") return HISTORY_DENTAL_OPTIONS;
    return gender === "Female" ? [...HISTORY_CONDITION_OPTIONS, ...HISTORY_FEMALE_CONDITION_OPTIONS] : HISTORY_CONDITION_OPTIONS;
};

export const FEMALE_ONLY_KEYS = new Set(HISTORY_FEMALE_CONDITION_OPTIONS.map((t) => historyKey("Condition", t)));

const displayTitle = (options, recordType, title) => options.find((o) => historyKey(recordType, o) === historyKey(recordType, title)) ?? String(title).trim();

export const historyGroups = (gender, profiles = []) =>
    HISTORY_TYPES.map((recordType) => {
        const base = groupOptions(recordType, gender);
        const saved = profiles.filter((m) => String(m.recordType).toLowerCase() === recordType.toLowerCase() && hasValue(m.title));
        const active = saved.filter((m) => m.status === "Active");
        const allChoices = groupOptions(recordType, "Female");
        const locked = [];
        active.forEach((m) => {
            const title = displayTitle(allChoices, recordType, m.title);
            if (!locked.includes(title)) locked.push(title);
        });
        const activeKeys = new Set(locked.map((t) => historyKey(recordType, t)));
        const notes = {};
        const inactiveTitles = [];
        saved
            .filter((m) => m.status !== "Active")
            .forEach((m) => {
                const title = displayTitle(allChoices, recordType, m.title);
                if (activeKeys.has(historyKey(recordType, title)) || notes[title]) return;
                notes[title] = TEXT.HISTORY_PAST_NOTE(TEXT.HISTORY_STATUS[m.status] ?? m.status, dmy(String(m.createdAt ?? "").slice(0, 10)));
                inactiveTitles.push(title);
            });
        const options = [...base];
        [...locked, ...inactiveTitles].forEach((title) => {
            if (!options.some((o) => historyKey(recordType, o) === historyKey(recordType, title))) options.push(title);
        });
        return { recordType, title: TEXT.HISTORY_GROUPS[recordType], options, locked, notes };
    });

export const wantedHistory = (ticked) => {
    const seen = new Set();
    const out = [];
    HISTORY_TYPES.forEach((recordType) =>
        (ticked[recordType] ?? []).forEach((title) => {
            const text = String(title).trim();
            const key = historyKey(recordType, text);
            if (!text || seen.has(key)) return;
            seen.add(key);
            out.push({ recordType, title: text });
        }),
    );
    return out;
};

export const historyFromItems = (items) => {
    const out = emptyHistory();
    items.forEach((item) => {
        const type = HISTORY_TYPES.find((t) => t.toLowerCase() === String(item.recordType).toLowerCase());
        if (type && !out[type].includes(item.title)) out[type].push(item.title);
    });
    return out;
};

export const dropFemaleOnly = (ticked) => {
    const removed = ticked.Condition.filter((t) => FEMALE_ONLY_KEYS.has(historyKey("Condition", t)));
    if (!removed.length) return { ticked, removed };
    return { ticked: { ...ticked, Condition: ticked.Condition.filter((t) => !removed.includes(t)) }, removed };
};

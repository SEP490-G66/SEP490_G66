import { STATUS_LABEL, ddmm, hhmm } from "@/components/reception/receptionUtils";
import { normalizeText } from "./format";
import { PATIENT_RECORD_TEXT as TEXT } from "./messages";
import { RECEPTION_PATIENT_QUERY as Q, RECEPTION_PATIENT_TABS } from "./routes";

const CLINIC_TIME_ZONE = "Asia/Ho_Chi_Minh";

export const UNFINISHED_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"];

export const OPEN_INVOICE_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PENDING_CONFIRMATION"];

export const LABEL_PAGE_SIZE = 100;

const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export const ageOf = (dob, today) => {
    if (!dob || !today) return null;
    const [y, m, d] = String(dob).slice(0, 10).split("-").map(Number);
    const [ty, tm, td] = String(today).split("-").map(Number);
    if (![y, m, d, ty, tm, td].every(Number.isFinite)) return null;
    const [bm, bd] = m === 2 && d === 29 && !isLeapYear(ty) ? [3, 1] : [m, d];
    const age = ty - y - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
    return age < 0 ? null : age;
};

export const subscriberDigits = (text) => {
    if (text == null) return null;
    const trimmed = String(text).trim();
    if (!/^[\d\s.\-+]+$/.test(trimmed)) return null;
    const compact = trimmed.replace(/[\s.-]/g, "");
    if (!/^\+?\d+$/.test(compact)) return null;
    const digits = compact.replace(/^\+/, "");
    if (digits.length < 9 || digits.length > 12) return null;
    let rest;
    if (digits.startsWith("84")) rest = digits.slice(2);
    else if (digits.startsWith("0")) rest = digits.slice(1);
    else return null;
    return /^\d{9}$/.test(rest) ? rest : null;
};

export const searchKeywordOf = (q) => {
    const text = String(q ?? "");
    const subscriber = subscriberDigits(text);
    if (subscriber) return subscriber;
    const trimmed = text.trim();
    const digits = trimmed.replace(/[\s.-]/g, "");
    const phoneLike = /^[\d\s.\-+]+$/.test(trimmed);
    let rest = null;
    if (/^\+84\d+$/.test(digits)) rest = digits.slice(3).replace(/^0/, "");
    else if (/^840\d{9}$/.test(digits)) rest = digits.slice(3);
    else if (/^0\d+$/.test(digits)) rest = digits.slice(1);
    if (rest !== null && /^\d{3,}$/.test(rest)) return rest;
    return phoneLike ? digits : trimmed;
};

export const isValidPhone = (text) => /^[35789]\d{8}$/.test(subscriberDigits(text) ?? "");

export const isCompactPhone = (stored) => /^(\+84|84|0)[35789]\d{8}$/.test(stored == null ? "" : String(stored));

export const phoneVariants = (subscriber) => (subscriber ? [`+84${subscriber}`, `84${subscriber}`, `0${subscriber}`] : []);

export const phoneDisplay = (stored) => {
    const subscriber = subscriberDigits(stored);
    if (!subscriber) return stored ?? "";
    return `0${subscriber}`.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
};

export const clinicDateOf = (value) => {
    if (!value) return null;
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
};

export const clinicTimeOf = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
};

const GENDER_CODES = { male: "Male", nam: "Male", female: "Female", "nữ": "Female", other: "Other", "khác": "Other" };

export const GENDER_OPTIONS = ["Male", "Female", "Other"];

export const genderOf = (value) => {
    if (value == null || String(value).trim() === "") return { code: null, label: TEXT.DASH, legacy: false, unknown: false };
    const code = GENDER_CODES[String(value).normalize("NFC").trim().toLocaleLowerCase("vi")];
    if (!code) return { code: null, label: TEXT.DASH, legacy: false, unknown: true };
    return { code, label: TEXT.GENDER_LABELS[code], legacy: code !== String(value).trim(), unknown: false };
};

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const isValidBloodType = (value) => value == null || String(value).trim() === "" || BLOOD_TYPES.includes(String(value).trim().toUpperCase());

export const historyKey = (recordType, title) => `${String(recordType ?? "").toLowerCase()}|${normalizeText(title).replace(/\s+/g, " ")}`;

export const missingHistory = (wanted, saved = []) => {
    const have = new Set(saved.filter((m) => m.status === "Active").map((m) => historyKey(m.recordType, m.title)));
    const seen = new Set();
    return wanted.filter((item) => {
        const title = String(item.title ?? "").trim();
        if (!title) return false;
        const key = historyKey(item.recordType, title);
        if (have.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).map((item) => ({ recordType: item.recordType, title: String(item.title).trim() }));
};

const PLAN_KEYS = ["status", "planName", "description", "estimatedTotalCost", "planVersion", "stages"];
const STAGE_KEYS = ["id", "stageNumber", "stageName", "description", "serviceId", "serviceName", "estimatedCost", "stageStatus", "scheduledDate", "notes"];

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const stable = (value) => {
    if (value === undefined) return "null";
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
};

export const sortedStages = (stages) =>
    [...(stages ?? [])].sort((a, b) => (Number(a.stageNumber) - Number(b.stageNumber)) || (Number(a.id) - Number(b.id)));

export const planFingerprint = (plan) => {
    if (!isObject(plan) || !PLAN_KEYS.every((k) => k in plan) || !Array.isArray(plan.stages)) return null;
    if (!plan.stages.every((s) => isObject(s) && STAGE_KEYS.every((k) => k in s))) return null;
    return stable({ ...plan, stages: sortedStages(plan.stages) });
};

const MAX_INT = 2147483647;

export const readPatientId = (raw) => {
    const text = String(raw ?? "");
    if (!/^\d{1,10}$/.test(text)) return null;
    const id = Number(text);
    if (id < 1 || id > MAX_INT) return null;
    return { id, fixed: text !== String(id) };
};

export const idKey = (id) => String(Number(id));

export const LIST_SORTS = {
    created: { sortBy: "createdat", sortDescending: true },
    name: { sortBy: "name", sortDescending: false },
    code: { sortBy: "code", sortDescending: false },
    dob: { sortBy: "dob", sortDescending: false },
};

export const DEFAULT_SORT = "created";

export const SEARCH_MAX_LENGTH = 100;

export const MAX_PAGE = 10000;

export const cleanSearch = (q) => {
    const text = String(q ?? "").slice(0, SEARCH_MAX_LENGTH);
    return text.trim() ? text : "";
};

export const readListUrl = (search) => {
    const params = new URLSearchParams(search);
    let fixed = false;
    const rawQ = params.get(Q.SEARCH);
    const q = cleanSearch(rawQ);
    if (rawQ !== null && rawQ !== q) fixed = true;
    const rawGender = params.get(Q.GENDER);
    const gender = GENDER_OPTIONS.includes(rawGender) ? rawGender : "";
    if (rawGender !== null && !gender) fixed = true;
    const rawSort = params.get(Q.SORT);
    const sort = rawSort && rawSort !== DEFAULT_SORT && LIST_SORTS[rawSort] ? rawSort : DEFAULT_SORT;
    if (rawSort !== null && sort !== rawSort) fixed = true;
    if (rawSort === DEFAULT_SORT) fixed = true;
    const rawPage = params.get(Q.PAGE);
    const pageOk = rawPage !== null && /^[1-9]\d*$/.test(rawPage) && Number(rawPage) <= MAX_PAGE;
    const page = pageOk ? Number(rawPage) : 1;
    if (rawPage !== null && !pageOk) fixed = true;
    return { query: { q, gender, sort, page }, fixed };
};

export const listSearch = ({ q = "", gender = "", sort = DEFAULT_SORT, page = 1 } = {}) => {
    const params = new URLSearchParams();
    const text = cleanSearch(q);
    if (text) params.set(Q.SEARCH, text);
    if (gender) params.set(Q.GENDER, gender);
    if (sort && sort !== DEFAULT_SORT) params.set(Q.SORT, sort);
    if (page > 1) params.set(Q.PAGE, String(page));
    const out = params.toString();
    return out ? `?${out}` : "";
};

export const safeListSearch = (value) => (typeof value === "string" && value.startsWith("?") ? value : "");

const DETAIL_TABS = [RECEPTION_PATIENT_TABS.APPOINTMENTS, RECEPTION_PATIENT_TABS.PLANS, RECEPTION_PATIENT_TABS.INVOICES];

export const readTab = (search) => {
    const raw = new URLSearchParams(search).get(Q.TAB);
    if (raw === null) return { tab: RECEPTION_PATIENT_TABS.INFO, fixed: false };
    if (DETAIL_TABS.includes(raw)) return { tab: raw, fixed: false };
    return { tab: RECEPTION_PATIENT_TABS.INFO, fixed: true };
};

export const PLAN_STATUS = {
    Proposed: [TEXT.PLAN_STATUS.Proposed, "badge-warning"],
    Approved: [TEXT.PLAN_STATUS.Approved, "badge-success"],
    InProgress: [TEXT.PLAN_STATUS.InProgress, "badge-info"],
    Completed: [TEXT.PLAN_STATUS.Completed, "badge-success"],
    Cancelled: [TEXT.PLAN_STATUS.Cancelled, "badge-neutral"],
    Superseded: [TEXT.PLAN_STATUS.Superseded, "badge-neutral"],
};

export const invoiceLabels = (pages) => {
    const [unpaid, partial, pending] = pages;
    const items = (page) => page?.items ?? [];
    const overflow = pages.some((page) => Number(page?.totalCount ?? 0) > items(page).length);
    const pendingCount = Math.max(Number(pending?.totalCount ?? 0), items(pending).length);
    const debt = [...items(unpaid), ...items(partial)].reduce((sum, i) => sum + Number(i.remainingAmount ?? 0), 0);
    return { debt, pendingCount, incomplete: overflow || pendingCount > 0 };
};

const byDateTime = (a, b) => `${a.appointmentDate}${a.timeSlotStart ?? ""}`.localeCompare(`${b.appointmentDate}${b.timeSlotStart ?? ""}`);

export const upcomingAppointment = (items, today, now) =>
    [...(items ?? [])]
        .filter((a) => ["PENDING", "CONFIRMED"].includes(a.status) && a.appointmentDate >= today)
        .filter((a) => !(a.appointmentDate === today && a.timeSlotStart && hhmm(a.timeSlotStart) < now))
        .sort(byDateTime)[0] ?? null;

export const blockingAppointment = (items, today) =>
    [...(items ?? [])].filter((a) => UNFINISHED_STATUSES.includes(a.status) && a.appointmentDate >= today).sort(byDateTime)[0] ?? null;

export const isWalkIn = (a) => a.appointmentType === "WALK_IN" || !a.timeSlotStart;

export const walkInToday = (items, day) =>
    (items ?? []).find((a) => isWalkIn(a) && a.appointmentDate === day && UNFINISHED_STATUSES.includes(a.status)) ?? null;

const dayWord = (date, today) => (date === today ? TEXT.TODAY_WORD : ddmm(date));

export const upcomingText = (a, today) =>
    a.appointmentDate === today ? TEXT.LABEL_UPCOMING_TODAY(hhmm(a.timeSlotStart) ?? "") : TEXT.LABEL_UPCOMING(ddmm(a.appointmentDate), hhmm(a.timeSlotStart));

export const checkInTimeText = (a, today) => {
    const time = clinicTimeOf(a.checkInAt);
    if (!time) return null;
    const date = clinicDateOf(a.checkInAt);
    return date === today ? time : `${time} ${ddmm(date)}`;
};

export const blockedText = (a, today) => {
    let when;
    if (!isWalkIn(a)) when = `${dayWord(a.appointmentDate, today)} ${hhmm(a.timeSlotStart)}`;
    else {
        const time = checkInTimeText(a, today);
        when = time ? TEXT.BLOCKED_WALK_IN_AT(time) : TEXT.BLOCKED_WALK_IN_ON(dayWord(a.appointmentDate, today));
    }
    return TEXT.BLOCKED_WHAT(when, STATUS_LABEL[a.status]?.[0] ?? a.status);
};

const SHIFT_RANK = { Working: 0, NotStarted: 1 };

const shiftEndOf = (shift) => {
    const end = hhmm(shift.shiftEnd) ?? "";
    const start = hhmm(shift.shiftStart) ?? "";
    return end && start && end <= start ? "24:00" : end;
};

export const onDutyDoctors = (shifts, now) => {
    const map = new Map();
    (shifts ?? [])
        .filter((s) => (s.status === "Working" || s.status === "NotStarted") && shiftEndOf(s) > now)
        .forEach((s) => {
            const rank = SHIFT_RANK[s.status];
            const known = map.get(s.doctorId);
            if (known && (known.rank < rank || (known.rank === rank && hhmm(s.shiftStart) > known.start))) return;
            map.set(s.doctorId, {
                id: s.doctorId,
                name: s.doctorName,
                room: s.roomName,
                status: s.status,
                rank,
                shift: `${hhmm(s.shiftStart)}–${hhmm(s.shiftEnd)}`,
                start: hhmm(s.shiftStart),
                end: hhmm(s.shiftEnd),
            });
        });
    return [...map.values()];
};

const scheduleBlock = (appointments, today, reason) => {
    if (appointments.status === "loading") return { text: TEXT.REASON_CHECKING };
    if (appointments.status === "error") return { text: TEXT.REASON_CHECK_ERROR, retry: "appointments" };
    const blocking = blockingAppointment(appointments.items, today);
    if (blocking) return { text: reason(blockedText(blocking, today)), checkIn: true };
    return null;
};

export const walkInBlock = ({ patient, appointments, doctors, today }) => {
    if (!isValidPhone(patient.phoneNumber)) return { text: patient.userId ? TEXT.REASON_NO_PHONE_ACCOUNT : TEXT.REASON_NO_PHONE };
    if (!isCompactPhone(patient.phoneNumber)) return { text: patient.userId ? TEXT.REASON_BAD_FORMAT_ACCOUNT : TEXT.REASON_BAD_FORMAT };
    const schedule = scheduleBlock(appointments, today, TEXT.REASON_BLOCKED_WALK_IN);
    if (schedule) return schedule;
    if (doctors.status === "loading") return { text: TEXT.REASON_DOCTORS_LOADING };
    if (doctors.status === "error") return { text: TEXT.REASON_DOCTORS_ERROR, retry: "doctors" };
    if (!doctors.items.length) return { text: TEXT.REASON_NO_DOCTORS };
    return null;
};

export const bookingBlock = ({ appointments, today }) => scheduleBlock(appointments, today, TEXT.REASON_BLOCKED_BOOKING);

export const WALK_IN_NAME_MAX = 100;

export const walkInName = (name) => {
    let out = "";
    for (const ch of String(name ?? "").normalize("NFC").trim()) {
        if (out.length + ch.length > WALK_IN_NAME_MAX) break;
        out += ch;
    }
    return out;
};

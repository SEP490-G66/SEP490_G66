import { getCurrentCashSession } from "./cashSessionService";
import { clinicToday } from "./receptionService";
import { getSessionUserName } from "./sessionStore";
import { CASHIER_MOCK_KEY, CASHIER_MOCK_VERSION, buildCashierSeed } from "../utils/data/mockCashier";
import {
    LINE,
    METHODS,
    OPTION,
    RECEIPT_STATUS,
    collectError,
    collectablesOf,
    computePatient,
    matchesSearch,
    receiptStatusOf,
} from "../utils/cashier";
import { CASHIER_TEXT } from "../utils/messages";

// Cashier pages (Thanh toán, Đặt cọc dịch vụ, Thanh toán theo đợt, Ghi nhận thu tiền): the one door the pages use.
// Every function returns { success, message, data, errors } like the API calls of receptionService.
// TEMPORARY: the data lives in localStorage (utils/data/mockCashier) until the backend has these endpoints; only the
// bodies of these functions change when the pages move to the API.

const errors = CASHIER_TEXT.ERRORS;

// "api": writes need an open cash shift on the backend (GET /api/cash-sessions/current).
// "mock": the shift is always open, to try the pages without the backend running.
export const SHIFT_SOURCE = "api";

// Deposit share of the plan price. TEMPORARY until the clinic setting exists on the backend (locked on the plan when chosen).
export const DEPOSIT_RATE = 0.3;

const DELAY_MS = 200;
const wait = () => new Promise((resolve) => setTimeout(resolve, DELAY_MS));
const ok = (data, message = null) => ({ success: true, message, data, errors: null });
const fail = (message) => ({ success: false, message, data: null, errors: null });

const positive = (value) => Number.isInteger(value) && value > 0;

// Sample data that breaks the money rules is left out (and told in the console), so the pages never show impossible numbers.
const clean = (data) => {
    const appointments = new Set();
    const plans = data.plans.filter((plan) => {
        const sumPeriods = plan.periods.reduce((total, p) => total + p.planAmount, 0);
        const good =
            positive(plan.planPrice) &&
            plan.periods.every((p) => positive(p.planAmount) && Number.isInteger(p.extraAmount) && p.extraAmount >= 0) &&
            sumPeriods === plan.planPrice;
        if (!good) console.error(`[cashier mock] kế hoạch ${plan.id} bị bỏ: số tiền đợt không khớp giá kế hoạch`);
        else plan.periods.forEach((p) => appointments.add(p.appointmentId));
        return good;
    });
    const visits = data.visits.filter((v) => {
        const good = !appointments.has(v.appointmentId) && v.services.length > 0 && v.services.every((s) => positive(s.amount));
        if (!good) console.error(`[cashier mock] lượt khám lẻ ${v.id} bị bỏ: trùng buổi kế hoạch hoặc số tiền không hợp lệ`);
        return good;
    });
    return { ...data, plans, visits };
};

const read = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(CASHIER_MOCK_KEY) ?? "null");
        if (parsed?.version === CASHIER_MOCK_VERSION && Array.isArray(parsed.patients) && Array.isArray(parsed.plans) && Array.isArray(parsed.receipts)) {
            return clean(parsed);
        }
    } catch {
        // broken JSON: start again from the sample data below
    }
    const seed = buildCashierSeed(clinicToday());
    try {
        localStorage.setItem(CASHIER_MOCK_KEY, JSON.stringify(seed));
    } catch {
        // storage full or blocked: the pages still work for this visit
    }
    return clean(seed);
};

// Throws when the browser refuses to store; callers turn that into a failed result, never a "saved" message.
const write = (data) => localStorage.setItem(CASHIER_MOCK_KEY, JSON.stringify(data));

const save = (data) => {
    try {
        write(data);
        return true;
    } catch {
        return false;
    }
};

const nextId = (data) => {
    data.nextId = (data.nextId ?? 1000) + 1;
    return data.nextId;
};

const nowText = () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
};

// Checks the cash shift right before a write
export const checkShift = async () => {
    if (SHIFT_SOURCE === "mock") return ok({ open: true });
    const result = await getCurrentCashSession({ skipErrorPage: true });
    if (!result.success) return { ...fail(errors.SHIFT_UNKNOWN), reason: "error" };
    if (!result.data) return { ...fail(errors.SHIFT_CLOSED), reason: "closed" };
    return ok({ open: true, session: result.data });
};

const view = (data, patient) => computePatient(patient, data, clinicToday());

// Thanh toán: one row per patient. A typed search looks at every day; otherwise day = "today" | "all" | "custom".
export const getPaymentPatients = async ({ q = "", day = "today", date = "", status = "" } = {}) => {
    await wait();
    const data = read();
    const today = clinicToday();
    const searching = q.trim() !== "";
    if (!searching && day === "custom" && !date) return ok([]);
    const rows = data.patients
        .filter((p) => matchesSearch(p, q))
        .map((p) => view(data, p))
        .filter((p) => {
            if (searching || day === "all") return true;
            return p.dates.includes(day === "today" ? today : date);
        })
        .filter((p) => !status || p.statuses.includes(status));
    return ok(rows);
};

export const getPaymentAccount = async (patientId) => {
    await wait();
    const data = read();
    const patient = data.patients.find((p) => p.id === Number(patientId));
    return patient ? ok(view(data, patient)) : fail(errors.NO_PATIENT);
};

// Patients for the pickers of Đặt cọc / Theo đợt / Ghi nhận
export const getPatientOptions = async () => {
    await wait();
    return ok(read().patients.map(({ id, code, name }) => ({ id, code, name })));
};

// Plans of one patient that the page may work on: options = which payment options count
export const getPlanOptions = async ({ patientId, options }) => {
    await wait();
    const data = read();
    const patient = data.patients.find((p) => p.id === Number(patientId));
    if (!patient) return fail(errors.NO_PATIENT);
    return ok(view(data, patient).plans.filter((p) => p.option !== null && (!options || options.includes(p.option))));
};

export const getPlan = async ({ patientId, planId }) => {
    await wait();
    const data = read();
    const patient = data.patients.find((p) => p.id === Number(patientId));
    if (!patient) return fail(errors.NO_PATIENT);
    const plan = view(data, patient).plans.find((p) => p.id === Number(planId));
    return plan ? ok(plan) : fail(errors.NO_PLAN);
};

// Ghi nhận thu tiền: what may be added to the receipt now, and the patient worked out
export const getCollectables = async (patientId) => {
    await wait();
    const data = read();
    const patient = data.patients.find((p) => p.id === Number(patientId));
    if (!patient) return fail(errors.NO_PATIENT);
    const patientView = view(data, patient);
    return ok({ patient: patientView, ...collectablesOf(patientView) });
};

// Receipts of a patient, newest first; planId keeps those with a line of that plan
export const getReceipts = async ({ patientId, planId }) => {
    await wait();
    const data = read();
    return ok(
        data.receipts
            .filter((r) => r.patientId === Number(patientId) && (!planId || r.lines.some((l) => l.planId === Number(planId))))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id),
    );
};

const ownPlan = (data, patientId, planId) => data.plans.find((p) => p.id === Number(planId) && p.patientId === Number(patientId));

export const choosePaymentOption = async ({ patientId, planId, option }) => {
    const shift = await checkShift();
    if (!shift.success) return shift;
    await wait();
    const data = read();
    const plan = ownPlan(data, patientId, planId);
    if (!plan) return fail(errors.WRONG_PATIENT);
    if (plan.option !== null) return fail(errors.OPTION_LOCKED);
    if (!Object.values(OPTION).includes(option)) return fail(errors.BAD_OPTION);
    plan.option = option;
    plan.depositRate = option === OPTION.DEPOSIT ? DEPOSIT_RATE : null;
    return save(data) ? ok(plan, CASHIER_TEXT.OPTION_SAVED) : fail(errors.STORAGE);
};

const addReceipt = (data, { patientId, method, ref, note, lines }) => {
    const receipt = {
        id: nextId(data),
        patientId: Number(patientId),
        method,
        status: receiptStatusOf(method),
        ref: method === "CASH" ? null : ref?.trim() || null,
        note: note?.trim() || null,
        createdAt: nowText(),
        receivedBy: getSessionUserName() || CASHIER_TEXT.CASHIER_FALLBACK,
        lines,
    };
    data.receipts.push(receipt);
    return receipt;
};

export const receiveDeposit = async ({ patientId, planId, amount, method, ref, note }) => {
    const shift = await checkShift();
    if (!shift.success) return shift;
    await wait();
    const data = read();
    const plan = ownPlan(data, patientId, planId);
    if (!plan) return fail(errors.WRONG_PATIENT);
    if (plan.option !== OPTION.DEPOSIT) return fail(errors.NOT_DEPOSIT);
    if (!METHODS.includes(method)) return fail(errors.BAD_METHOD);
    const current = view(data, data.patients.find((p) => p.id === plan.patientId)).plans.find((p) => p.id === plan.id);
    if (!positive(amount)) return fail(errors.BAD_AMOUNT);
    if (amount > current.depositToPay) return fail(errors.OVER_CEILING);
    const receipt = addReceipt(data, { patientId, method, ref, note, lines: [{ kind: LINE.DEPOSIT, planId: plan.id, amount }] });
    return save(data) ? ok(receipt) : fail(errors.STORAGE);
};

export const collect = async ({ patientId, lines, method, ref, note }) => {
    const shift = await checkShift();
    if (!shift.success) return shift;
    await wait();
    const data = read();
    const error = collectError(data, { patientId: Number(patientId), lines, method }, errors);
    if (error) return fail(error);
    const receipt = addReceipt(data, { patientId, method, ref, note, lines: lines.map((line) => ({ ...line })) });
    return save(data) ? ok(receipt) : fail(errors.STORAGE);
};

// Stands in for the backend's payment confirmation while the data is mock: a PENDING transfer becomes CONFIRMED or REJECTED
export const setReceiptStatus = async ({ patientId, receiptId, status }) => {
    const shift = await checkShift();
    if (!shift.success) return shift;
    await wait();
    const data = read();
    const receipt = data.receipts.find((r) => r.id === Number(receiptId) && r.patientId === Number(patientId));
    if (!receipt) return fail(errors.NO_RECEIPT);
    if (receipt.status !== RECEIPT_STATUS.PENDING) return fail(errors.NOT_PENDING);
    if (![RECEIPT_STATUS.CONFIRMED, RECEIPT_STATUS.REJECTED].includes(status)) return fail(errors.BAD_STATUS);
    receipt.status = status;
    return save(data) ? ok(receipt) : fail(errors.STORAGE);
};

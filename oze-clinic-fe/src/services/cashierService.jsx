import api from "./api";
import { getCurrentCashSession } from "./cashSessionService";
import { call, clinicToday } from "./receptionService";
import { LINE, RECEIPT_STATUS, collectablesOf, computePatient } from "../utils/cashier";
import { CASHIER_TEXT } from "../utils/messages";

// Cashier pages (Thanh toán, Đặt cọc dịch vụ, Thanh toán theo đợt, Ghi nhận thu tiền): the one door the pages use (api/cashier).
// Every function returns { success, message, data, errors } like the other API calls.
// The backend sends the raw plans, visits and receipts of a patient; utils/cashier.js works the numbers out, and the
// backend checks every write again with the same rules (CashierCalculator).

const errors = CASHIER_TEXT.ERRORS;

const ok = (data, message = null) => ({ success: true, message, data, errors: null });
const fail = (message, extra = {}) => ({ success: false, message, data: null, errors: null, ...extra });

// Backend messages of the cashier endpoints, in Vietnamese; anything else keeps the generic text
const backendErrors = {
    "Patient not found.": errors.NO_PATIENT,
    "Treatment plan not found.": errors.NO_PLAN,
    "This treatment plan is not agreed yet or is closed.": errors.PLAN_NOT_OPEN,
    "Payment option must be FULL, PERIODS or DEPOSIT.": errors.BAD_OPTION,
    "The payment option of this plan has already been chosen and cannot be changed.": errors.OPTION_LOCKED,
    "Choose the payment option of the plan first.": errors.NOT_COLLECTABLE,
    "Add at least one item to the receipt.": errors.NO_LINES,
    "Amount must be a whole number greater than 0.": errors.BAD_AMOUNT,
    "Unknown receipt line.": errors.BAD_KIND,
    "An item of the receipt does not belong to this patient.": errors.WRONG_PATIENT,
    "The treatment session does not belong to this plan.": errors.WRONG_PLAN,
    "This plan is not paid by deposit.": errors.NOT_DEPOSIT,
    "This plan is not paid in full.": errors.NOT_FULL,
    "This treatment session cannot take money now.": errors.NOT_COLLECTABLE,
    "The amount is more than what is still owed.": errors.OVER_CEILING,
    "Receipt not found.": errors.NO_RECEIPT,
    "Only a receipt waiting for confirmation can be confirmed or rejected.": errors.NOT_PENDING,
    "This visit has no service to collect.": errors.NO_LINES,
    "You have no open cash session. Open one first.": errors.SHIFT_CLOSED,
    "Payment method must be one of: CASH, BANK_TRANSFER, QR_TRANSFER.": errors.BAD_METHOD,
    "From date must be on or before to date.": errors.DATE_RANGE,
};

const translate = (result) => {
    if (result.success) return result;
    if (result.noResponse) return { ...result, message: errors.NO_RESPONSE };
    if (result.status === 409) return { ...result, message: errors.CONFLICT };
    return { ...result, message: backendErrors[result.message] ?? result.message ?? errors.OTHER };
};

const request = async (send) => translate(await call(send));

// "2026-11-22T02:30:00+00:00" -> "2026-11-22T09:30" (clinic time), the form the pages show and sort by
const clinicText = (value) => {
    if (!value) return value;
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(new Date(value));
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
};

// Backend account -> the data shape utils/cashier.js works on
const toData = (account) => ({
    patients: [account.patient],
    plans: account.plans,
    visits: account.visits,
    receipts: account.receipts.map((r) => ({
        ...r,
        createdAt: clinicText(r.createdAt),
        confirmedAt: clinicText(r.confirmedAt),
        receivedBy: r.receivedBy || CASHIER_TEXT.CASHIER_FALLBACK,
    })),
});

const loadAccount = async (patientId) => {
    if (!patientId) return fail(errors.NO_PATIENT);
    const result = await request(() => api.get(`/api/cashier/patients/${patientId}/account`));
    return result.success ? ok(toData(result.data)) : result;
};

const viewOf = (data) => computePatient(data.patients[0], data, clinicToday());

// Checks the cash shift right before a write (the backend checks it again)
export const checkShift = async () => {
    const result = await getCurrentCashSession({ skipErrorPage: true });
    if (!result.success) return { ...fail(errors.SHIFT_UNKNOWN), reason: "error" };
    if (!result.data) return { ...fail(errors.SHIFT_CLOSED), reason: "closed" };
    return ok({ open: true, session: result.data });
};

// Deposit share the clinic asks for now (0.3 = 30 %); a plan keeps the rate it was given when DEPOSIT was chosen
export const getDepositRate = async () => {
    const result = await request(() => api.get("/api/cashier/config"));
    return result.success ? ok(result.data.depositRate) : result;
};

// Thanh toán: one row per patient, one page at a time. A typed search looks at every day; otherwise day = "today" | "all" | "custom".
// data = { items, totalCount, totalPages }
export const getPaymentPatients = async ({ q = "", day = "today", date = "", status = "", page = 1, pageSize = 20 } = {}) => {
    const searching = q.trim() !== "";
    if (!searching && day === "custom" && !date) return ok({ items: [], totalCount: 0, totalPages: 1 });
    const result = await request(() =>
        api.get("/api/cashier/patients", {
            params: {
                searchKeyword: searching ? q.trim() : undefined,
                date: searching || day === "all" ? undefined : day === "today" ? clinicToday() : date,
                status: status || undefined,
                pageNumber: page,
                pageSize,
            },
        }),
    );
    if (!result.success) return result;
    const { items, totalCount, totalPages } = result.data;
    return ok({ items, totalCount, totalPages: Math.max(1, totalPages) });
};

export const getDebtPatients = async ({ q = "", age = "", fromDate = "", toDate = "", page = 1, pageSize = 10 } = {}) => {
    const result = await request(() =>
        api.get("/api/cashier/debts", {
            params: { searchKeyword: q.trim() || undefined, age: age || undefined, fromDate: fromDate || undefined, toDate: toDate || undefined, pageNumber: page, pageSize },
            skipErrorPage: true,
        }),
    );
    if (!result.success) return result;
    const { items, totalCount, totalPages, totalOwed } = result.data;
    return ok({ items, totalCount, totalPages: Math.max(1, totalPages), totalOwed });
};

export const getPaymentAccount = async (patientId) => {
    const loaded = await loadAccount(patientId);
    return loaded.success ? ok(viewOf(loaded.data)) : loaded;
};

// Patients for the pickers of Đặt cọc / Theo đợt / Ghi nhận
export const getPatientOptions = async (search, config = {}) => {
    const result = await request(() => api.get("/api/cashier/patients/options", { params: { search }, skipErrorPage: true, ...config }));
    return result.success ? ok({ items: result.data.map(({ id, code, name, phone }) => ({ id, patientCode: code, fullName: name, phoneNumber: phone })) }) : result;
};

// Plans of one patient that the page may work on: options = which payment options count
export const getPlanOptions = async ({ patientId, options }) => {
    const loaded = await loadAccount(patientId);
    if (!loaded.success) return loaded;
    const view = viewOf(loaded.data);
    return ok({
        patient: { id: view.id, patientCode: view.code, fullName: view.name, phoneNumber: view.phone },
        plans: view.plans.filter((p) => p.option !== null && (!options || options.includes(p.option))),
    });
};

// One plan worked out; suggestedDepositRate is the clinic rate a plan not chosen yet would get
export const getPlan = async ({ patientId, planId }) => {
    const [loaded, rate] = await Promise.all([loadAccount(patientId), getDepositRate()]);
    if (!loaded.success) return loaded;
    const plan = viewOf(loaded.data).plans.find((p) => p.id === Number(planId));
    if (!plan) return fail(errors.NO_PLAN);
    return ok({ ...plan, suggestedDepositRate: rate.success ? rate.data : null });
};

// Ghi nhận thu tiền: what may be added to the receipt now, and the patient worked out
export const getCollectables = async (patientId) => {
    const loaded = await loadAccount(patientId);
    if (!loaded.success) return loaded;
    const patientView = viewOf(loaded.data);
    return ok({ patient: patientView, ...collectablesOf(patientView) });
};

// Receipts of a patient, newest first; planId keeps those with a line of that plan
export const getReceipts = async ({ patientId, planId }) => {
    const loaded = await loadAccount(patientId);
    if (!loaded.success) return loaded;
    return ok(
        loaded.data.receipts
            .filter((r) => !planId || r.lines.some((l) => l.planId === Number(planId)))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || String(b.id).localeCompare(String(a.id))),
    );
};

export const choosePaymentOption = async ({ patientId, planId, option }) => {
    const shift = await checkShift();
    if (!shift.success) return shift;
    const result = await request(() => api.post(`/api/cashier/plans/${planId}/payment-option`, { patientId: Number(patientId), option }));
    return result.success ? ok(result.data, CASHIER_TEXT.OPTION_SAVED) : result;
};

const saveReceipt = async ({ patientId, method, ref, note, lines }) => {
    const shift = await checkShift();
    if (!shift.success) return shift;
    const result = await request(() =>
        api.post("/api/cashier/receipts", {
            patientId: Number(patientId),
            paymentMethod: method,
            transactionReference: method === "CASH" ? null : ref?.trim() || null,
            notes: note?.trim() || null,
            lines,
        }),
    );
    return result.success ? ok({ ...result.data, createdAt: clinicText(result.data.createdAt), confirmedAt: clinicText(result.data.confirmedAt) }) : result;
};

export const receiveDeposit = ({ patientId, planId, amount, method, ref, note }) =>
    saveReceipt({ patientId, method, ref, note, lines: [{ kind: LINE.DEPOSIT, planId: Number(planId), amount }] });

// Walk-in money is counted for the whole visit: lines of the same visit go as one line
export const collect = ({ patientId, lines, method, ref, note }) => {
    const visits = new Map();
    const sent = [];
    lines.forEach((line) => {
        if (line.kind !== LINE.VISIT_SERVICE) {
            sent.push({ kind: line.kind, planId: line.planId, periodId: line.periodId ?? null, amount: line.amount });
            return;
        }
        const same = visits.get(line.visitId);
        if (same) same.amount += line.amount;
        else {
            const next = { kind: line.kind, visitId: line.visitId, amount: line.amount };
            visits.set(line.visitId, next);
            sent.push(next);
        }
    });
    return saveReceipt({ patientId, method, ref, note, lines: sent });
};

// A PENDING transfer / QR receipt: the money arrived (CONFIRMED) or did not (REJECTED)
export const setReceiptStatus = async ({ patientId, receiptId, status }) => {
    if (![RECEIPT_STATUS.CONFIRMED, RECEIPT_STATUS.REJECTED].includes(status)) return fail(errors.BAD_STATUS);
    const shift = await checkShift();
    if (!shift.success) return shift;
    const action = status === RECEIPT_STATUS.CONFIRMED ? "confirm" : "reject";
    const result = await request(() => api.post(`/api/cashier/patients/${patientId}/receipts/${encodeURIComponent(receiptId)}/${action}`));
    return result.success ? ok({ ...result.data, createdAt: clinicText(result.data.createdAt), confirmedAt: clinicText(result.data.confirmedAt) }) : result;
};

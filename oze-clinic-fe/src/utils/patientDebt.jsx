import { formatCurrency, formatDate, getClinicDateTimeParts } from "./format";
import { norm } from "./medicalRecord";
import { PATIENT_DEBT_PAY_TYPE, PATIENT_DEBT_STATUS, PATIENT_DEBT_TEXT, PAYMENT_METHOD_LABELS } from "./messages";

export const DEBT_NAV_FLAG = "paymentDebtNav";
export const DEBT_ID_PATTERN = /^invoice-[1-9]\d*$/;
export const DEBT_PAGE_SIZE = 5;
export const DEBT_TYPE_ALL = "all";
export const DEBT_TYPES = Object.keys(PATIENT_DEBT_PAY_TYPE);
export const DEBT_STATUSES = Object.keys(PATIENT_DEBT_STATUS);
export const DEBT_DEFAULT_SORT = "due";
export const DEBT_SORTS = [
    { value: "due", label: PATIENT_DEBT_TEXT.SORT_DUE },
    { value: "left", label: PATIENT_DEBT_TEXT.SORT_LEFT },
    { value: "new", label: PATIENT_DEBT_TEXT.SORT_NEW },
];

export const DEBT_TITLE_ID = "payment-debt-title";
export const DEBT_SEARCH_ID = "payment-debt-search";
export const DEBT_FILTER_BUTTON_ID = "payment-debt-filter-button";
export const DEBT_SORT_BUTTON_ID = "payment-debt-sort-button";
export const DEBT_STATUS_BUTTON_ID = "payment-debt-status-help";
export const DEBT_RETRY_ID = "payment-debt-retry";

export const debtOpenSelector = (id) => `[data-debt-open="${id}"]`;

const NO_VALUE = "—";
const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const NO_DATE_KEY = "99999999";
const STATUS_RANK = { overdue: 0, open: 1, upcoming: 2, paid: 3 };
const SORT_KEYS = new Set(DEBT_SORTS.map((option) => option.value));
const PAGE_PATTERN = /^[1-9]\d*$/;

const PAY_TYPE = { ONCE: "once", STEP: "step", INSTALLMENT: "installment" };
const PERIOD_STATUS = { Paid: "paid", Overdue: "overdue", Pending: "later" };
const STEP_DONE = "DONE";
const STEP_STATUS = { IN_PROGRESS: "inProgress", NOT_STARTED: "notStarted" };
const REFUND_STATUS = { Pending: "pending", Approved: "approved", Processed: "refunded", Rejected: "rejected" };
const REFUND_CODE_DIGITS = 6;

export const dateKey = (value) => {
    const match = DATE_PATTERN.exec(String(value ?? ""));
    return match ? `${match[3]}${match[2]}${match[1]}` : NO_DATE_KEY;
};

export const byNewest = (getDate) => (a, b) => dateKey(getDate(b)).localeCompare(dateKey(getDate(a)));

export const methodLabel = (code) => (Object.hasOwn(PAYMENT_METHOD_LABELS, code) ? PAYMENT_METHOD_LABELS[code] : NO_VALUE);

const toNumber = (value) => Number(value) || 0;

export const clinicDate = (value) => (value ? getClinicDateTimeParts(new Date(value)).date : NO_VALUE);

export const refundCode = (id) => `HT${String(id).padStart(REFUND_CODE_DIGITS, "0")}`;

export const toPayment = (payment, receiptId) => ({
    key: String(payment.id),
    receiptId,
    date: clinicDate(payment.paidAt),
    amount: toNumber(payment.amount),
    method: methodLabel(payment.paymentMethod),
});

export const toRefund = (refund, receiptDate) => ({
    code: refundCode(refund.id),
    amount: toNumber(refund.amount),
    reason: refund.reason ?? "",
    status: REFUND_STATUS[refund.status] ?? REFUND_STATUS.Pending,
    rejectionReason: refund.rejectionReason ?? "",
    createdAt: clinicDate(refund.createdAt),
    visitDate: receiptDate,
    stage: null,
});

const debtStatus = (account) => {
    if (account.hasOverdue) return "overdue";
    if (toNumber(account.dueAmount) > 0) return "open";
    return toNumber(account.plannedAmount) > 0 ? "upcoming" : "paid";
};

const toPeriod = (step, invoiceId) => ({
    key: `${invoiceId}-${step.number}`,
    label: PATIENT_DEBT_TEXT.PERIOD(step.number),
    milestone: step.date ? PATIENT_DEBT_TEXT.PERIOD_DUE(formatDate(step.date)) : "",
    date: formatDate(step.date) || NO_VALUE,
    amount: toNumber(step.amount),
    status: PERIOD_STATUS[step.status] ?? PERIOD_STATUS.Pending,
    note: "",
});

export const allocateSteps = (steps, paid, invoiceId) => {
    let left = toNumber(paid);
    const stages = steps.map((step) => {
        const amount = toNumber(step.amount);
        const base = { key: `${invoiceId}-${step.number}`, label: PATIENT_DEBT_TEXT.STEP(step.number), milestone: step.name, amount, note: "" };
        if (step.status !== STEP_DONE) return { ...base, status: STEP_STATUS[step.status] ?? STEP_STATUS.NOT_STARTED };
        const covered = Math.min(left, amount);
        left -= covered;
        if (covered >= amount) return { ...base, status: "paid" };
        if (covered > 0) return { ...base, status: "partial", note: PATIENT_DEBT_TEXT.STEP_SHORT(formatCurrency(amount - covered)) };
        return { ...base, status: "unpaid" };
    });
    return { stages, prepaid: left };
};

const nextPeriod = (stages) => stages.find((stage) => stage.status === "overdue") ?? stages.find((stage) => stage.status === "later") ?? null;

const subLine = (account, type) => {
    const doctor = account.doctorName || null;
    if (type === "once") return [PATIENT_DEBT_TEXT.VISIT_ON(formatDate(account.startedOn)), doctor].filter(Boolean).join(" · ");
    const count = account.steps?.length ?? 0;
    const unit = type === "installment" ? PATIENT_DEBT_TEXT.PERIOD_COUNT(count) : PATIENT_DEBT_TEXT.STEP_COUNT(count);
    return [PATIENT_DEBT_TEXT.PLAN, unit, doctor].filter(Boolean).join(" · ");
};

const withSearch = (item) => ({ ...item, search: norm(`${item.name} ${item.sub}`) });

export const toDebtItem = (account) => {
    const type = PAY_TYPE[account.paymentMode] ?? "once";
    const invoiceId = account.invoiceId;
    const start = formatDate(account.startedOn) || NO_VALUE;
    const steps = Array.isArray(account.steps) ? account.steps : [];
    const base = {
        id: account.key,
        invoiceId,
        type,
        name: account.name || account.invoiceNumber || NO_VALUE,
        sub: subLine(account, type),
        total: toNumber(account.finalAmount),
        paid: toNumber(account.paidAmount),
        due: toNumber(account.dueAmount),
        planned: toNumber(account.plannedAmount),
        status: debtStatus(account),
        start,
        payments: (account.payments ?? []).map((payment) => toPayment(payment, invoiceId)).sort(byNewest((payment) => payment.date)),
        refunds: (account.refunds ?? []).map((refund) => toRefund(refund, start)).sort(byNewest((refund) => refund.createdAt)),
        stages: [],
        lines: [],
        next: null,
        prepaid: 0,
    };
    if (type === "installment") {
        const stages = steps.map((step) => toPeriod(step, invoiceId));
        return withSearch({ ...base, stages, next: nextPeriod(stages) });
    }
    if (type === "step") {
        const { stages, prepaid } = allocateSteps(steps, base.paid, invoiceId);
        return withSearch({ ...base, stages, prepaid });
    }
    const lines = steps.map((step) => ({ key: `${invoiceId}-${step.number}`, name: step.name, detail: "", total: toNumber(step.amount) }));
    return withSearch({ ...base, lines });
};

const byId = (a, b) => a.invoiceId - b.invoiceId;
const byStart = (a, b) => dateKey(a.start).localeCompare(dateKey(b.start));

const COMPARE = {
    due: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || byStart(a, b) || byId(a, b),
    left: (a, b) => b.due - a.due || STATUS_RANK[a.status] - STATUS_RANK[b.status] || byStart(a, b) || byId(a, b),
    new: (a, b) => dateKey(b.start).localeCompare(dateKey(a.start)) || b.invoiceId - a.invoiceId,
};

export const inType = (items, type) => (type === DEBT_TYPE_ALL ? items : items.filter((item) => item.type === type));

export const filterDebts = (items, query) => {
    const keyword = norm(query.q.trim());
    return inType(items, query.type).filter((item) => (!keyword || item.search.includes(keyword)) && (!query.status.length || query.status.includes(item.status)));
};

export const sortDebts = (items, sort) => [...items].sort(COMPARE[sort] ?? COMPARE[DEBT_DEFAULT_SORT]);

export const countByType = (items) => Object.fromEntries([DEBT_TYPE_ALL, ...DEBT_TYPES].map((type) => [type, inType(items, type).length]));

export const countByStatus = (items, type) => {
    const scoped = inType(items, type);
    return Object.fromEntries(DEBT_STATUSES.map((status) => [status, scoped.filter((item) => item.status === status).length]));
};

export const readDebtQuery = (searchParams) => {
    const type = searchParams.get("type");
    const sort = searchParams.get("sort");
    const page = searchParams.get("page") ?? "";
    const status = (searchParams.get("status") ?? "").split(",").filter((value) => DEBT_STATUSES.includes(value));
    return {
        type: DEBT_TYPES.includes(type) ? type : DEBT_TYPE_ALL,
        q: (searchParams.get("q") ?? "").trim(),
        status: [...new Set(status)],
        sort: SORT_KEYS.has(sort) ? sort : DEBT_DEFAULT_SORT,
        page: PAGE_PATTERN.test(page) ? Number(page) : 1,
    };
};

export const buildDebtSearch = (query) => {
    const params = new URLSearchParams();
    if (query.type !== DEBT_TYPE_ALL) params.set("type", query.type);
    if (query.q.trim()) params.set("q", query.q.trim());
    if (query.status.length) params.set("status", query.status.join(","));
    if (query.sort !== DEBT_DEFAULT_SORT) params.set("sort", query.sort);
    if (query.page > 1) params.set("page", String(query.page));
    const search = params.toString().replace(/%2C/g, ",");
    return search ? `?${search}` : "";
};

export const pageCount = (total) => Math.max(1, Math.ceil(total / DEBT_PAGE_SIZE));

export const clampPage = (query, total) => ({ ...query, page: Math.min(query.page, pageCount(total)) });

export const debtProgress = (item) => {
    const unpaid = item.due + item.planned;
    const percent = item.total > 0 ? Math.min(100, Math.max(0, unpaid > 0 ? Math.floor((item.paid * 100) / item.total) : 100)) : 100;
    return { percent, cells: Math.floor(percent / 5) };
};

export const findDebt = (items, id) => (typeof id === "string" && DEBT_ID_PATTERN.test(id) ? (items.find((item) => item.id === id) ?? null) : null);

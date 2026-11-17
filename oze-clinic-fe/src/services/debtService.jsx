import { DEBT_AGE_FILTERS, DEBT_SORTS, DEBT_TYPES } from "../utils/constants/debt";
import { getClinicDateTimeParts } from "../utils/format";
import { PAYMENT_METHOD_LABELS } from "../utils/messages";
import api from "./api";
import { call } from "./receptionService";

// Patient debts of the manager (api/debts): invoices not fully paid, with installments and payment reminders.
// The backend searches (invoice number, patient name / code / phone) and sorts overdue first; it has no filters by
// status, age or installment, so the open invoices are read in full (they are few) and filtered and paged here.
// Details of one invoice come from api/Invoices/{id} and api/debts/{id}/reminders.

export const DEBT_PAGE_SIZE = 8;
// Largest page the backend returns; the list is read page by page until it is complete.
const FETCH_PAGE_SIZE = 100;
const MAX_FETCH_PAGES = 20;

const MESSAGES = {
    "Invoice not found.": "Không tìm thấy hoá đơn.",
};

const withMessage = (result) => ({ ...result, message: MESSAGES[result.message] ?? result.message });

const toLocalPhone = (phone) => (phone ?? "").replace(/^\+84/, "0");

// Phones are stored as +84...; a search typed as 0977... is sent the same way.
const toSearch = (keyword) => {
    const text = keyword.trim().replace(/\s/g, "");
    return /^0\d+$/.test(text) ? `+84${text.slice(1)}` : keyword.trim();
};

const toDebt = (item) => ({
    id: item.invoiceId,
    invoiceNumber: item.invoiceNumber,
    patientName: item.patientName,
    patientCode: item.patientCode,
    phone: toLocalPhone(item.patientPhoneNumber),
    createdAt: item.createdAt,
    createdDate: getClinicDateTimeParts(item.createdAt).date,
    ageDays: item.ageDays,
    totalAmount: Number(item.finalAmount),
    paidAmount: Number(item.paidAmount),
    remainingAmount: Number(item.remainingAmount),
    status: item.paymentStatus,
    hasInstallmentPlan: item.hasInstallmentPlan,
    nextDueDate: item.nextDueDate,
    nextDueAmount: item.nextDueAmount == null ? null : Number(item.nextDueAmount),
    overdueCount: item.overdueCount,
    overdueAmount: Number(item.overdueAmount ?? 0),
    lastRemindedAt: item.lastRemindedAt,
    reminderCount: item.reminderCount,
});

const loadOpenDebts = async (keyword) => {
    const items = [];
    for (let page = 1; page <= MAX_FETCH_PAGES; page++) {
        const result = await call(() =>
            api.get("/api/debts", { params: { pageNumber: page, pageSize: FETCH_PAGE_SIZE, searchKeyword: keyword ? toSearch(keyword) : undefined } }),
        );
        if (!result.success) return withMessage(result);
        items.push(...result.data.items.map(toDebt));
        if (page >= result.data.totalPages) break;
    }
    return { success: true, message: null, errors: null, data: items };
};

const AGE_MATCHERS = {
    [DEBT_AGE_FILTERS.WITHIN_30]: (days) => days <= 30,
    [DEBT_AGE_FILTERS.OVER_30]: (days) => days > 30,
    [DEBT_AGE_FILTERS.OVER_60]: (days) => days > 60,
};

const TYPE_MATCHERS = {
    [DEBT_TYPES.INSTALLMENT]: (debt) => debt.hasInstallmentPlan,
    [DEBT_TYPES.OVERDUE]: (debt) => debt.overdueCount > 0,
    [DEBT_TYPES.REGULAR]: (debt) => !debt.hasInstallmentPlan,
};

const oldestFirst = (a, b) => a.createdAt.localeCompare(b.createdAt) || a.invoiceNumber.localeCompare(b.invoiceNumber);

const COMPARATORS = {
    [DEBT_SORTS.OLDEST]: oldestFirst,
    [DEBT_SORTS.NEWEST]: (a, b) => oldestFirst(b, a),
    [DEBT_SORTS.LARGEST]: (a, b) => b.remainingAmount - a.remainingAmount || oldestFirst(a, b),
};

const filterDebts = async ({ keyword = "", status = "", age = "", type = "", sort = DEBT_SORTS.OLDEST }) => {
    const result = await loadOpenDebts(keyword);
    if (!result.success) return result;
    const items = result.data
        .filter((debt) => (!status || debt.status === status) && (!age || AGE_MATCHERS[age](debt.ageDays)) && (!type || TYPE_MATCHERS[type](debt)))
        .sort(COMPARATORS[sort] ?? oldestFirst);
    return { ...result, data: items };
};

export const getDebts = async ({ page = 1, pageSize = DEBT_PAGE_SIZE, ...filters } = {}) => {
    const result = await filterDebts(filters);
    if (!result.success) return result;

    const totalItems = result.data.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * pageSize;
    return {
        ...result,
        data: {
            items: result.data.slice(start, start + pageSize),
            page: currentPage,
            pageSize,
            totalItems,
            totalPages,
            totalRemaining: result.data.reduce((sum, debt) => sum + debt.remainingAmount, 0),
            updatedAt: new Date().toISOString(),
        },
    };
};

// Every debt that matches the filters, for "Xuất danh sách".
export const getAllDebts = (filters = {}) => filterDebts(filters);

// One invoice with what is still owed, its services, its payments and the payment reminders sent.
export const getDebt = async (id) => {
    const [invoice, reminders, debts] = await Promise.all([
        call(() => api.get(`/api/Invoices/${id}`)),
        call(() => api.get(`/api/debts/${id}/reminders`)),
        loadOpenDebts(""),
    ]);
    if (!invoice.success) return withMessage(invoice);

    const debt = debts.success ? debts.data.find((item) => item.id === id) : null;
    const data = invoice.data;
    return {
        success: true,
        message: null,
        errors: null,
        data: {
            ...(debt ?? {}),
            id: data.id,
            invoiceNumber: data.invoiceNumber,
            patientName: data.patientName ?? debt?.patientName ?? "",
            createdAt: data.createdAt,
            createdDate: getClinicDateTimeParts(data.createdAt).date,
            fromTreatmentPlan: data.treatmentPlanId != null,
            totalAmount: Number(data.finalAmount),
            discountAmount: Number(data.discountAmount ?? 0),
            paidAmount: Number(data.paidAmount),
            remainingAmount: Number(data.remainingAmount),
            status: data.paymentStatus,
            notes: data.notes,
            services: data.items.map((item) => ({
                id: item.id,
                name: item.serviceName,
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
                amount: Number(item.amount),
            })),
            payments: data.payments.map((payment) => ({
                id: payment.id,
                paidAt: payment.paidAt ?? payment.createdAt,
                amount: Number(payment.amount),
                methodLabel: PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod,
                status: payment.paymentStatus,
            })),
            reminders: reminders.success
                ? reminders.data.map((reminder) => ({
                      id: reminder.id,
                      sentAt: reminder.sentAt,
                      channels: reminder.channels,
                      sentByName: reminder.isAutomatic ? "Hệ thống tự động" : (reminder.sentByName ?? "—"),
                  }))
                : [],
        },
    };
};

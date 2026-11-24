import { formatDate } from "./format";
import { norm } from "./medicalRecord";
import { byNewest, clinicDate, dateKey, toPayment, toRefund } from "./patientDebt";

export const HISTORY_DEFAULT_SORT = "new";
export const MONTH_PATTERN = /^(0[1-9]|1[0-2])-\d{4}$/;

export const HISTORY_TITLE_ID = "payment-history-title";
export const HISTORY_REFUNDS_TITLE_ID = "payment-history-refunds-title";

const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const NO_VALUE = "—";
export const monthKey = (date) => {
    const match = DATE_PATTERN.exec(String(date ?? ""));
    return match ? `${match[2]}-${match[3]}` : null;
};

export const monthLabel = (key) => `Tháng ${Number(key.slice(0, 2))}/${key.slice(3)}`;

export const monthOrder = (key) => Number(`${key.slice(3)}${key.slice(0, 2)}`);

export const birthYear = (dob) => DATE_PATTERN.exec(String(dob ?? ""))?.[3] ?? NO_VALUE;

const sum = (list, read) => list.reduce((total, entry) => total + read(entry), 0);
const toNumber = (value) => Number(value) || 0;
const GENDER_LABELS = { Male: "Nam", Female: "Nữ" };

const receiptStatus = (paid, left) => {
    if (left <= 0) return "paid";
    return paid > 0 ? "partial" : "unpaid";
};

export const toPayerProfile = (me) => ({
    name: me?.fullName ?? "",
    dob: formatDate(me?.dateOfBirth),
    gender: GENDER_LABELS[me?.gender] ?? "",
    phone: (me?.phoneNumber ?? "").replace(/^\+84/, "0"),
    addr: me?.address ?? "",
});

const followUpText = (invoice) => {
    const date = formatDate(invoice.followUpDate);
    return [date, invoice.followUpNotes].filter(Boolean).join(" – ") || NO_VALUE;
};

const toLine = (item, index, invoiceId) => ({
    key: `${invoiceId}-${index}`,
    name: item.stageName ? `${item.stageName} – ${item.serviceName}` : item.serviceName,
    detail: item.description ?? "",
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    total: toNumber(item.amount),
});

export const toReceipt = (invoice, payer) => {
    const date = formatDate(invoice.visitDate) || clinicDate(invoice.createdAt);
    const lines = (invoice.items ?? []).map((item, index) => toLine(item, index, invoice.id));
    const diag = (invoice.diagnoses ?? []).filter(Boolean).join(", ");
    const paid = toNumber(invoice.paidAmount);
    const left = toNumber(invoice.remainingAmount);
    return {
        id: invoice.id,
        no: invoice.invoiceNumber ?? "",
        title: invoice.treatmentPlanName ?? "",
        isPlan: invoice.treatmentPlanId != null,
        planId: invoice.treatmentPlanId ?? null,
        date,
        doctor: invoice.doctorName ?? "",
        diag,
        reason: invoice.chiefComplaint ?? "",
        next: followUpText(invoice),
        lines,
        gross: toNumber(invoice.totalAmount),
        disc: toNumber(invoice.discountAmount),
        net: toNumber(invoice.finalAmount),
        pays: (invoice.payments ?? []).map((payment) => ({ ...toPayment(payment, invoice.id), payer: payer || NO_VALUE })).sort(byNewest((payment) => payment.date)),
        paid,
        left,
        status: receiptStatus(paid, left),
        refunds: (invoice.refunds ?? []).map((refund) => toRefund(refund, date)).sort(byNewest((refund) => refund.createdAt)),
        month: monthKey(date),
        search: norm([invoice.invoiceNumber, invoice.treatmentPlanName, ...lines.flatMap((line) => [line.name, line.detail]), diag, invoice.doctorName, date].filter(Boolean).join(" ")),
    };
};

export const withRemainAll = (items) =>
    items.map((item) => ({
        ...item,
        remainAll: sum(
            items.filter((other) => dateKey(other.date) <= dateKey(item.date)),
            (other) => other.left,
        ),
    }));

const byNewestDate = (a, b) => dateKey(b.date).localeCompare(dateKey(a.date)) || b.id - a.id;

const COMPARE = {
    new: byNewestDate,
    old: (a, b) => dateKey(a.date).localeCompare(dateKey(b.date)) || a.id - b.id,
    left: (a, b) => b.left - a.left || byNewestDate(a, b),
    net: (a, b) => b.net - a.net || byNewestDate(a, b),
};

export const filterReceipts = (items, query) => {
    const keyword = norm(query.q.trim());
    return items.filter(
        (item) =>
            (!keyword || item.search.includes(keyword)) && (!query.status.length || query.status.includes(item.status)) && (!query.month.length || query.month.includes(item.month)),
    );
};

export const sortReceipts = (list, sort) => [...list].sort(COMPARE[sort] ?? COMPARE[HISTORY_DEFAULT_SORT]);

export const countBy = (items, key) =>
    items.reduce((counts, item) => {
        counts[item[key]] = (counts[item[key]] ?? 0) + 1;
        return counts;
    }, {});

export const historyMonths = (items) => [...new Set(items.map((item) => item.month).filter(Boolean))].sort((a, b) => monthOrder(b) - monthOrder(a));

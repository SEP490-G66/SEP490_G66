import { formatDate, toDateOnly } from "../utils/format";
import { leaveSlotLabel } from "../utils/shift";
import api from "./api";
import { pendingLeaveRequests } from "./leaveRequestService";
import { call } from "./receptionService";
import { pendingRefundRequests } from "./refundRequestService";

// Manager report ("Báo cáo" dashboard) built from the backend:
// - api/invoice-reports/overview: collected revenue, new invoices, revenue by payment method of a date range
// - api/invoice-reports/revenue-by-day: collected revenue of each day (at most 31 days per call)
// - api/Appointments: appointment counts per status (totalCount of a 1-item page)
// - api/debts: what patients still owe (as of today, whatever the period)
// Money comes in VND and is turned into million VND for the charts.

const DAY_MS = 86_400_000;
const MILLION = 1_000_000;
const DEBT_PREVIEW_COUNT = 3;
// Days shown around the chosen day when the period is one day
const DAY_CHART_DAYS = 7;

export const REPORT_PERIODS = {
    DAY: "day",
    WEEK: "week",
    MONTH: "month",
    YEAR: "year",
};

// Kinds of request waiting for the manager (getPendingRequests).
export const REQUEST_TYPES = {
    LEAVE: "leave",
    REFUND: "refund",
};

const APPOINTMENT_STATUS = { COMPLETED: "COMPLETED", CANCELLED: "CANCELLED", NO_SHOW: "NO_SHOW" };

const PAYMENT_METHOD_GROUPS = [
    { label: "Tiền mặt", methods: ["CASH"] },
    { label: "Chuyển khoản", methods: ["BANK_TRANSFER", "QR_TRANSFER"] },
];

const WEEKDAYS_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const pad = (value) => String(value).padStart(2, "0");

const round1 = (value) => Math.round(value * 10) / 10;

const toMillion = (amount) => round1(Number(amount ?? 0) / MILLION);

const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Monday of the week.
const startOfWeek = (date) => addDays(date, -((date.getDay() + 6) % 7));

const daysBetween = (from, to) => {
    const days = [];
    for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
    return days;
};

const minDate = (a, b) => (a < b ? a : b);

const getRange = (period, offset, today) => {
    if (period === REPORT_PERIODS.DAY) {
        const day = addDays(today, offset);
        return { from: day, to: day };
    }
    if (period === REPORT_PERIODS.WEEK) {
        const from = addDays(startOfWeek(today), offset * 7);
        return { from, to: addDays(from, 6) };
    }
    if (period === REPORT_PERIODS.MONTH) {
        const from = new Date(today.getFullYear(), today.getMonth() + offset, 1);
        return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 0) };
    }
    const year = today.getFullYear() + offset;
    return { from: new Date(year, 0, 1), to: new Date(year, 11, 31) };
};

const rangeLabel = (period, { from, to }) => {
    if (period === REPORT_PERIODS.DAY) return `${WEEKDAYS_SHORT[from.getDay()]} ${formatDate(toDateOnly(from))}`;
    if (period === REPORT_PERIODS.MONTH) return `Tháng ${from.getMonth() + 1}/${from.getFullYear()}`;
    if (period === REPORT_PERIODS.YEAR) return `Năm ${from.getFullYear()}`;
    const start = from.getFullYear() === to.getFullYear() ? `${pad(from.getDate())}/${pad(from.getMonth() + 1)}` : formatDate(toDateOnly(from));
    return `${start} – ${formatDate(toDateOnly(to))}`;
};

// Period the report is compared with: the same weekday last week for a day, otherwise the period before.
const getPreviousRange = (period, offset, today) => getRange(period, period === REPORT_PERIODS.DAY ? offset - 7 : offset - 1, today);

// Names of the two chart series and the metric caption, e.g. "Tháng 10" / "Tháng 9" / "so với cùng kỳ tháng 9".
const comparisonLabels = (period, range, previousRange) => {
    if (period === REPORT_PERIODS.DAY) {
        const previous = `${WEEKDAYS_SHORT[range.from.getDay()]} tuần trước`;
        return { current: formatDate(toDateOnly(range.from)), previous, caption: `so với ${previous}` };
    }
    if (period === REPORT_PERIODS.WEEK) return { current: "Tuần này", previous: "Tuần trước", caption: "so với tuần trước" };
    if (period === REPORT_PERIODS.MONTH) {
        const previousMonth = previousRange.from.getMonth() + 1;
        return {
            current: `Tháng ${range.from.getMonth() + 1}`,
            previous: `Tháng ${previousMonth}`,
            caption: `so với cùng kỳ tháng ${previousMonth}`,
        };
    }
    const previousYear = previousRange.from.getFullYear();
    return { current: `Năm ${range.from.getFullYear()}`, previous: `Năm ${previousYear}`, caption: `so với cùng kỳ ${previousYear}` };
};

// Offset (for getReport) of the day / month / year that contains dateOnly ("2026-10-18").
export const getReportOffset = (period, dateOnly) => {
    const [year, month, day] = dateOnly.split("-").map(Number);
    const today = startOfDay(new Date());
    if (period === REPORT_PERIODS.YEAR) return year - today.getFullYear();
    if (period === REPORT_PERIODS.MONTH) return (year - today.getFullYear()) * 12 + month - 1 - today.getMonth();
    return Math.round((new Date(year, month - 1, day) - today) / DAY_MS);
};

const percentChange = (current, previous) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);

// ----- backend calls -----

// Any failed call fails the whole report, so the page never shows a mix of real and missing numbers.
class ReportError extends Error {
    constructor(result) {
        super(result.message);
        this.result = result;
    }
}

const unwrap = async (request) => {
    const result = await call(request);
    if (!result.success) throw new ReportError(result);
    return result.data;
};

const dateParams = (from, to) => ({ from: toDateOnly(from), to: toDateOnly(to) });

const getOverview = (from, to) => unwrap(() => api.get("/api/invoice-reports/overview", { params: dateParams(from, to) }));

const getRevenueDays = async (from, to) => {
    const data = await unwrap(() => api.get("/api/invoice-reports/revenue-by-day", { params: dateParams(from, to) }));
    return new Map(data.days.map((day) => [day.date, Number(day.total)]));
};

const countAppointments = async (from, to, status) => {
    const data = await unwrap(() =>
        api.get("/api/Appointments", { params: { fromDate: toDateOnly(from), toDate: toDateOnly(to), status, pageSize: 1 } }),
    );
    return data.totalCount ?? 0;
};

const getDebts = () => unwrap(() => api.get("/api/debts", { params: { pageSize: DEBT_PREVIEW_COUNT } }));

// ----- report parts -----

// One overview call for a range, or nothing (zeros) when the range has not started yet.
const overviewOrEmpty = (from, to) =>
    from > to ? Promise.resolve({ confirmedCollectionsTotal: 0, newInvoiceCount: 0, totalsByMethod: [] }) : getOverview(from, to);

const revenueByMethod = (overview) =>
    PAYMENT_METHOD_GROUPS.map(({ label, methods }) => ({
        label,
        value: toMillion(
            overview.totalsByMethod.filter((item) => methods.includes(item.paymentMethod)).reduce((sum, item) => sum + Number(item.amount), 0),
        ),
    }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);

const debtNote = (item) => {
    if (item.overdueCount > 0) return `Trả góp · quá hạn ${item.overdueCount} kỳ`;
    if (item.hasInstallmentPlan) return "Trả góp";
    return `${item.ageDays} ngày chưa thanh toán đủ`;
};

const toDebts = (data) => ({
    total: Number(data.totalRemaining ?? 0),
    invoiceCount: data.totalCount ?? 0,
    items: data.items.map((item) => ({
        invoiceCode: item.invoiceNumber,
        patientName: item.patientName,
        note: debtNote(item),
        remaining: Number(item.remainingAmount),
    })),
});

// Chart bars; days after today have no data yet (value null). previous = the matching bar of the compared period.
// date = the day / month a bar opens.
const buildBars = async (period, range, previousRange, today) => {
    if (period === REPORT_PERIODS.DAY) {
        // The 7 days up to the chosen one, the chosen day in full colour
        const from = addDays(range.from, -(DAY_CHART_DAYS - 1));
        const revenue = await getRevenueDays(from, range.from);
        return daysBetween(from, range.from).map((day) => ({
            label: WEEKDAYS_SHORT[day.getDay()],
            sublabel: `${pad(day.getDate())}/${pad(day.getMonth() + 1)}`,
            value: toMillion(revenue.get(toDateOnly(day)) ?? 0),
            muted: day < range.from,
            date: toDateOnly(day),
        }));
    }

    if (period === REPORT_PERIODS.WEEK || period === REPORT_PERIODS.MONTH) {
        const week = period === REPORT_PERIODS.WEEK;
        const elapsedTo = minDate(range.to, today);
        const [revenue, previousRevenue] = await Promise.all([
            range.from <= elapsedTo ? getRevenueDays(range.from, elapsedTo) : new Map(),
            getRevenueDays(previousRange.from, previousRange.to),
        ]);
        const previousDays = daysBetween(previousRange.from, previousRange.to);
        return daysBetween(range.from, range.to).map((day, index) => ({
            label: week ? WEEKDAYS_SHORT[day.getDay()] : String(day.getDate()),
            sublabel: week ? `${pad(day.getDate())}/${pad(day.getMonth() + 1)}` : undefined,
            value: day <= today ? toMillion(revenue.get(toDateOnly(day)) ?? 0) : null,
            // A shorter previous month has no matching day.
            previous: previousDays[index] ? toMillion(previousRevenue.get(toDateOnly(previousDays[index])) ?? 0) : null,
            date: toDateOnly(day),
        }));
    }

    // Year: one overview call per month (revenue-by-day stops at 31 days), months after today stay empty
    const year = range.from.getFullYear();
    const previousYear = previousRange.from.getFullYear();
    const months = Array.from({ length: 12 }, (_, month) => month);
    const [current, previous] = await Promise.all([
        Promise.all(
            months.map((month) => {
                const from = new Date(year, month, 1);
                return from > today ? null : getOverview(from, minDate(new Date(year, month + 1, 0), today));
            }),
        ),
        Promise.all(months.map((month) => getOverview(new Date(previousYear, month, 1), new Date(previousYear, month + 1, 0)))),
    ]);
    return months.map((month) => ({
        label: `Th${month + 1}`,
        value: current[month] ? toMillion(current[month].confirmedCollectionsTotal) : null,
        previous: toMillion(previous[month].confirmedCollectionsTotal),
        date: toDateOnly(new Date(year, month, 1)),
    }));
};

// Report of one period. offset: 0 = the current period, -1 = the one before, ...
// Changes compare with the same number of days at the start of the previous period, so a week in progress is fair.
export const getReport = async ({ period = REPORT_PERIODS.WEEK, offset = 0 } = {}) => {
    const now = new Date();
    const today = startOfDay(now);
    const range = getRange(period, offset, today);
    const elapsedTo = minDate(range.to, today);
    const elapsedDays = Math.max(0, Math.round((elapsedTo - range.from) / DAY_MS) + 1);
    const previousRange = getPreviousRange(period, offset, today);
    const previousTo = minDate(addDays(previousRange.from, Math.max(elapsedDays, 1) - 1), previousRange.to);

    try {
        const [overview, previousOverview, visits, previousVisits, appointmentTotal, cancelled, noShow, debts, revenueBars] = await Promise.all([
            overviewOrEmpty(range.from, elapsedTo),
            overviewOrEmpty(previousRange.from, previousTo),
            countAppointments(range.from, elapsedTo, APPOINTMENT_STATUS.COMPLETED),
            countAppointments(previousRange.from, previousTo, APPOINTMENT_STATUS.COMPLETED),
            countAppointments(range.from, range.to),
            countAppointments(range.from, range.to, APPOINTMENT_STATUS.CANCELLED),
            countAppointments(range.from, range.to, APPOINTMENT_STATUS.NO_SHOW),
            getDebts(),
            buildBars(period, range, previousRange, today),
        ]);

        const revenue = toMillion(overview.confirmedCollectionsTotal);
        const previousRevenue = toMillion(previousOverview.confirmedCollectionsTotal);

        return {
            success: true,
            message: null,
            errors: null,
            data: {
                period,
                from: toDateOnly(range.from),
                to: toDateOnly(range.to),
                label: rangeLabel(period, range),
                updatedAt: now.toISOString(),
                comparison: comparisonLabels(period, range, previousRange),
                revenue: { value: revenue, change: percentChange(revenue, previousRevenue) },
                visits: { value: visits, change: percentChange(visits, previousVisits) },
                newInvoices: { value: overview.newInvoiceCount, change: overview.newInvoiceCount - previousOverview.newInvoiceCount },
                appointments: { total: appointmentTotal, completed: visits, cancelled, noShow },
                debts: toDebts(debts),
                revenueBars,
                revenueByMethod: revenueByMethod(overview),
            },
        };
    } catch (error) {
        if (error instanceof ReportError) return error.result;
        throw error;
    }
};

export const getPendingRequests = async () => {
    const leaves = (await pendingLeaveRequests()).map((request) => ({
        id: request.id,
        type: REQUEST_TYPES.LEAVE,
        senderName: request.senderName,
        senderDetail: request.senderRole,
        content: `${formatDate(request.date)} · ${leaveSlotLabel(request.slot)} · ${request.reason}`,
        submittedAt: request.submittedAt,
    }));
    const refunds = (await pendingRefundRequests()).map((request) => ({
        id: request.id,
        type: REQUEST_TYPES.REFUND,
        senderName: request.patientName,
        senderDetail: request.patientCode,
        content: `${request.invoiceNumber} · ${request.reason}`,
        submittedAt: request.createdAt,
    }));
    return { success: true, message: null, data: [...leaves, ...refunds], errors: null };
};

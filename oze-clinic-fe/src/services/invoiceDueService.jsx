import api from "./api";
import { call } from "./receptionService";
import { getClinicToday } from "../utils/format";
import { BOOKING_ERROR_CODE } from "../utils/messages";

const READ = { skipErrorPage: true };

const PAGE_SIZE = 100;

const PLAN_REQUESTS_AT_ONCE = 6;

const CANCELLED = "CANCELLED";

const PERIOD_PENDING = "Pending";

const PERIOD_OVERDUE = "Overdue";

const NOT_FOUND = 404;

const success = (data) => ({ success: true, message: null, data, code: null });

const failure = (code = null) => ({ success: false, message: null, data: null, code });

const loadPage = (pageNumber) => call(() => api.get("/api/invoices/my", { ...READ, params: { PageNumber: pageNumber, PageSize: PAGE_SIZE } }));

const loadInvoices = async () => {
    const items = [];
    for (let pageNumber = 1; ; pageNumber++) {
        const result = await loadPage(pageNumber);
        if (!result.success) return { failed: true, unlinked: result.status === NOT_FOUND };
        const rows = result.data?.items ?? [];
        items.push(...rows);
        if (!rows.length || items.length >= (result.data?.totalCount ?? 0)) return { failed: false, items };
    }
};

const toDue = (invoice, plan, today) => {
    const remaining = Number(invoice.remainingAmount) || 0;
    const periods = plan?.periods ?? [];
    const notYetDue = periods.filter((period) => period.status === PERIOD_PENDING && period.dueDate > today).reduce((sum, period) => sum + (Number(period.amount) || 0), 0);
    return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber ?? "",
        appointmentId: invoice.appointmentId ?? null,
        paymentStatus: invoice.paymentStatus,
        createdAt: invoice.createdAt ?? "",
        due: Math.max(0, remaining - notYetDue),
        overdue: periods.some((period) => period.status === PERIOD_OVERDUE),
    };
};

const loadPlans = async (invoices) => {
    const plans = new Array(invoices.length);
    let next = 0;
    let broken = false;
    const worker = async () => {
        while (next < invoices.length && !broken) {
            const index = next++;
            const result = await call(() => api.get(`/api/invoices/${invoices[index].id}/installment-plan`, READ));
            if (result.success) plans[index] = result.data;
            else if (result.status === NOT_FOUND) plans[index] = null;
            else broken = true;
        }
    };
    await Promise.all(Array.from({ length: Math.min(PLAN_REQUESTS_AT_ONCE, invoices.length) }, worker));
    return broken ? null : plans;
};

export const getMyDues = async () => {
    const loaded = await loadInvoices();
    if (loaded.failed) return failure(loaded.unlinked ? BOOKING_ERROR_CODE.PROFILE_NOT_FOUND : null);
    const open = loaded.items.filter((invoice) => invoice.paymentStatus !== CANCELLED && !invoice.cancelledAt && (Number(invoice.remainingAmount) || 0) > 0);
    const plans = await loadPlans(open);
    if (!plans) return failure();
    const today = getClinicToday();
    const items = open.map((invoice, index) => toDue(invoice, plans[index], today)).filter((item) => item.due > 0);
    return success({ items, total: items.reduce((sum, item) => sum + item.due, 0) });
};

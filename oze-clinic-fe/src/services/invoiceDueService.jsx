import { getMyAccounts } from "./patientBillingService";
import { PAYMENT_STATUS } from "../utils/messages";

const ONCE = "ONCE";

const toNumber = (value) => Number(value) || 0;

const toDue = (account) => ({
    id: account.invoiceId,
    debtId: account.key,
    invoiceNumber: account.invoiceNumber ?? "",
    paymentStatus: toNumber(account.paidAmount) > 0 ? PAYMENT_STATUS.PARTIALLY_PAID : PAYMENT_STATUS.UNPAID,
    createdAt: account.startedOn ?? "",
    visitDate: account.paymentMode === ONCE ? (account.startedOn ?? null) : null,
    due: toNumber(account.dueAmount),
    overdue: Boolean(account.hasOverdue),
});

export const getMyDues = async () => {
    const result = await getMyAccounts();
    if (!result.success) return result;
    const items = result.data.map(toDue).filter((item) => item.due > 0);
    return { success: true, message: null, data: { items, total: items.reduce((sum, item) => sum + item.due, 0) }, code: null };
};

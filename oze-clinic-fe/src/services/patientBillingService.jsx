import api from "./api";
import { call } from "./receptionService";
import { BOOKING_ERROR_CODE } from "../utils/messages";
import { toDebtItem } from "../utils/patientDebt";
import { toPayerProfile, withRemainAll, toReceipt } from "../utils/paymentHistory";

const READ = { skipErrorPage: true };

const NOT_FOUND = 404;

const success = (data) => ({ success: true, message: null, data, code: null });

const failure = (code = null) => ({ success: false, message: null, data: null, code });

const failed = (result) => failure(result.status === NOT_FOUND ? BOOKING_ERROR_CODE.PROFILE_NOT_FOUND : null);

const abortError = () => new DOMException("Aborted", "AbortError");

const loadAccounts = (signal) => call(() => api.get("/api/invoices/my/accounts", { ...READ, signal }));

export const getMyAccounts = async ({ signal } = {}) => {
    const result = await loadAccounts(signal);
    if (signal?.aborted) throw abortError();
    if (!result.success) return failed(result);
    return success(Array.isArray(result.data) ? result.data : []);
};

export const getMyDebtAccounts = async ({ signal } = {}) => {
    const result = await getMyAccounts({ signal });
    return result.success ? success({ items: result.data.map(toDebtItem) }) : result;
};

export const getMyPaymentReceipts = async ({ signal } = {}) => {
    const [details, me] = await Promise.all([
        call(() => api.get("/api/invoices/my/details", { ...READ, signal })),
        call(() => api.get("/api/me", { ...READ, signal })),
    ]);
    if (signal?.aborted) throw abortError();
    if (!details.success) return failed(details);
    const profile = toPayerProfile(me.success ? me.data : null);
    const invoices = Array.isArray(details.data) ? details.data : [];
    return success({ items: withRemainAll(invoices.map((invoice) => toReceipt(invoice, profile.name))), profile });
};

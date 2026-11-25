import api from "./api";
import { call } from "./receptionService";

// Receptionist cash drawer hand-over (api/cash-sessions). Every call returns { success, message, data, errors }.

export const EXPENSE_CATEGORIES = [
    { value: "Supplies", label: "Vật tư" },
    { value: "Other", label: "Chi phí khác" },
];

export const expenseCategoryLabel = (value) => EXPENSE_CATEGORIES.find((option) => option.value === value)?.label ?? value;

// data is null when the receptionist has no open drawer
export const getCurrentCashSession = (config = {}) => call(() => api.get("/api/cash-sessions/current", config));

export const openCashSession = ({ openingCash, expectedOpeningCash, notes }) =>
    call(() => api.post("/api/cash-sessions/open", { openingCash, expectedOpeningCash, notes: notes || null }));

export const getNextCashShift = (config = {}) => call(() => api.get("/api/cash-sessions/next-shift", config));

export const addCashExpense = ({ amount, category, description }) =>
    call(() => api.post("/api/cash-sessions/current/expenses", { amount, category, description }));

export const removeCashExpense = (expenseId) => call(() => api.delete(`/api/cash-sessions/current/expenses/${expenseId}`));

// Codes of a refused close (409): another session, or the system figures changed while counting
export const CLOSE_CONFLICT = { SESSION_CHANGED: "SESSION_CHANGED", FIGURES_CHANGED: "FIGURES_CHANGED" };

// sessionId and the system figures the cashier saw go along so the backend can refuse a close of another session
// or one whose figures changed meanwhile.
export const closeCashSession = ({ sessionId, countedCash, countedTransfer, denominations, notes, expectedCash, expectedTransfer }, config = {}) =>
    call(() =>
        api.post(
            "/api/cash-sessions/current/close",
            { sessionId, countedCash, countedTransfer: countedTransfer ?? null, denominations: denominations ?? null, notes: notes || null, expectedCash, expectedTransfer },
            config,
        ),
    );

export const getHandoverCandidates = () => call(() => api.get("/api/cash-sessions/handover-candidates"));

export const getCashSessions = ({ fromDate, toDate, status, openedByUserId, page = 1, pageSize = 10 } = {}, config = {}) =>
    call(() =>
        api.get("/api/cash-sessions", {
            ...config,
            params: { fromDate, toDate, status: status || undefined, openedByUserId: openedByUserId || undefined, pageNumber: page, pageSize },
        }),
    );

export const getCashSession = (id, config = {}) => call(() => api.get(`/api/cash-sessions/${id}`, config));

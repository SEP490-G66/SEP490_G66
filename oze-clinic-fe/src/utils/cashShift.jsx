export const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

// The handover slip only shows what the system recorded: collections and refunds (no expenses, by decision).
export const KINDS = ["Receipt", "Refund"];

const OUTGOING = new Set(["Refund"]);

// A number from the API, or 0 when it is missing or not a number.
const amountOf = (value) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
};

const ZONE = "Asia/Ho_Chi_Minh";

const validDate = (moment) => {
    if (!moment) return null;
    const date = new Date(moment);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const dateKey = (moment) => {
    const date = validDate(moment);
    return date ? new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(date) : "";
};

export const timeOf = (moment) => {
    const date = validDate(moment);
    return date ? date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONE }) : "";
};

export const dateTimeOf = (moment) => (moment ? `${dateKey(moment).split("-").reverse().join("/")} ${timeOf(moment)}` : "");

// Up to 12 digits (under 1 000 tỷ): anything longer is a slip of the keyboard, not cash in a drawer.
const MAX_DIGITS = 12;

export const parseMoney = (text) => {
    const digits = String(text ?? "").replace(/\D/g, "").slice(0, MAX_DIGITS);
    return digits ? Number(digits) : null;
};

export const formatMoneyInput = (text) => {
    const value = parseMoney(text);
    return value == null ? "" : value.toLocaleString("vi-VN");
};

export const shiftTypeOf = (session) => {
    if (session.shiftType === "Morning" || session.shiftType === "Afternoon") return session.shiftType;
    const hour = Number(timeOf(session.openedAt).slice(0, 2));
    return hour && hour >= 12 ? "Afternoon" : "Morning";
};

const fromLegacy = (session) => [
    ...(session.payments ?? []).map((p) => ({
        id: `p${p.paymentId}`,
        occurredAt: p.paidAt,
        code: p.invoiceNumber,
        kind: "Receipt",
        description: p.patientName,
        cashAmount: String(p.paymentMethod ?? "").toUpperCase() === "CASH" ? p.amount : 0,
        transferAmount: String(p.paymentMethod ?? "").toUpperCase() === "CASH" ? 0 : p.amount,
    })),
    // Approved refunds paid out in cash from this drawer
    ...(session.refunds ?? []).map((r) => ({
        id: `r${r.refundRequestId}`,
        occurredAt: r.paidOutAt,
        code: r.invoiceNumber,
        kind: "Refund",
        description: r.patientName,
        cashAmount: r.amount,
        transferAmount: 0,
    })),
];

// Amounts are kept positive: the kind gives the direction, so a refund the API already sends as negative is not flipped twice.
export const transactionsOf = (session) =>
    (session.transactions ?? fromLegacy(session)).map((t) => ({ ...t, cashAmount: Math.abs(amountOf(t.cashAmount)), transferAmount: Math.abs(amountOf(t.transferAmount)) }));

export const signOf = (kind) => (OUTGOING.has(kind) ? -1 : 1);

export const methodOf = (t) => (t.cashAmount && t.transferAmount ? "mix" : t.cashAmount ? "cash" : t.transferAmount ? "transfer" : "none");

export const summarize = (transactions) => {
    const rows = Object.fromEntries(KINDS.map((k) => [k, { count: 0, cash: 0, transfer: 0 }]));
    const net = { cash: 0, transfer: 0 };
    transactions.forEach((t) => {
        const row = rows[t.kind];
        if (!row) return;
        row.count += 1;
        row.cash += t.cashAmount;
        row.transfer += t.transferAmount;
        net.cash += signOf(t.kind) * t.cashAmount;
        net.transfer += signOf(t.kind) * t.transferAmount;
    });
    return { rows, net, count: Object.values(rows).reduce((sum, row) => sum + row.count, 0) };
};

export const systemTotals = (session, summary) => ({
    cash: session.expectedCash != null ? amountOf(session.expectedCash) : amountOf(session.openingCash) + summary.net.cash,
    transfer: session.expectedTransfer != null ? amountOf(session.expectedTransfer) : summary.net.transfer,
});

// null while no note count has been typed, so "counted by note" cannot pass as 0 ₫ counted
export const denominationTotal = (counts) =>
    DENOMINATIONS.some((note) => counts[note] !== undefined && counts[note] !== "")
        ? DENOMINATIONS.reduce((sum, note) => sum + note * (Number(counts[note]) || 0), 0)
        : null;

export const isOpen = (session) => String(session?.status ?? "").toLowerCase() === "open";

const vnd = (value) => `${Number(value ?? 0).toLocaleString("vi-VN")} ₫`;

export const signedMoney = (value) => (!value ? vnd(0) : value < 0 ? <span className="text-danger">−{vnd(-value)}</span> : vnd(value));

const typeOfStart = (start) => (start && start < "12:00" ? "Morning" : "Afternoon");

const minutesOf = (hhmm) => {
    const [h, m] = String(hhmm ?? "").split(":").map(Number);
    return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : null;
};

// Start and end of a work shift in minutes; a shift that ends at or past midnight ends on the next day (+24h).
const spanOf = (shift) => {
    const start = minutesOf(shift?.shiftStart);
    let end = minutesOf(shift?.shiftEnd);
    if (start == null || end == null) return null;
    if (end <= start) end += 24 * 60;
    return { start, end };
};

// True while the shift has not ended yet at "HH:mm" now (a shift past midnight counts as still running).
export const shiftNotOver = (shift, now) => {
    const span = spanOf(shift);
    const at = minutesOf(now);
    if (!span || at == null) return false;
    return at < span.end || (span.end > 24 * 60 && at < span.end - 24 * 60);
};

// myShift: today's work shift of the signed-in user (api/schedules/my), used when the server has no plan
export const openingPlan = ({ next, lastClosed, myShift, now, staff, labels, sourceDay, sourcePrev }) => {
    const myFrom = myShift?.shiftStart?.slice(0, 5);
    const myTo = myShift?.shiftEnd?.slice(0, 5);
    if (next) {
        const from = next.shiftStart?.slice(0, 5) ?? myFrom;
        return {
            label: labels[next.shiftType] ?? labels[typeOfStart(from ?? now)],
            staff: next.staffName ?? staff,
            from,
            to: next.shiftEnd?.slice(0, 5) ?? myTo,
            now,
            amount: amountOf(next.expectedOpeningCash),
            source: next.previousClosedAt != null ? sourcePrev(next.previousClosedByName, timeOf(next.previousClosedAt)) : sourceDay,
        };
    }
    return {
        label: labels[typeOfStart(myFrom ?? now)],
        staff,
        from: myFrom,
        to: myTo,
        now,
        amount: amountOf(lastClosed?.countedCash),
        source: lastClosed ? sourcePrev(lastClosed.closedByName ?? lastClosed.openedByName, timeOf(lastClosed.closedAt)) : sourceDay,
    };
};

// End of the shift a session belongs to: the session's own value, else the user's work shift that was running when it opened
export const shiftEndOf = (session, myShifts) => {
    if (session.shiftEnd) return String(session.shiftEnd).slice(0, 5);
    const opened = minutesOf(timeOf(session.openedAt));
    if (opened == null) return null;
    const match =
        myShifts.find((x) => {
            const span = spanOf(x);
            return span && span.start <= opened && opened < span.end;
        }) ?? myShifts.find((x) => shiftNotOver(x, timeOf(session.openedAt)));
    return match?.shiftEnd?.slice(0, 5) ?? null;
};

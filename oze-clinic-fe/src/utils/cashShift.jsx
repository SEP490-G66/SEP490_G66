export const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

export const KINDS = ["Receipt", "Expense", "Refund"];

const OUTGOING = new Set(["Expense", "Refund"]);

const ZONE = "Asia/Ho_Chi_Minh";

export const dateKey = (moment) => (moment ? new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date(moment)) : "");

export const timeOf = (moment) =>
    moment ? new Date(moment).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONE }) : "";

export const dateTimeOf = (moment) => (moment ? `${dateKey(moment).split("-").reverse().join("/")} ${timeOf(moment)}` : "");

export const parseMoney = (text) => {
    const digits = String(text ?? "").replace(/\D/g, "");
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
        cashAmount: p.paymentMethod === "CASH" ? p.amount : 0,
        transferAmount: p.paymentMethod === "CASH" ? 0 : p.amount,
    })),
    ...(session.expenses ?? []).map((x) => ({ id: `e${x.id}`, occurredAt: x.createdAt, code: x.code, kind: "Expense", description: x.description, cashAmount: x.amount, transferAmount: 0 })),
];

export const transactionsOf = (session) =>
    (session.transactions ?? fromLegacy(session)).map((t) => ({ ...t, cashAmount: Number(t.cashAmount ?? 0), transferAmount: Number(t.transferAmount ?? 0) }));

export const signOf = (kind) => (OUTGOING.has(kind) ? -1 : 1);

export const methodOf = (t) => (t.cashAmount && t.transferAmount ? "mix" : t.cashAmount ? "cash" : "transfer");

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
    return { rows, net, count: transactions.length };
};

export const systemTotals = (session, summary) => ({
    cash: session.expectedCash ?? Number(session.openingCash ?? 0) + summary.net.cash,
    transfer: session.expectedTransfer ?? summary.net.transfer,
});

export const denominationTotal = (counts) => DENOMINATIONS.reduce((sum, note) => sum + note * (Number(counts[note]) || 0), 0);

export const isOpen = (session) => session.status === "Open";

const vnd = (value) => `${Number(value ?? 0).toLocaleString("vi-VN")} ₫`;

export const signedMoney = (value) => (!value ? vnd(0) : value < 0 ? <span className="text-danger">−{vnd(-value)}</span> : vnd(value));

const SHIFT_HOURS = { Morning: ["07:30", "12:00"], Afternoon: ["13:00", "17:30"] };

export const shiftHours = (type) => SHIFT_HOURS[type] ?? [];

export const openingPlan = ({ next, lastClosed, now, staff, labels, sourceDay, sourcePrev }) => {
    if (next) {
        const type = next.shiftType ?? (now >= "12:00" ? "Afternoon" : "Morning");
        const [from, to] = [next.shiftStart?.slice(0, 5) ?? shiftHours(type)[0], next.shiftEnd?.slice(0, 5) ?? shiftHours(type)[1]];
        const fromPrev = next.previousClosedAt != null;
        return {
            label: labels[type],
            staff: next.staffName ?? staff,
            from,
            to,
            now,
            amount: Number(next.expectedOpeningCash ?? 0),
            source: fromPrev ? sourcePrev(next.previousClosedByName, timeOf(next.previousClosedAt)) : sourceDay,
        };
    }
    const type = lastClosed ? "Afternoon" : "Morning";
    const [from, to] = shiftHours(type);
    return {
        label: labels[type],
        staff,
        from,
        to,
        now,
        amount: Number(lastClosed?.countedCash ?? 0),
        source: lastClosed ? sourcePrev(lastClosed.closedByName ?? lastClosed.openedByName, timeOf(lastClosed.closedAt)) : sourceDay,
    };
};

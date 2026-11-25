export const RECON_RESULT = { MATCH: "match", MISMATCH: "mismatch", PENDING: "pending", NOT_CHECKED: "notChecked" };

export const RECON_ISSUE = { SHORT: "short", OVER: "over", OUTSIDE: "outside" };

export const RECON_NOTE = { OPEN: "open", REFUND: "refund", PENDING: "pending", DAY: "day" };

const num = (value) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
};

export const pendingOf = (data) => ({
    count: num(data.pendingTransferCount ?? (Array.isArray(data.pendingTransfers) ? data.pendingTransfers.length : 0)),
    amount: num(data.pendingTransferAmount),
});

export const reconcile = (data) => {
    const openCount = num(data.openSessionCount);
    const pending = pendingOf(data);
    const difference = num(data.cashDifference);
    const outside = num(data.cashOutsideSessions);

    const issues = [];
    if (difference < 0) issues.push({ kind: RECON_ISSUE.SHORT, amount: -difference });
    if (difference > 0) issues.push({ kind: RECON_ISSUE.OVER, amount: difference });
    if (outside > 0) issues.push({ kind: RECON_ISSUE.OUTSIDE, amount: outside });

    const cashResult = openCount > 0 ? RECON_RESULT.NOT_CHECKED : issues.length ? RECON_RESULT.MISMATCH : RECON_RESULT.MATCH;
    const transferResult = openCount > 0 ? RECON_RESULT.NOT_CHECKED : pending.count > 0 ? RECON_RESULT.PENDING : RECON_RESULT.MATCH;

    const notes = [];
    if (openCount > 0) notes.push(RECON_NOTE.OPEN);
    if (cashResult === RECON_RESULT.MISMATCH && num(data.refundTotal) > 0) notes.push(RECON_NOTE.REFUND);
    if (pending.count > 0) notes.push(RECON_NOTE.PENDING);
    notes.push(RECON_NOTE.DAY);

    return {
        openCount,
        pending,
        confirmed: Boolean(data.isConfirmed),
        cash: {
            system: num(data.cashExpected),
            collected: num(data.cashCollected),
            counted: openCount > 0 ? null : num(data.cashCounted),
            result: cashResult,
            issues: cashResult === RECON_RESULT.MISMATCH ? issues : [],
        },
        transfer: {
            system: num(data.transferConfirmed),
            result: transferResult,
        },
        notes,
    };
};

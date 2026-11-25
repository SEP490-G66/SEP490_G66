// Money rules of the cashier pages (Thanh toán, Đặt cọc dịch vụ, Thanh toán theo đợt, Ghi nhận thu tiền).
// Pure functions only: the same rules run on the mock data now and can check the API answers later.
// A "plan" is a treatment plan; each "period" (đợt) is one treatment session of it. Amounts are whole đồng.
//
// Two ways of counting money:
//   paid  = lines of CONFIRMED receipts -> debts, statuses and the numbers shown;
//   held  = lines of CONFIRMED or PENDING receipts -> the ceiling (most that may still be collected), so nothing is
//           collected twice while a transfer waits for confirmation.

export const OPTION = { FULL: "FULL", PERIODS: "PERIODS", DEPOSIT: "DEPOSIT" };
export const METHOD = { CASH: "CASH", BANK_TRANSFER: "BANK_TRANSFER", QR_TRANSFER: "QR_TRANSFER" };
export const METHODS = Object.values(METHOD);
export const PAY_METHODS = [METHOD.CASH, METHOD.BANK_TRANSFER];
export const RECEIPT_STATUS = { CONFIRMED: "CONFIRMED", PENDING: "PENDING", REJECTED: "REJECTED" };
export const LINE = { DEPOSIT: "DEPOSIT", FULL: "FULL", PERIOD: "PERIOD", VISIT_SERVICE: "VISIT_SERVICE" };
export const PERIOD_STATUS = {
    NOT_YET: "NOT_YET",
    PAID: "PAID",
    WAIT_FULL: "WAIT_FULL",
    PENDING: "PENDING",
    PARTIAL: "PARTIAL",
    DUE: "DUE",
};
// In the order the status column picks the first one that applies
export const PATIENT_STATUS = { OWED: "OWED", PENDING: "PENDING", REFUND: "REFUND", UPCOMING: "UPCOMING", SETTLED: "SETTLED" };
export const PATIENT_STATUS_ORDER = Object.values(PATIENT_STATUS);
// Loại on the Ghi nhận thu tiền picker
export const COLLECT_KIND = { VISIT: "VISIT", PLAN: "PLAN" };
export const ACTION = { CHOOSE: "CHOOSE", DEPOSIT: "DEPOSIT", FULL: "FULL", COLLECT: "COLLECT", VIEW: "VIEW" };

const bySeq = (a, b) => a.seq - b.seq;
const sum = (list, pick = (x) => x) => list.reduce((total, item) => total + pick(item), 0);

// Cash method -> confirmed at once; transfer and QR wait for the cashier to see the money arrive.
export const receiptStatusOf = (method) => (method === METHOD.CASH ? RECEIPT_STATUS.CONFIRMED : RECEIPT_STATUS.PENDING);

// Whole đồng from what was typed: "4.000.000", "4,000,000 ₫" -> 4000000. Empty or no digit -> 0.
export const parseMoney = (text) => {
    const digits = String(text ?? "").replace(/\D/g, "");
    return digits ? Number(digits) : 0;
};

export const depositRequiredOf = (plan) => (plan.option === OPTION.DEPOSIT && plan.depositRate > 0 ? Math.round(plan.planPrice * plan.depositRate) : 0);

// Lines of the receipts in the given statuses, flattened with the receipt they belong to
const linesOf = (receipts, statuses) =>
    receipts.filter((r) => statuses.includes(r.status)).flatMap((r) => r.lines.map((line) => ({ ...line, receiptId: r.id, status: r.status })));

const PAID = [RECEIPT_STATUS.CONFIRMED];
const HELD = [RECEIPT_STATUS.CONFIRMED, RECEIPT_STATUS.PENDING];

const planTotals = (plan, lines) => {
    const own = lines.filter((l) => l.planId === plan.id);
    const periodPaid = new Map();
    own.filter((l) => l.kind === LINE.PERIOD).forEach((l) => periodPaid.set(l.periodId, (periodPaid.get(l.periodId) ?? 0) + l.amount));
    return {
        full: sum(own.filter((l) => l.kind === LINE.FULL), (l) => l.amount),
        deposit: sum(own.filter((l) => l.kind === LINE.DEPOSIT), (l) => l.amount),
        periodPaid,
    };
};

// E2: where the money of a plan lands, period by period.
// Pass 1: FULL money covers planAmount of every period by seq (finished or not), never the extra part.
// Pass 2, finished periods only, by seq: PERIOD lines, then the deposit; plan part first, then the extra part.
// On a FULL plan the PERIOD lines only pay the extra part (the plan part is paid through "Thu toàn bộ").
export const allocatePlan = (plan, totals) => {
    let fullLeft = plan.option === OPTION.FULL ? totals.full : 0;
    let depositLeft = plan.option === OPTION.DEPOSIT ? totals.deposit : 0;
    const periods = [...plan.periods].sort(bySeq);
    const covered = periods.map((p) => {
        const cover = Math.min(fullLeft, p.planAmount);
        fullLeft -= cover;
        return cover;
    });
    let depositUsed = 0;
    const rows = periods.map((p, index) => {
        const cover = covered[index];
        let planDue = p.planAmount - cover;
        let extraDue = p.extraAmount;
        let paidPlan = 0;
        let paidExtra = 0;
        let depositPlan = 0;
        let depositExtra = 0;
        if (p.finished) {
            const paid = totals.periodPaid.get(p.id) ?? 0;
            if (plan.option === OPTION.FULL) {
                paidExtra = Math.min(paid, extraDue);
            } else {
                paidPlan = Math.min(paid, planDue);
                paidExtra = Math.min(paid - paidPlan, extraDue);
            }
            planDue -= paidPlan;
            extraDue -= paidExtra;
            const use = Math.min(depositLeft, planDue + extraDue);
            depositPlan = Math.min(use, planDue);
            depositExtra = use - depositPlan;
            depositLeft -= use;
            depositUsed += use;
            planDue -= depositPlan;
            extraDue -= depositExtra;
        }
        return { period: p, cover, paidPlan, paidExtra, depositPlan, depositExtra, planDue, extraDue };
    });
    return { rows, depositUsed };
};

const periodStatus = ({ period, due, part, ceiling, moneyIn }) => {
    if (!period.finished) return PERIOD_STATUS.NOT_YET;
    if (due === 0) return PERIOD_STATUS.PAID;
    if (part.isFull && part.extraDue === 0) return PERIOD_STATUS.WAIT_FULL;
    if (part.value > 0 && ceiling === 0) return PERIOD_STATUS.PENDING;
    if (moneyIn) return PERIOD_STATUS.PARTIAL;
    return PERIOD_STATUS.DUE;
};

// Everything the pages show about one plan, from the plan and all receipts of its patient
export const computePlan = (plan, receipts) => {
    const isFull = plan.option === OPTION.FULL;
    const isDeposit = plan.option === OPTION.DEPOSIT;
    const paidLines = linesOf(receipts, PAID);
    const heldLines = linesOf(receipts, HELD);
    const paid = planTotals(plan, paidLines);
    const held = planTotals(plan, heldLines);
    const paidAlloc = allocatePlan(plan, paid);
    const heldAlloc = allocatePlan(plan, held);
    const pendingLines = linesOf(receipts, [RECEIPT_STATUS.PENDING]).filter((l) => l.planId === plan.id);

    const periods = paidAlloc.rows.map((row, index) => {
        const heldRow = heldAlloc.rows[index];
        const due = row.planDue + row.extraDue;
        const value = isFull ? row.extraDue : due;
        const ceiling = Math.max(0, isFull ? heldRow.extraDue : heldRow.planDue + heldRow.extraDue);
        const moneyIn = row.cover > 0 || row.paidPlan + row.paidExtra > 0 || row.depositPlan + row.depositExtra > 0;
        const collectable = plan.option !== null && row.period.finished && ceiling > 0;
        return {
            ...row.period,
            amount: row.period.planAmount + row.period.extraAmount,
            fullCover: row.cover,
            paid: row.paidPlan + row.paidExtra,
            deposit: row.depositPlan + row.depositExtra,
            planDue: row.planDue,
            extraDue: row.extraDue,
            due,
            ceiling,
            collectable,
            status: periodStatus({ period: row.period, due, part: { isFull, extraDue: row.extraDue, value }, ceiling, moneyIn }),
        };
    });
    const finished = periods.filter((p) => p.finished);
    const sumDue = sum(finished, (p) => p.due);

    const fullPaid = paid.full;
    const fullDue = isFull ? Math.max(0, plan.planPrice - paid.full) : 0;
    const fullCeiling = isFull ? Math.max(0, plan.planPrice - held.full) : 0;

    const depositRequired = depositRequiredOf(plan);
    const depositPaid = isDeposit ? paid.deposit : 0;
    const depositPending = isDeposit ? held.deposit - paid.deposit : 0;
    const depositUsed = isDeposit ? paidAlloc.depositUsed : 0;
    const depositLeft = depositPaid - depositUsed;
    // Room still left in the periods for more deposit (finished or not), so no one pays a deposit that has nowhere to go
    const periodPaidOf = (totals, p) => Math.min(totals.periodPaid.get(p.id) ?? 0, p.planAmount + p.extraAmount);
    const room = Math.max(0, sum(plan.periods, (p) => p.planAmount + p.extraAmount - periodPaidOf(paid, p)) - depositPaid);
    const roomHeld = Math.max(0, sum(plan.periods, (p) => p.planAmount + p.extraAmount - periodPaidOf(held, p)) - depositPaid - depositPending);
    const depositOwed = isDeposit ? Math.min(Math.max(0, depositRequired - depositPaid), room) : 0;
    const depositToPay = isDeposit ? Math.min(Math.max(0, depositRequired - depositPaid - depositPending), roomHeld) : 0;

    let currentDue = sumDue;
    if (isFull) currentDue = fullDue + sum(finished, (p) => p.extraDue);
    if (isDeposit) currentDue = Math.max(sumDue, depositOwed);
    const sumCeiling = sum(finished, (p) => p.ceiling);
    let currentDueHeld = sumCeiling;
    if (isFull) currentDueHeld = fullCeiling + sumCeiling;
    if (isDeposit) currentDueHeld = Math.max(sumCeiling, depositToPay);

    const allFinished = plan.periods.every((p) => p.finished);
    const refundableDeposit = isDeposit && allFinished && sumDue === 0 && pendingLines.length === 0 ? depositLeft : 0;

    const collectablePeriods = periods.filter((p) => p.collectable);
    let action = ACTION.VIEW;
    if (plan.option === null) action = ACTION.CHOOSE;
    else if (isDeposit && depositToPay > 0) action = ACTION.DEPOSIT;
    else if (isFull && fullCeiling > 0) action = ACTION.FULL;
    else if (collectablePeriods.length) action = ACTION.COLLECT;

    const owedDates = finished.filter((p) => (isFull ? p.extraDue : p.due) > 0 && p.date).map((p) => p.date);
    if (((isFull && fullDue > 0) || (isDeposit && depositOwed > 0)) && plan.optionChosenAt) owedDates.push(plan.optionChosenAt);
    const owedSince = currentDue > 0 && owedDates.length ? owedDates.sort()[0] : null;

    return {
        ...plan,
        periods,
        paidTotal: sum(paidLines.filter((l) => l.planId === plan.id), (l) => l.amount),
        pending: sum(pendingLines, (l) => l.amount),
        reachedAmount: sum(finished, (p) => p.amount),
        fullPaid,
        fullDue,
        fullCeiling,
        depositRequired,
        depositPaid,
        depositPending,
        depositUsed,
        depositLeft,
        depositOwed,
        depositToPay,
        currentDue,
        currentDueHeld,
        refundableDeposit,
        hasUnfinished: !allFinished,
        nextPeriod: collectablePeriods[0] ?? null,
        action,
        owedSince,
    };
};

// One walk-in visit (lượt khám lẻ): its services are listed one by one, but the money is counted for the whole visit.
// amount = what the visit costs (its invoice when it has one); remaining by paid money, ceiling by held money.
export const computeVisit = (visit, receipts) => {
    const own = (statuses) => linesOf(receipts, statuses).filter((l) => l.kind === LINE.VISIT_SERVICE && l.visitId === visit.id);
    const amount = visit.amount ?? sum(visit.services, (s) => s.amount);
    const paid = sum(own(PAID), (l) => l.amount);
    const held = sum(own(HELD), (l) => l.amount);
    const remaining = Math.max(0, amount - paid);
    const date = visit.startAt.slice(0, 10);
    return {
        ...visit,
        date,
        amount,
        paid,
        remaining,
        ceiling: Math.max(0, amount - held),
        owedSince: remaining > 0 && date ? date : null,
    };
};

// E6: one patient with all plans and walk-ins worked out
export const computePatient = (patient, { plans, visits, receipts }, today) => {
    const own = receipts.filter((r) => r.patientId === patient.id);
    const planViews = plans.filter((p) => p.patientId === patient.id).map((p) => computePlan(p, own));
    const visitViews = visits.filter((v) => v.patientId === patient.id).map((v) => computeVisit(v, own));
    const owed = sum(planViews, (p) => p.currentDue) + sum(visitViews, (v) => v.remaining);
    const owedHeld = sum(planViews, (p) => p.currentDueHeld) + sum(visitViews, (v) => v.ceiling);
    const pending = sum(linesOf(own, [RECEIPT_STATUS.PENDING]), (l) => l.amount);
    const refundable = sum(planViews, (p) => p.refundableDeposit);
    const visitDates = [
        ...planViews.flatMap((p) => p.periods.filter((x) => x.finished).map((x) => x.date)),
        ...visitViews.map((v) => v.date),
    ].filter((d) => d <= today);
    const lastVisit = visitDates.length ? visitDates.sort().at(-1) : null;

    const statuses = [];
    if (owedHeld > 0) statuses.push(PATIENT_STATUS.OWED);
    if (pending > 0) statuses.push(PATIENT_STATUS.PENDING);
    if (refundable > 0) statuses.push(PATIENT_STATUS.REFUND);
    if (planViews.some((p) => p.hasUnfinished)) statuses.push(PATIENT_STATUS.UPCOMING);
    if (!statuses.length) statuses.push(PATIENT_STATUS.SETTLED);

    // What is still running or owed: plans by name first, then walk-ins with money left by the services done in them
    const visitItem = (v) => ({ kind: "visit", label: v.services.map((x) => x.name).filter(Boolean).join(", "), date: v.date });
    const open = [
        ...planViews.filter((p) => p.currentDue > 0 || p.hasUnfinished).map((p) => ({ kind: "plan", label: p.name })),
        ...visitViews.filter((v) => v.remaining > 0).sort((a, b) => b.date.localeCompare(a.date)).map(visitItem),
    ];
    const latestPlan = [...planViews].sort((a, b) => b.id - a.id)[0];
    const latestVisit = [...visitViews].sort((a, b) => b.date.localeCompare(a.date))[0];
    const owedDates = [...planViews.filter((p) => p.currentDue > 0), ...visitViews.filter((v) => v.remaining > 0)].map((x) => x.owedSince).filter(Boolean);

    return {
        ...patient,
        plans: planViews,
        visits: visitViews,
        owed,
        owedHeld,
        pending,
        refundable,
        depositLeft: sum(planViews, (p) => p.depositLeft),
        lastVisit,
        dates: [...new Set([...planViews.flatMap((p) => p.periods.map((x) => x.date)), ...visitViews.map((v) => v.date)])],
        statuses,
        status: statuses[0],
        // Nothing left to pay: still say what the patient had done
        open: open.length ? open : latestPlan ? [{ kind: "plan", label: latestPlan.name }] : latestVisit ? [visitItem(latestVisit)] : [],
        owedSince: owedDates.length ? owedDates.sort()[0] : null,
    };
};

// Vietnamese without marks, lower case: "Nguyễn Minh Anh" -> "nguyen minh anh"
export const plainText = (text) =>
    String(text ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();

// Search by name / code (without marks) or by phone digits (+84 and 0 both work)
export const matchesSearch = (patient, query) => {
    const q = plainText(query);
    if (!q) return true;
    const digits = q.replace(/\D/g, "");
    const phone = String(patient.phone ?? "").replace(/\D/g, "").replace(/^84/, "0");
    const typed = digits.replace(/^84/, "0");
    const onlyDigits = digits && digits.length === q.replace(/[\s.+-]/g, "").length;
    if (onlyDigits && phone.includes(typed)) return true;
    return plainText(patient.name).includes(q) || plainText(patient.code).includes(q);
};

// Lines the "Ghi nhận thu tiền" page may add, with the most each one may take now
export const collectablesOf = (patientView) => {
    const plans = patientView.plans
        .filter((p) => p.option !== null)
        .map((p) => ({
            id: p.id,
            name: p.name,
            option: p.option,
            targets: [
                ...(p.option === OPTION.FULL && p.fullCeiling > 0 ? [{ key: `full:${p.id}`, kind: LINE.FULL, planId: p.id, ceiling: p.fullCeiling }] : []),
                ...p.periods
                    .filter((x) => x.collectable)
                    .map((x) => ({ key: `period:${x.id}`, kind: LINE.PERIOD, planId: p.id, periodId: x.id, seq: x.seq, date: x.date, ceiling: x.ceiling })),
            ],
        }))
        .filter((p) => p.targets.length);
    // One line per walk-in visit, named by its services
    const services = patientView.visits
        .filter((v) => v.ceiling > 0)
        .map((v) => ({ key: `visit:${v.id}`, kind: LINE.VISIT_SERVICE, visitId: v.id, name: v.services.map((s) => s.name).join(", "), startAt: v.startAt, ceiling: v.ceiling }));
    return { plans, services };
};

// Keys of the lines asked for in ?add= ("period:12,visit:5,full:3"); unknown or used-up ones are dropped.
export const keysFromAdd = (add, collectables) => {
    const known = new Map([...collectables.plans.flatMap((p) => p.targets), ...collectables.services].map((t) => [t.key, t]));
    const keys = [];
    String(add ?? "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .forEach((token) => {
            const [kind, id] = token.split(":");
            if (!/^\d+$/.test(id ?? "")) return;
            if ((kind === "period" || kind === "full" || kind === "visit") && known.has(token)) keys.push(token);
        });
    return [...new Set(keys)];
};

// Checks of collect() on the data as it is now. Returns an error text, or null when the receipt may be saved.
export const collectError = (data, { patientId, lines, method }, MSG) => {
    if (!METHODS.includes(method)) return MSG.BAD_METHOD;
    if (!Array.isArray(lines) || !lines.length) return MSG.NO_LINES;
    const patient = data.patients.find((p) => p.id === patientId);
    if (!patient) return MSG.NO_PATIENT;
    const view = computePatient(patient, data, "9999-12-31");
    const room = new Map();
    for (const line of lines) {
        if (!Number.isInteger(line.amount) || line.amount <= 0) return MSG.BAD_AMOUNT;
        let key;
        let ceiling;
        if (line.kind === LINE.FULL || line.kind === LINE.PERIOD) {
            const plan = view.plans.find((p) => p.id === line.planId);
            if (!plan) return MSG.WRONG_PATIENT;
            if (line.kind === LINE.FULL) {
                if (plan.option !== OPTION.FULL) return MSG.NOT_FULL;
                key = `full:${plan.id}`;
                ceiling = plan.fullCeiling;
            } else {
                const period = plan.periods.find((x) => x.id === line.periodId);
                if (!period) return MSG.WRONG_PLAN;
                if (!period.collectable) return MSG.NOT_COLLECTABLE;
                key = `period:${period.id}`;
                ceiling = period.ceiling;
            }
        } else if (line.kind === LINE.VISIT_SERVICE) {
            const visit = view.visits.find((v) => v.id === line.visitId);
            if (!visit) return MSG.WRONG_PATIENT;
            key = `visit:${visit.id}`;
            ceiling = visit.ceiling;
        } else {
            return MSG.BAD_KIND;
        }
        const used = (room.get(key) ?? 0) + line.amount;
        if (used > ceiling) return MSG.OVER_CEILING;
        room.set(key, used);
    }
    return null;
};

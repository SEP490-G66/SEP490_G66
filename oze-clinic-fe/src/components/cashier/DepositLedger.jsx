import { money, dmy, useSubmit } from "@/components/reception/receptionUtils";
import { LINE, RECEIPT_STATUS } from "@/utils/cashier";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { LabelBadge } from "./cashierUi";
import { dateTimeText } from "./cashierFormat";

// Deposit book of one plan: money in (+, with the receipt status), used by each period (−), and what is left to refund
const DepositLedger = ({ plan, receipts, canWrite, onStatus }) => {
    const [busy, submit] = useSubmit(onStatus);
    const ins = (receipts ?? []).flatMap((r) =>
        r.lines.filter((l) => l.kind === LINE.DEPOSIT && l.planId === plan.id).map((l, i) => ({ key: `${r.id}-${i}`, receipt: r, amount: l.amount })),
    );
    const uses = plan.periods.filter((p) => p.deposit > 0);
    if (!ins.length && !uses.length) return <p className="px-5 py-8 text-center text-body-sm text-muted">{TEXT.LEDGER_EMPTY}</p>;
    return (
        <ul className="divide-y divide-border">
            {ins.map(({ key, receipt, amount }) => (
                <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-body-sm">
                    <span className="text-ink">{TEXT.LEDGER_IN}</span>
                    <span className="text-caption text-muted">
                        PT{receipt.id} · {dateTimeText(receipt.createdAt)} · {TEXT.METHODS[receipt.method]}
                    </span>
                    <LabelBadge map={TEXT.RECEIPT_STATUS} value={receipt.status} />
                    <b className="num ml-auto text-success">+ {money(amount)}</b>
                    {receipt.status === RECEIPT_STATUS.PENDING && (
                        <span className="flex w-full justify-end gap-2 pt-1">
                            <button type="button" className="btn btn-secondary h-9" disabled={!canWrite || busy} onClick={() => submit(receipt, RECEIPT_STATUS.REJECTED)}>
                                {TEXT.REJECT_RECEIPT}
                            </button>
                            <button type="button" className="btn btn-primary h-9" disabled={!canWrite || busy} onClick={() => submit(receipt, RECEIPT_STATUS.CONFIRMED)}>
                                {TEXT.CONFIRM_RECEIPT}
                            </button>
                        </span>
                    )}
                </li>
            ))}
            {uses.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-body-sm">
                    <span className="text-ink">{TEXT.LEDGER_USE(p.seq)}</span>
                    <span className="num text-caption text-muted">{dmy(p.date)}</span>
                    <b className="num ml-auto text-ink">− {money(p.deposit)}</b>
                </li>
            ))}
            {plan.refundableDeposit > 0 && (
                <li className="flex items-center gap-3 bg-warning-soft px-5 py-2.5 text-body-sm">
                    <span className="font-semibold text-warning">{TEXT.LEDGER_REFUND}</span>
                    <b className="num ml-auto text-warning">{money(plan.refundableDeposit)}</b>
                </li>
            )}
        </ul>
    );
};

export default DepositLedger;

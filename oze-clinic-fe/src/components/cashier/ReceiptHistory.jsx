import { money, useSubmit } from "@/components/reception/receptionUtils";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { RECEIPT_STATUS } from "@/utils/cashier";
import { LabelBadge } from "./cashierUi";
import { dateTimeText } from "./cashierFormat";

// Receipts of the patient, newest first; a waiting transfer can be confirmed or rejected here (stands in for the bank check)
const ReceiptHistory = ({ receipts, describe, canWrite, onStatus }) => {
    const [busy, submit] = useSubmit(onStatus);
    if (!receipts) return <div className="skeleton m-4 h-24 rounded-lg" />;
    if (!receipts.length) return <p className="px-5 py-8 text-center text-body-sm text-muted">{TEXT.HISTORY_EMPTY}</p>;
    return (
        <ul className="divide-y divide-border">
            {receipts.map((r) => (
                <li key={r.id} className="space-y-1.5 px-5 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <b className="text-body-sm text-ink">PT{r.id}</b>
                        <LabelBadge map={TEXT.RECEIPT_STATUS} value={r.status} />
                    </div>
                    <p className="text-caption text-muted">
                        {dateTimeText(r.createdAt)} · {TEXT.METHODS[r.method]}
                        {r.ref ? ` · ${r.ref}` : ""}
                    </p>
                    <ul className="space-y-0.5 text-caption text-body">
                        {r.lines.map((line, index) => (
                            <li key={index} className="flex justify-between gap-3">
                                <span className="min-w-0">{describe(line)}</span>
                                <span className="num whitespace-nowrap">{money(line.amount)}</span>
                            </li>
                        ))}
                    </ul>
                    {r.status === RECEIPT_STATUS.PENDING && (
                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                            <button type="button" className="btn btn-secondary h-9" disabled={!canWrite || busy} onClick={() => submit(r, RECEIPT_STATUS.REJECTED)}>
                                {TEXT.REJECT_RECEIPT}
                            </button>
                            <button type="button" className="btn btn-primary h-9" disabled={!canWrite || busy} onClick={() => submit(r, RECEIPT_STATUS.CONFIRMED)}>
                                {TEXT.CONFIRM_RECEIPT}
                            </button>
                        </div>
                    )}
                </li>
            ))}
        </ul>
    );
};

export default ReceiptHistory;

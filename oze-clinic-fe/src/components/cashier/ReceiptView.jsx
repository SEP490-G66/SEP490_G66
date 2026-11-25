import Modal from "@/components/ui/Modal";
import { money } from "@/components/reception/receptionUtils";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { LabelBadge } from "./cashierUi";
import { dateTimeText } from "./cashierFormat";

// The receipt just saved: its lines (named by the page) and totals
const ReceiptView = ({ receipt, patientName, describe, onClose }) => (
    <Modal title={TEXT.RECEIPT_TITLE(receipt.id)} description={`${patientName} · ${dateTimeText(receipt.createdAt)}`} size="md" onClose={onClose}>
        <ul className="divide-y divide-border rounded-lg border border-border">
            {receipt.lines.map((line, index) => (
                <li key={index} className="flex items-start justify-between gap-4 px-4 py-2.5 text-body-sm">
                    <span className="text-ink">{describe(line)}</span>
                    <b className="num whitespace-nowrap text-ink">{money(line.amount)}</b>
                </li>
            ))}
        </ul>
        <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-body-sm">
            <dt className="font-semibold text-ink">{TEXT.TOTAL}</dt>
            <dd className="num m-0 text-right font-heading text-heading-3 font-bold text-ink">{money(receipt.lines.reduce((t, l) => t + l.amount, 0))}</dd>
            <dt className="text-muted">{TEXT.METHOD}</dt>
            <dd className="m-0 flex items-center justify-end gap-2 text-ink">
                {TEXT.METHODS[receipt.method]} <LabelBadge map={TEXT.RECEIPT_STATUS} value={receipt.status} />
            </dd>
        </dl>
        <p className="mt-3 text-caption text-muted">
            {[receipt.ref && TEXT.RECEIPT_REF(receipt.ref), receipt.note, TEXT.RECEIPT_RECEIVED_BY(receipt.receivedBy)].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-6 flex justify-end">
            <button type="button" className="btn btn-primary" onClick={onClose}>
                {TEXT.CLOSE}
            </button>
        </div>
    </Modal>
);

export default ReceiptView;

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Modal from "@/components/ui/Modal";
import ConfirmActionDialog from "./ConfirmActionDialog";
import ItemsTable from "./ItemsTable";
import { clockOf, money, report } from "@/components/reception/receptionUtils";
import { cancelInvoice, getInvoice } from "@/services/receptionService";
import { invoiceItems } from "@/utils/billing";
import { ddmm, dmy } from "@/utils/calendar";
import { dateKey } from "@/utils/cashShift";
import { BILLING_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const InvoiceDetailDialog = ({ invoiceId, onClose, onChanged }) => {
    const [state, setState] = useState(null);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        getInvoice(invoiceId, { skipErrorPage: true, signal: controller.signal }).then((response) => {
            if (!controller.signal.aborted) setState(response);
        });
        return () => controller.abort();
    }, [invoiceId]);

    const invoice = state?.success ? state.data : null;
    const payments = invoice?.payments ?? [];
    const paid = Number(invoice?.paidAmount ?? 0);
    const waiting = payments.filter((p) => p.paymentStatus === "PENDING").reduce((s, p) => s + Number(p.amount), 0);
    const canCancel = invoice && invoice.paymentStatus !== "CANCELLED" && !paid && !waiting;
    const [label, tone] = TEXT.INVOICE_STATUS[invoice?.paymentStatus] ?? [];

    if (cancelling && invoice) {
        return (
            <ConfirmActionDialog
                title={TEXT.CANCEL_INVOICE_TITLE}
                description={invoice.invoiceNumber}
                body={TEXT.CANCEL_INVOICE_BODY(invoice.patientName)}
                closeLabel={TEXT.KEEP_INVOICE}
                submitLabel={TEXT.CANCEL_INVOICE}
                danger
                onClose={() => setCancelling(false)}
                onSubmit={async () => {
                    if (report(await cancelInvoice(invoice.id), TEXT.CANCELLED_INVOICE(invoice.invoiceNumber))) {
                        onChanged();
                        onClose();
                    }
                }}
            />
        );
    }

    return (
        <Modal
            title={invoice ? TEXT.DETAIL_TITLE(invoice.invoiceNumber) : TEXT.DETAIL}
            description={invoice ? TEXT.DETAIL_SUB(invoice.patientName, dmy(dateKey(invoice.createdAt))) : undefined}
            onClose={onClose}
            size="lg"
        >
            {!state ? (
                <div className="skeleton h-40 rounded-lg" />
            ) : !invoice ? (
                <p className="alert alert-danger">{state.message || TEXT.LOAD_ERROR}</p>
            ) : (
                <div className="space-y-4">
                    <p className="flex flex-wrap items-center gap-2">
                        <span className={cx("badge", tone)}>{label}</span>
                        {invoice.cancelReason && <small className="text-caption text-muted">{TEXT.VOID_REASON(invoice.cancelReason)}</small>}
                    </p>
                    <ItemsTable items={invoiceItems(invoice)} showTooth={false} />
                    <dl className="ml-auto grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-body-sm">
                        <dt className="text-muted">{TEXT.RECEIVABLE}</dt>
                        <dd className="num m-0 text-right text-ink">{money(invoice.finalAmount ?? invoice.totalAmount)}</dd>
                        <dt className="text-muted">{TEXT.PAID}</dt>
                        <dd className="num m-0 text-right text-ink">{money(paid)}</dd>
                        {waiting > 0 && (
                            <>
                                <dt className="text-muted">{TEXT.WAITING}</dt>
                                <dd className="num m-0 text-right text-ink">{money(waiting)}</dd>
                            </>
                        )}
                        <dt className="border-t border-border pt-1 font-semibold text-ink">{TEXT.OWED}</dt>
                        <dd className="num m-0 border-t border-border pt-1 text-right font-semibold text-ink">{money(Math.max(0, Number(invoice.remainingAmount ?? 0)))}</dd>
                    </dl>
                    <h3 className="text-label font-semibold text-ink">{TEXT.HISTORY}</h3>
                    {payments.length ? (
                        <div className="table-wrap">
                            <table className="table table-stack">
                                <thead>
                                    <tr>
                                        {TEXT.HISTORY_COLUMNS.map((c, i) => (
                                            <th key={c} className={i === 3 ? "text-right" : undefined}>
                                                {c}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p) => {
                                        const at = p.paidAt ?? p.createdAt;
                                        const [st, stTone] = TEXT.PAYMENT_STATUS[p.paymentStatus] ?? TEXT.PAYMENT_STATUS.CONFIRMED;
                                        return (
                                            <tr key={p.id}>
                                                <td data-label={TEXT.HISTORY_COLUMNS[0]} className="num">{`${ddmm(dateKey(at))} ${clockOf(at)}`}</td>
                                                <td data-label={TEXT.HISTORY_COLUMNS[1]}>{TEXT.METHODS[p.paymentMethod] ?? p.paymentMethod}</td>
                                                <td data-label={TEXT.HISTORY_COLUMNS[2]}>{p.transactionReference || "—"}</td>
                                                <td data-label={TEXT.HISTORY_COLUMNS[3]} className="num text-right">
                                                    {money(p.amount)}
                                                </td>
                                                <td data-label={TEXT.HISTORY_COLUMNS[4]}>
                                                    <span className={cx("badge", stTone)}>{st}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-body-sm text-muted">{TEXT.NO_PAYMENTS}</p>
                    )}
                </div>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
                {canCancel && (
                    <button type="button" className="btn btn-danger mr-auto" onClick={() => setCancelling(true)}>
                        {TEXT.CANCEL_INVOICE}
                    </button>
                )}
                {invoice && (
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                            try {
                                window.print();
                            } catch {
                                toast.error(TEXT.PRINT_ERROR);
                            }
                        }}
                    >
                        {TEXT.PRINT_INVOICE}
                    </button>
                )}
                <button type="button" className="btn btn-primary" onClick={onClose}>
                    {TEXT.CLOSE}
                </button>
            </div>
        </Modal>
    );
};

export default InvoiceDetailDialog;

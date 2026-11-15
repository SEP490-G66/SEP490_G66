import { useEffect, useState } from "react";
import LabeledSelect from "@/components/ui/LabeledSelect";
import Pagination from "@/components/ui/Pagination";
import ConfirmActionDialog from "./ConfirmActionDialog";
import InvoiceDetailDialog from "./InvoiceDetailDialog";
import { Card } from "@/components/reception/shared";
import { money, phoneText, report } from "@/components/reception/receptionUtils";
import { clinicToday, confirmPayment, getInvoice, rejectPayment, searchInvoices } from "@/services/receptionService";
import { addDays, dmy } from "@/utils/calendar";
import { dateKey } from "@/utils/cashShift";
import { BILLING_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [["", TEXT.ALL], ...["PAID", "PARTIALLY_PAID", "UNPAID", "PENDING_CONFIRMATION", "CANCELLED"].map((k) => [k, TEXT.INVOICE_STATUS[k][0]])];

const defaults = (today) => ({ keyword: "", from: addDays(today, -30), to: today, status: "" });

const InvoicesTab = () => {
    const [today] = useState(clinicToday);
    const [filters, setFilters] = useState(() => defaults(today));
    const [page, setPage] = useState(1);
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [dialog, setDialog] = useState(null);

    const key = JSON.stringify([filters, page, reload]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            searchInvoices(
                { keyword: filters.keyword.trim(), status: filters.status, fromDate: filters.from, toDate: filters.to, page, pageSize: PAGE_SIZE },
                { skipErrorPage: true, signal: controller.signal },
            ).then((response) => {
                if (controller.signal.aborted || response.aborted) return;
                setResult({
                    key,
                    ok: response.success,
                    items: response.success ? (response.data?.items ?? []) : [],
                    total: Number(response.data?.totalCount ?? 0),
                    totalPages: Math.max(1, Number(response.data?.totalPages ?? 1)),
                });
            });
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [filters, page, key]);

    const base = defaults(today);
    const dirty = Object.keys(base).some((k) => filters[k] !== base[k]);
    const setFilter = (k) => (v) => {
        setFilters((f) => {
            const next = { ...f, [k]: v };
            if (k === "from" && next.to < v) next.to = v;
            if (k === "to" && next.from > v) next.from = v;
            return next;
        });
        setPage(1);
    };
    const refresh = () => setReload((n) => n + 1);

    const openPending = async (invoice, type) => {
        const detail = invoice.pendingPayment ? { success: true, data: invoice } : await getInvoice(invoice.id);
        const payment = detail.success ? (detail.data.pendingPayment ?? detail.data.payments?.find((p) => p.paymentStatus === "PENDING")) : null;
        if (!payment) {
            report({ success: false, message: detail.success ? TEXT.NO_PENDING : detail.message });
            return;
        }
        setDialog({ type, invoice, payment });
    };

    const items = result?.items ?? [];
    const fresh = result?.key === key;

    return (
        <div className="space-y-5">
            <Card>
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                    <div className="flex min-w-56 flex-1 flex-col gap-1">
                        <label htmlFor="inv-q" className="text-caption text-muted">
                            {TEXT.SEARCH}
                        </label>
                        <input id="inv-q" type="search" className="input" placeholder={TEXT.SEARCH_PLACEHOLDER} value={filters.keyword} onChange={(e) => setFilter("keyword")(e.target.value)} />
                    </div>
                    {[
                        ["from", TEXT.FROM],
                        ["to", TEXT.TO],
                    ].map(([k, label]) => (
                        <div key={k} className="flex flex-col gap-1">
                            <label htmlFor={`inv-${k}`} className="text-caption text-muted">
                                {label}
                            </label>
                            <input id={`inv-${k}`} type="date" className="input w-auto" max={today} value={filters[k]} onChange={(e) => e.target.value && setFilter(k)(e.target.value)} />
                        </div>
                    ))}
                    <LabeledSelect id="inv-status" label={TEXT.STATUS} value={filters.status} options={STATUS_OPTIONS} onChange={setFilter("status")} />
                    {dirty && (
                        <button
                            type="button"
                            className="btn-link h-control"
                            onClick={() => {
                                setFilters(base);
                                setPage(1);
                            }}
                        >
                            {TEXT.CLEAR_FILTERS}
                        </button>
                    )}
                </div>
            </Card>
            {result && !result.ok && fresh && (
                <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                    <span className="flex-1">{TEXT.LOAD_ERROR}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={refresh}>
                        {TEXT.RETRY}
                    </button>
                </div>
            )}
            <Card>
                {!result ? (
                    <div className="space-y-2 p-4">
                        <div className="skeleton h-10 rounded" />
                        <div className="skeleton h-10 rounded" />
                    </div>
                ) : !items.length ? (
                    <p className="px-6 py-10 text-center text-body-sm text-muted">{TEXT.INV_EMPTY}</p>
                ) : (
                    <div className={cx("table-wrap rounded-none border-x-0", !fresh && "opacity-60")} aria-busy={!fresh ? "true" : undefined}>
                        <table className="table table-stack [&_td]:px-3 [&_td]:align-top [&_th]:px-3">
                            <thead>
                                <tr>
                                    {TEXT.INV_COLUMNS.map((c, i) => (
                                        <th key={c} className={i === 4 || i === 5 ? "text-right" : undefined}>
                                            {i === TEXT.INV_COLUMNS.length - 1 ? <span className="sr-only">{c}</span> : c}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((i) => {
                                    const [label, tone] = TEXT.INVOICE_STATUS[i.paymentStatus] ?? [i.paymentStatus, "badge-neutral"];
                                    const waiting = i.paymentStatus === "PENDING_CONFIRMATION";
                                    return (
                                        <tr key={i.id} className={i.paymentStatus === "CANCELLED" ? "opacity-60" : undefined}>
                                            <td data-label={TEXT.INV_COLUMNS[0]} className="whitespace-nowrap">
                                                {i.invoiceNumber}
                                            </td>
                                            <td data-label={TEXT.INV_COLUMNS[1]} className="num whitespace-nowrap">
                                                {dmy(dateKey(i.createdAt))}
                                            </td>
                                            <td data-primary>
                                                <span className="cell-primary">{i.patientName}</span>
                                            </td>
                                            <td data-label={TEXT.INV_COLUMNS[3]} className="num whitespace-nowrap">
                                                {phoneText(i.patientPhoneNumber)}
                                            </td>
                                            <td data-label={TEXT.INV_COLUMNS[4]} className="num whitespace-nowrap text-right">
                                                {money(i.finalAmount ?? i.totalAmount)}
                                            </td>
                                            <td data-label={TEXT.INV_COLUMNS[5]} className="num whitespace-nowrap text-right">
                                                {money(i.paidAmount)}
                                            </td>
                                            <td data-label={TEXT.INV_COLUMNS[6]}>
                                                <span className={cx("badge", tone)}>{label}</span>
                                            </td>
                                            <td data-actions>
                                                <div className="ml-auto grid w-max gap-2">
                                                    {waiting && (
                                                        <>
                                                            <button type="button" className="btn btn-primary h-8 px-2.5" onClick={() => openPending(i, "confirm")}>
                                                                {TEXT.CONFIRM_CK}
                                                            </button>
                                                            <button type="button" className="btn btn-secondary h-8 px-2.5" onClick={() => openPending(i, "reject")}>
                                                                {TEXT.REJECT_CK}
                                                            </button>
                                                        </>
                                                    )}
                                                    <button type="button" className="btn btn-secondary h-8 px-2.5" onClick={() => setDialog({ type: "detail", invoice: i })}>
                                                        {TEXT.DETAIL}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {items.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                        <p className="num text-body-sm text-muted">
                            {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + items.length} / {result.total || items.length}
                        </p>
                        {result.totalPages > 1 && <Pagination page={page} totalPages={result.totalPages} onChange={setPage} busy={!fresh} />}
                    </div>
                )}
            </Card>
            {dialog?.type === "detail" && <InvoiceDetailDialog invoiceId={dialog.invoice.id} onClose={() => setDialog(null)} onChanged={refresh} />}
            {dialog?.type === "confirm" && (
                <ConfirmActionDialog
                    title={TEXT.CK_TITLE}
                    description={`${dialog.invoice.invoiceNumber} · ${dialog.invoice.patientName}`}
                    body={TEXT.CK_BODY(money(dialog.payment.amount), dialog.payment.transactionReference)}
                    closeLabel={TEXT.CANCEL}
                    submitLabel={TEXT.CONFIRM}
                    onClose={() => setDialog(null)}
                    onSubmit={async () => {
                        if (report(await confirmPayment(dialog.payment.id), TEXT.CK_DONE(money(dialog.payment.amount), dialog.invoice.patientName))) {
                            setDialog(null);
                            refresh();
                        }
                    }}
                />
            )}
            {dialog?.type === "reject" && (
                <ConfirmActionDialog
                    title={TEXT.CK_REJECT_TITLE}
                    description={`${dialog.invoice.invoiceNumber} · ${dialog.invoice.patientName}`}
                    body={TEXT.CK_REJECT_BODY(money(dialog.payment.amount))}
                    closeLabel={TEXT.CANCEL}
                    submitLabel={TEXT.CK_REJECT}
                    danger
                    onClose={() => setDialog(null)}
                    onSubmit={async () => {
                        if (report(await rejectPayment(dialog.payment.id), TEXT.CK_REJECTED)) {
                            setDialog(null);
                            refresh();
                        }
                    }}
                />
            )}
        </div>
    );
};

export default InvoicesTab;

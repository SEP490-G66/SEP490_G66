import { useEffect, useState } from "react";
import LabeledSelect from "@/components/ui/LabeledSelect";
import Pagination from "@/components/ui/Pagination";
import ConfirmActionDialog from "./ConfirmActionDialog";
import { Card } from "@/components/reception/shared";
import { money, phoneText, report } from "@/components/reception/receptionUtils";
import { getCashierRefunds, payoutRefund, rejectRefund } from "@/services/receptionService";
import { dateTimeOf } from "@/utils/cashShift";
import { BILLING_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [["", TEXT.ALL], ...Object.entries(TEXT.REFUND_STATUS).map(([k, [label]]) => [k, label])];
// The backend writes statuses as Pending / Approved / Processed / Rejected; any casing is read the same.
const statusOf = (value) => Object.keys(TEXT.REFUND_STATUS).find((k) => k.toLowerCase() === String(value ?? "").toLowerCase()) ?? value;

const RefundsTab = () => {
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [dialog, setDialog] = useState(null);

    const key = JSON.stringify([status, page, reload]);

    useEffect(() => {
        const controller = new AbortController();
        getCashierRefunds({ status, page, pageSize: PAGE_SIZE }, { skipErrorPage: true, signal: controller.signal }).then((response) => {
            if (controller.signal.aborted || response.aborted) return;
            const lastPage = Math.max(1, Number(response.data?.totalPages ?? 1));
            if (response.success && page > lastPage) {
                setPage(lastPage);
                return;
            }
            const items = response.success ? (response.data?.items ?? []) : [];
            setResult({ key, ok: response.success, items, total: Number(response.data?.totalCount ?? items.length), totalPages: Math.max(1, Number(response.data?.totalPages ?? 1)) });
        });
        return () => controller.abort();
    }, [status, page, key]);

    const items = result?.items ?? [];
    const fresh = result?.key === key;
    // Failed or not, the dialog closes and the list reloads: another cashier or the manager may have acted on it.
    const done = () => {
        setDialog(null);
        setReload((n) => n + 1);
    };

    return (
        <div className="space-y-5">
            <Card>
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                    <LabeledSelect
                        id="rf-status"
                        label={TEXT.STATUS}
                        value={status}
                        options={STATUS_OPTIONS}
                        onChange={(v) => {
                            setStatus(v);
                            setPage(1);
                        }}
                    />
                </div>
            </Card>
            {result && !result.ok && fresh && (
                <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                    <span className="flex-1">{TEXT.LOAD_ERROR}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={() => setReload((n) => n + 1)}>
                        {TEXT.RETRY}
                    </button>
                </div>
            )}
            <Card>
                {!result ? (
                    <div className="space-y-2 p-4">
                        <div className="skeleton h-10 rounded" />
                    </div>
                ) : !result.ok && !items.length ? null : !items.length ? (
                    <p className="px-6 py-10 text-center text-body-sm text-muted">{TEXT.REFUND_EMPTY}</p>
                ) : (
                    <div className={cx("table-wrap rounded-none border-x-0", !fresh && "opacity-60")}>
                        <table className="table table-stack [&_td]:px-3 [&_td]:align-top [&_th]:px-3">
                            <thead>
                                <tr>
                                    {TEXT.REFUND_COLUMNS.map((c, i) => (
                                        <th key={c} className={i === 3 ? "text-right" : undefined}>
                                            {i === TEXT.REFUND_COLUMNS.length - 1 ? <span className="sr-only">{c}</span> : c}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((r) => {
                                    const status = statusOf(r.status);
                                    const [label, tone] = TEXT.REFUND_STATUS[status] ?? [r.status ?? "—", "badge-neutral"];
                                    return (
                                        <tr key={r.id}>
                                            <td data-primary>
                                                <span className="cell-primary">{r.patientName}</span>
                                            </td>
                                            <td data-label={TEXT.REFUND_COLUMNS[1]} className="num whitespace-nowrap">
                                                {phoneText(r.patientPhoneNumber)}
                                            </td>
                                            <td data-label={TEXT.REFUND_COLUMNS[2]} className="whitespace-nowrap">
                                                {r.invoiceNumber}
                                            </td>
                                            <td data-label={TEXT.REFUND_COLUMNS[3]} className="num whitespace-nowrap text-right font-semibold text-ink">
                                                {money(r.amount)}
                                            </td>
                                            <td data-label={TEXT.REFUND_COLUMNS[4]}>{r.reason}</td>
                                            <td data-label={TEXT.REFUND_COLUMNS[5]} className="whitespace-nowrap">
                                                {r.requestedByName}
                                            </td>
                                            <td data-label={TEXT.REFUND_COLUMNS[6]} className="num whitespace-nowrap">
                                                {r.requestedAt || r.createdAt ? dateTimeOf(r.requestedAt ?? r.createdAt) : "—"}
                                            </td>
                                            <td data-label={TEXT.REFUND_COLUMNS[7]}>
                                                <span className={cx("badge", tone)}>{label}</span>
                                            </td>
                                            <td data-actions>
                                                {status === "Approved" && (
                                                    <div className="ml-auto grid w-max grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            className="btn btn-primary h-8 px-2.5"
                                                            disabled={!fresh}
                                                            onClick={() => setDialog({ type: "payout", item: r })}
                                                        >
                                                            {TEXT.REFUND}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary h-8 px-2.5"
                                                            disabled={!fresh}
                                                            onClick={() => setDialog({ type: "reject", item: r })}
                                                        >
                                                            {TEXT.CK_REJECT}
                                                        </button>
                                                    </div>
                                                )}
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
                            {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + items.length} / {result.total}
                        </p>
                        {result.totalPages > 1 && <Pagination page={page} totalPages={result.totalPages} onChange={setPage} busy={!fresh} />}
                    </div>
                )}
            </Card>
            {dialog?.type === "payout" && (
                <ConfirmActionDialog
                    title={TEXT.REFUND_TITLE}
                    description={`${dialog.item.patientName} · ${dialog.item.invoiceNumber}`}
                    body={TEXT.REFUND_BODY(
                        money(dialog.item.amount),
                        TEXT.METHODS[dialog.item.refundMethod ?? dialog.item.paymentMethod] ?? TEXT.METHODS.CASH,
                        dialog.item.paidAmount != null ? money(dialog.item.paidAmount) : null,
                    )}
                    closeLabel={TEXT.CANCEL}
                    submitLabel={TEXT.REFUND}
                    onClose={() => setDialog(null)}
                    onSubmit={async () => {
                        const amount = Number(dialog.item.amount);
                        // Never hand back more than the invoice took in, nor nothing at all.
                        if (!(amount > 0) || (dialog.item.paidAmount != null && amount > Number(dialog.item.paidAmount))) {
                            report({ success: false, message: TEXT.REFUND_TOO_MUCH });
                            return done();
                        }
                        report(await payoutRefund(dialog.item.id), TEXT.REFUNDED(money(amount), dialog.item.patientName));
                        done();
                    }}
                />
            )}
            {dialog?.type === "reject" && (
                <ConfirmActionDialog
                    title={TEXT.REFUND_REJECT_TITLE}
                    description={`${dialog.item.patientName} · ${money(dialog.item.amount)}`}
                    body={TEXT.REFUND_REJECT_BODY(dialog.item.requestedByName)}
                    closeLabel={TEXT.CANCEL}
                    submitLabel={TEXT.CK_REJECT}
                    danger
                    reasonLabel={TEXT.REFUND_REASON}
                    reasonPlaceholder={TEXT.REFUND_REASON_PLACEHOLDER}
                    onClose={() => setDialog(null)}
                    onSubmit={async (reason) => {
                        report(await rejectRefund(dialog.item.id, reason), TEXT.REFUND_REJECTED);
                        done();
                    }}
                />
            )}
        </div>
    );
};

export default RefundsTab;

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import SegmentedControl from "@/components/ui/SegmentedControl";
import ConfirmActionDialog from "@/components/billing/ConfirmActionDialog";
import ItemsTable from "@/components/billing/ItemsTable";
import { Card } from "@/components/reception/shared";
import { money, phoneText, report } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { clinicToday, createInvoice, getAppointments, getInvoice, getOpenInvoices, getRecentInvoices, recordPayment } from "@/services/receptionService";
import { invoiceItems, lineTotal, queueOf, visitItems } from "@/utils/billing";
import { BILLING_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.PAY_TITLE }];
const METHOD_OPTIONS = Object.entries(TEXT.METHODS).map(([value, label]) => ({ value, label }));

const loadQueue = async () => {
    const [visits, invoices, open] = await Promise.all([
        getAppointments({ fromDate: clinicToday(-7), toDate: clinicToday(), status: "COMPLETED" }),
        getRecentInvoices(),
        getOpenInvoices(),
    ]);
    const ok = visits.success && invoices.success && open.success;
    const invoiced = new Set((invoices.data?.items ?? []).filter((i) => i.paymentStatus !== "CANCELLED" && i.appointmentId).map((i) => i.appointmentId));
    const pending = (visits.data?.items ?? []).filter((a) => !invoiced.has(a.id));
    return { ok, visits: pending, queue: queueOf(pending, open.data?.items ?? []) };
};

const printReceipt = () => {
    try {
        window.print();
    } catch {
        toast.error(TEXT.PRINT_ERROR);
    }
};

const ReceptionPayment = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [data, setData] = useState(null);
    const [version, setVersion] = useState(0);
    const [collapsed, setCollapsed] = useState(false);
    const [chosen, setChosen] = useState(() => (searchParams.get("invoice") ? `i${searchParams.get("invoice")}` : null));
    const [invoice, setInvoice] = useState(null);
    const [method, setMethod] = useState("CASH");
    const [confirming, setConfirming] = useState(false);

    usePageTitle(TEXT.PAY_DOC_TITLE);

    useEffect(() => {
        let active = true;
        loadQueue().then((next) => active && setData(next));
        return () => {
            active = false;
        };
    }, [version]);

    const queue = data?.queue ?? [];
    const selected = queue.find((q) => q.key === chosen) ?? queue[0] ?? null;

    useEffect(() => {
        if (selected?.kind !== "invoice") return undefined;
        const controller = new AbortController();
        getInvoice(selected.id, { skipErrorPage: true, signal: controller.signal }).then((response) => {
            if (!controller.signal.aborted && response.success) setInvoice(response.data);
        });
        return () => controller.abort();
    }, [selected?.kind, selected?.id, version]);

    const reload = useCallback(() => setVersion((v) => v + 1), []);
    const select = (key) => {
        setChosen(key);
        setMethod("CASH");
        if (searchParams.get("invoice")) setSearchParams({}, { replace: true });
    };

    const visit = selected?.kind === "visit" ? data.visits.find((a) => a.id === selected.id) : null;
    const loadedInvoice = selected?.kind === "invoice" && invoice?.id === selected.id ? invoice : null;
    const items = visit ? visitItems(visit) : loadedInvoice ? invoiceItems(loadedInvoice) : [];
    const total = visit ? items.reduce((sum, item) => sum + lineTotal(item), 0) : Number(loadedInvoice?.totalAmount ?? 0);
    const discount = Number(loadedInvoice?.discountAmount ?? 0);
    const paidBefore = Number(loadedInvoice?.paidAmount ?? 0);
    const due = visit ? total : Number(loadedInvoice?.remainingAmount ?? 0);
    const patient = visit ?? loadedInvoice;

    const pay = async () => {
        let invoiceId = loadedInvoice?.id;
        if (visit) {
            const created = await createInvoice({
                patientId: visit.patientId,
                appointmentId: visit.id,
                discountAmount: 0,
                notes: null,
                items: items.map(({ serviceId, name, unitPrice, quantity, sortOrder }) => ({ serviceId, serviceName: name, unitPrice, quantity, sortOrder })),
            });
            if (!created.success) {
                report(created);
                return;
            }
            invoiceId = created.data?.id;
        }
        const name = patient.patientName;
        const ok = report(
            await recordPayment(invoiceId, { amount: due, paymentMethod: method, purpose: "Regular", transactionReference: null }),
            method === "CASH" ? TEXT.PAID_CASH(money(due), name) : TEXT.PAID_TRANSFER(money(due), name),
        );
        if (ok) {
            setConfirming(false);
            setChosen(null);
            reload();
        }
    };

    const list = collapsed ? (
        <aside className="hidden lg:block">
            <button type="button" className="btn btn-secondary btn-icon" aria-label={TEXT.EXPAND} aria-expanded="false" onClick={() => setCollapsed(false)}>
                »
            </button>
        </aside>
    ) : (
        <Card
            className="self-start overflow-hidden"
            title={TEXT.QUEUE}
            actions={
                <button type="button" className="btn btn-secondary btn-icon hidden lg:inline-flex" aria-label={TEXT.COLLAPSE} aria-expanded="true" onClick={() => setCollapsed(true)}>
                    «
                </button>
            }
        >
            {!data ? (
                <div className="space-y-2 p-4">
                    <div className="skeleton h-14 rounded-lg" />
                    <div className="skeleton h-14 rounded-lg" />
                </div>
            ) : queue.length ? (
                <ul className="divide-y divide-border">
                    {queue.map((q) => {
                        const active = q.key === selected?.key;
                        const [label, tone] = q.status ? TEXT.INVOICE_STATUS[q.status] : [TEXT.NOT_INVOICED, "badge-neutral"];
                        return (
                            <li key={q.key}>
                                <button
                                    type="button"
                                    aria-current={active ? "true" : undefined}
                                    onClick={() => select(q.key)}
                                    className={cx(
                                        "flex w-full items-center gap-3 border-l-[3px] px-4 py-3 text-left hover:bg-surface-tint",
                                        active ? "border-primary bg-primary-softer" : "border-transparent",
                                    )}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cx("grid size-8 shrink-0 place-items-center rounded-lg font-semibold", active ? "bg-primary text-white" : "bg-surface-muted text-ink")}
                                    >
                                        {(q.name ?? "?").trim().split(" ").at(-1)?.[0]}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <b className="block truncate text-body-sm text-ink">{q.name}</b>
                                        <span className={cx("badge mt-1", tone)}>{label}</span>
                                    </span>
                                    <b className="num whitespace-nowrap text-body-sm text-ink">{money(q.amount)}</b>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="px-5 py-8 text-center text-body-sm text-muted">{TEXT.QUEUE_EMPTY}</p>
            )}
        </Card>
    );

    const main = !selected ? (
        <Card>
            <p className="px-6 py-12 text-center text-body text-muted">{data ? TEXT.NONE_SELECTED : ""}</p>
        </Card>
    ) : !patient ? (
        <div className="skeleton h-64 rounded-xl" />
    ) : (
        <Card
            title={
                <span>
                    <span className="block">{patient.patientName}</span>
                    <small className="block text-caption font-normal text-muted">{[patient.patientCode, phoneText(patient.patientPhoneNumber)].filter(Boolean).join(" · ")}</small>
                </span>
            }
            actions={
                loadedInvoice && (
                    <span className="flex items-center gap-2">
                        <small className="text-caption text-muted">{loadedInvoice.invoiceNumber}</small>
                        <span className={cx("badge", TEXT.INVOICE_STATUS[loadedInvoice.paymentStatus]?.[1])}>{TEXT.INVOICE_STATUS[loadedInvoice.paymentStatus]?.[0]}</span>
                    </span>
                )
            }
        >
            <div className="space-y-5 px-5 py-5">
                <h3 className="text-label font-semibold text-ink">{TEXT.TREATMENT}</h3>
                <ItemsTable items={items} />
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="field">
                        <span className="label">{TEXT.METHOD}</span>
                        <SegmentedControl label={TEXT.METHOD} options={METHOD_OPTIONS} value={method} onChange={setMethod} />
                    </div>
                    <dl className="grid min-w-64 grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-body-sm">
                        <dt className="text-muted">{TEXT.TOTAL}</dt>
                        <dd className="num m-0 text-right font-semibold text-ink">{money(total)}</dd>
                        {discount > 0 && (
                            <>
                                <dt className="text-muted">{TEXT.DISCOUNT}</dt>
                                <dd className="num m-0 text-right text-ink">− {money(discount)}</dd>
                            </>
                        )}
                        {paidBefore > 0 && (
                            <>
                                <dt className="text-muted">{TEXT.PAID_BEFORE}</dt>
                                <dd className="num m-0 text-right text-ink">{money(paidBefore)}</dd>
                            </>
                        )}
                        <dt className="border-t border-border pt-1 font-heading text-heading-3 font-bold text-ink">{TEXT.DUE}</dt>
                        <dd className="num m-0 border-t border-border pt-1 text-right font-heading text-heading-3 font-bold text-ink">{money(due)}</dd>
                    </dl>
                </div>
                <div className="flex flex-wrap justify-end gap-2.5">
                    <button type="button" className="btn btn-secondary" onClick={printReceipt}>
                        {TEXT.PRINT_RECEIPT}
                    </button>
                    <button type="button" className="btn btn-primary" disabled={due <= 0 || !items.length} onClick={() => setConfirming(true)}>
                        {TEXT.CONFIRM_PAY}
                    </button>
                </div>
            </div>
        </Card>
    );

    return (
        <div className="app-content min-h-full space-y-5">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.PAY_TITLE}</h1>
            </div>
            {data && !data.ok && (
                <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                    <span className="flex-1">{TEXT.LOAD_ERROR}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={reload}>
                        {TEXT.RETRY}
                    </button>
                </div>
            )}
            <div className={cx("grid gap-5", collapsed ? "lg:grid-cols-[auto_1fr]" : "lg:grid-cols-[minmax(18rem,24rem)_1fr]")}>
                {list}
                {main}
            </div>
            {confirming && patient && (
                <ConfirmActionDialog
                    title={TEXT.CONFIRM_PAY_TITLE}
                    description={patient.patientName}
                    body={TEXT.CONFIRM_PAY_BODY(money(due), TEXT.METHODS[method])}
                    closeLabel={TEXT.CANCEL}
                    submitLabel={TEXT.CONFIRM}
                    onClose={() => setConfirming(false)}
                    onSubmit={pay}
                />
            )}
        </div>
    );
};

export default ReceptionPayment;

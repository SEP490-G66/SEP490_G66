import { useEffect, useState } from "react";
import { Eye, Search } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import InvoiceDetailDialog from "./InvoiceDetailDialog";
import { LoadError } from "@/components/cashier/cashierUi";
import { money, phoneText } from "@/components/reception/receptionUtils";
import { clinicToday, searchInvoices } from "@/services/receptionService";
import { dmy } from "@/utils/calendar";
import { dateKey } from "@/utils/cashShift";
import { BILLING_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const PAGE_SIZE = 10;
const COLLECTION = { ALL: "received", PAID: "paid", PARTIALLY_PAID: "partial" };
const STATUS_OPTIONS = [
    ["", TEXT.ALL],
    ["PAID", TEXT.INVOICE_STATUS.PAID[0]],
    ["PARTIALLY_PAID", TEXT.INVOICE_STATUS.PARTIALLY_PAID[0]],
];
const NUMBER_COLUMNS = [4, 5];
const EMPTY_FILTERS = { keyword: "", from: "", to: "", status: "" };
const iconButton =
    "inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted outline-none transition-colors hover:bg-primary-soft hover:text-primary focus-visible:shadow-focus";

const InvoicesTab = () => {
    const today = clinicToday();
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [page, setPage] = useState(1);
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [detailId, setDetailId] = useState(null);

    const key = JSON.stringify([filters, page, reload]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            searchInvoices(
                {
                    keyword: filters.keyword.trim(),
                    collection: COLLECTION[filters.status || "ALL"],
                    fromDate: filters.from,
                    toDate: filters.to,
                    page,
                    pageSize: PAGE_SIZE,
                },
                { skipErrorPage: true, signal: controller.signal },
            ).then((response) => {
                if (controller.signal.aborted || response.aborted) return;
                const lastPage = Math.max(1, Number(response.data?.totalPages ?? 1));
                if (response.success && page > lastPage) {
                    setPage(lastPage);
                    return;
                }
                setResult({
                    key,
                    ok: response.success,
                    items: response.success ? (response.data?.items ?? []) : [],
                    total: Number(response.data?.totalCount ?? 0),
                    totalPages: lastPage,
                });
            });
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [filters, page, key]);

    const dirty = Object.values(filters).some(Boolean);
    const setFilter = (k) => (v) => {
        setFilters((f) => {
            const next = { ...f, [k]: v };
            if (k === "from" && v && next.to && next.to < v) next.to = v;
            if (k === "to" && v && next.from && next.from > v) next.from = v;
            return next;
        });
        setPage(1);
    };
    const clearFilters = () => {
        setFilters(EMPTY_FILTERS);
        setPage(1);
    };

    const items = result?.items ?? [];
    const fresh = result?.key === key;
    const failed = result && !result.ok && fresh;
    const firstNo = (page - 1) * PAGE_SIZE + 1;

    return (
        <section className="overflow-hidden rounded-lg border border-border bg-canvas">
            <div className="p-6">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="field w-full sm:w-80">
                        <label htmlFor="inv-q" className="label">
                            {TEXT.SEARCH}
                        </label>
                        <div className="search">
                            <Search aria-hidden="true" />
                            <input id="inv-q" type="search" className="input" placeholder={TEXT.SEARCH_PLACEHOLDER} value={filters.keyword} onChange={(e) => setFilter("keyword")(e.target.value)} />
                        </div>
                    </div>
                    {[
                        ["from", TEXT.FROM],
                        ["to", TEXT.TO],
                    ].map(([k, label]) => (
                        <div key={k} className="field w-full sm:w-auto">
                            <label htmlFor={`inv-${k}`} className="label">
                                {label}
                            </label>
                            <input id={`inv-${k}`} type="date" className="input w-full sm:w-auto" max={today} value={filters[k]} onChange={(e) => setFilter(k)(e.target.value)} />
                        </div>
                    ))}
                    <div className="field w-full sm:w-auto sm:min-w-48">
                        <label htmlFor="inv-status" className="label">
                            {TEXT.STATUS}
                        </label>
                        <select id="inv-status" className="input w-full" value={filters.status} onChange={(e) => setFilter("status")(e.target.value)}>
                            {STATUS_OPTIONS.map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>
                    {dirty && (
                        <button type="button" className="btn-link h-control" onClick={clearFilters}>
                            {TEXT.CLEAR_FILTERS}
                        </button>
                    )}
                </div>
            </div>
            {failed ? (
                <div className="border-t border-border p-6">
                    <LoadError onRetry={() => setReload((n) => n + 1)} />
                </div>
            ) : result && fresh && !items.length ? (
                <div className="empty-state border-t border-border">
                    <p className="empty-state-text">{TEXT.INV_EMPTY}</p>
                    {dirty && (
                        <button type="button" className="btn btn-secondary mt-4" onClick={clearFilters}>
                            {TEXT.CLEAR_FILTERS}
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className={cx("table-wrap rounded-none border-x-0 border-b-0", result && !fresh && "opacity-60")} aria-busy={!fresh ? "true" : undefined}>
                        <table className="table table-stack">
                            <thead>
                                <tr className="whitespace-nowrap">
                                    {TEXT.INV_COLUMNS.map((c, i) =>
                                        i === TEXT.INV_COLUMNS.length - 1 ? (
                                            <th key={c} className="w-px">
                                                <span className="sr-only">{c}</span>
                                            </th>
                                        ) : (
                                            <th key={c} className={NUMBER_COLUMNS.includes(i) ? "text-right" : undefined}>
                                                {c}
                                            </th>
                                        ),
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {!result
                                    ? [1, 2, 3, 4].map((n) => (
                                          <tr key={n}>
                                              <td colSpan={TEXT.INV_COLUMNS.length}>
                                                  <span className="skeleton block h-5 w-full" />
                                              </td>
                                          </tr>
                                      ))
                                    : items.map((i) => {
                                          const [label, tone] = TEXT.INVOICE_STATUS[i.collectionStatus] ?? [i.collectionStatus, "badge-neutral"];
                                          return (
                                              <tr key={i.id}>
                                                  <td data-label={TEXT.INV_COLUMNS[0]} className="whitespace-nowrap">
                                                      {i.invoiceNumber}
                                                  </td>
                                                  <td data-label={TEXT.INV_COLUMNS[1]} className="num whitespace-nowrap">
                                                      {i.createdAt ? dmy(dateKey(i.createdAt)) : "—"}
                                                  </td>
                                                  <td data-primary>
                                                      <span className="whitespace-nowrap font-semibold text-ink">{i.patientName}</span>
                                                  </td>
                                                  <td data-label={TEXT.INV_COLUMNS[3]} className="num whitespace-nowrap">
                                                      {phoneText(i.patientPhoneNumber)}
                                                  </td>
                                                  <td data-label={TEXT.INV_COLUMNS[4]} className="num whitespace-nowrap text-right">
                                                      {money(i.finalAmount ?? i.totalAmount)}
                                                  </td>
                                                  <td data-label={TEXT.INV_COLUMNS[5]} className="num whitespace-nowrap text-right font-semibold text-ink">
                                                      {money(i.collectedAmount)}
                                                  </td>
                                                  <td data-label={TEXT.INV_COLUMNS[6]} className="whitespace-nowrap">
                                                      <span className={cx("badge", tone)}>{label}</span>
                                                  </td>
                                                  <td data-actions className="whitespace-nowrap text-right">
                                                      <button
                                                          type="button"
                                                          className={iconButton}
                                                          aria-label={TEXT.VIEW_DETAIL_OF(i.invoiceNumber)}
                                                          title={TEXT.VIEW_DETAIL}
                                                          onClick={() => setDetailId(i.id)}
                                                      >
                                                          <Eye className="size-4" aria-hidden="true" />
                                                      </button>
                                                  </td>
                                              </tr>
                                          );
                                      })}
                            </tbody>
                        </table>
                    </div>
                    {items.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border px-6 py-3">
                            <p className="num text-body-sm text-muted" aria-live="polite">
                                {TEXT.INV_COUNT(
                                    <span key="range" className="font-semibold text-ink">
                                        {firstNo}–{firstNo + items.length - 1}
                                    </span>,
                                    <span key="total" className="font-semibold text-ink">
                                        {result.total || items.length}
                                    </span>,
                                )}
                            </p>
                            {result.totalPages > 1 && <Pagination page={page} totalPages={result.totalPages} onChange={setPage} busy={!fresh} />}
                        </div>
                    )}
                </>
            )}
            {detailId && <InvoiceDetailDialog invoiceId={detailId} onClose={() => setDetailId(null)} />}
        </section>
    );
};

export default InvoicesTab;

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import ConfirmActionDialog from "./ConfirmActionDialog";
import { LoadError } from "@/components/cashier/cashierUi";
import { money, phoneText, report } from "@/components/reception/receptionUtils";
import { clinicToday, getCashierRefunds, payoutRefund } from "@/services/receptionService";
import { dateKey, dateTimeOf } from "@/utils/cashShift";
import { norm } from "@/utils/medicalRecord";
import { BILLING_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const PAGE_SIZE = 10;
const COLUMNS = TEXT.REFUND_COLUMNS;
const STATUS_OPTIONS = [["", TEXT.ALL], ...Object.entries(TEXT.REFUND_STATUS).map(([k, [label]]) => [k, label])];
const EMPTY_FILTERS = { keyword: "", from: "", to: "", status: "" };
const statusOf = (value) => Object.keys(TEXT.REFUND_STATUS).find((k) => k.toLowerCase() === String(value ?? "").toLowerCase()) ?? value;
const requestedOf = (r) => r.requestedAt ?? r.createdAt;

const matches = (r, { keyword, from, to }) => {
    const word = norm(keyword.trim());
    if (word && !norm(r.patientName).includes(word) && !norm(r.invoiceNumber).includes(word)) return false;
    const day = requestedOf(r) ? dateKey(requestedOf(r)) : "";
    if (from && (!day || day < from)) return false;
    if (to && (!day || day > to)) return false;
    return true;
};

const RefundsTab = () => {
    const today = clinicToday();
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [page, setPage] = useState(1);
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [dialog, setDialog] = useState(null);

    const status = filters.status;
    const key = JSON.stringify([status, reload]);

    useEffect(() => {
        const controller = new AbortController();
        getCashierRefunds({ status }, { skipErrorPage: true, signal: controller.signal }).then((response) => {
            if (controller.signal.aborted || response.aborted) return;
            const data = response.data;
            const list = response.success ? (Array.isArray(data) ? data : (data?.items ?? [])) : [];
            setResult({ key, ok: response.success, list });
        });
        return () => controller.abort();
    }, [status, key]);

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

    const list = (result?.list ?? []).filter((r) => matches(r, filters));
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const current = Math.min(page, totalPages);
    const items = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
    const fresh = result?.key === key;
    const failed = result && !result.ok && fresh;
    const firstNo = (current - 1) * PAGE_SIZE + 1;
    const done = () => {
        setDialog(null);
        setReload((n) => n + 1);
    };

    return (
        <section className="overflow-hidden rounded-lg border border-border bg-canvas">
            <div className="p-6">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="field w-full sm:w-80">
                        <label htmlFor="rf-q" className="label">
                            {TEXT.SEARCH}
                        </label>
                        <div className="search">
                            <Search aria-hidden="true" />
                            <input id="rf-q" type="search" className="input" placeholder={TEXT.REFUND_SEARCH_PLACEHOLDER} value={filters.keyword} onChange={(e) => setFilter("keyword")(e.target.value)} />
                        </div>
                    </div>
                    {[
                        ["from", TEXT.FROM],
                        ["to", TEXT.TO],
                    ].map(([k, label]) => (
                        <div key={k} className="field w-full sm:w-auto">
                            <label htmlFor={`rf-${k}`} className="label">
                                {label}
                            </label>
                            <input id={`rf-${k}`} type="date" className="input w-full sm:w-auto" max={today} value={filters[k]} onChange={(e) => setFilter(k)(e.target.value)} />
                        </div>
                    ))}
                    <div className="field w-full sm:w-auto sm:min-w-48">
                        <label htmlFor="rf-status" className="label">
                            {TEXT.STATUS}
                        </label>
                        <select id="rf-status" className="input w-full" value={filters.status} onChange={(e) => setFilter("status")(e.target.value)}>
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
                    <p className="empty-state-text">{TEXT.REFUND_EMPTY}</p>
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
                                    {COLUMNS.map((c, i) =>
                                        i === COLUMNS.length - 1 ? (
                                            <th key={c} className="w-px">
                                                <span className="sr-only">{c}</span>
                                            </th>
                                        ) : (
                                            <th key={c} className={i === 3 ? "text-right" : undefined}>
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
                                              <td colSpan={COLUMNS.length}>
                                                  <span className="skeleton block h-5 w-full" />
                                              </td>
                                          </tr>
                                      ))
                                    : items.map((r) => {
                                          const rowStatus = statusOf(r.status);
                                          const [label, tone] = TEXT.REFUND_STATUS[rowStatus] ?? [r.status ?? "—", "badge-neutral"];
                                          return (
                                              <tr key={r.id}>
                                                  <td data-primary>
                                                      <span className="whitespace-nowrap font-semibold text-ink">{r.patientName}</span>
                                                  </td>
                                                  <td data-label={COLUMNS[1]} className="num whitespace-nowrap">
                                                      {r.patientPhoneNumber ? phoneText(r.patientPhoneNumber) : <span className="text-muted">—</span>}
                                                  </td>
                                                  <td data-label={COLUMNS[2]} className="whitespace-nowrap">
                                                      {r.invoiceNumber}
                                                  </td>
                                                  <td data-label={COLUMNS[3]} className="num whitespace-nowrap text-right font-semibold text-ink">
                                                      {rowStatus === "Pending" ? <span className="text-muted">—</span> : money(r.amount)}
                                                  </td>
                                                  <td data-label={COLUMNS[4]} className="min-w-48">
                                                      {r.reason}
                                                  </td>
                                                  <td data-label={COLUMNS[5]} className="num whitespace-nowrap">
                                                      {requestedOf(r) ? dateTimeOf(requestedOf(r)) : "—"}
                                                  </td>
                                                  <td data-label={COLUMNS[6]} className="whitespace-nowrap">
                                                      <span className={cx("badge", tone)}>{label}</span>
                                                  </td>
                                                  <td data-actions className="whitespace-nowrap text-right">
                                                      {rowStatus === "Approved" && (
                                                          <button
                                                              type="button"
                                                              className="btn btn-primary h-8 px-2.5"
                                                              disabled={!fresh}
                                                              onClick={() => setDialog({ type: "payout", item: r })}
                                                          >
                                                              {TEXT.REFUND}
                                                          </button>
                                                      )}
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
                                {TEXT.REFUND_COUNT(
                                    <span key="range" className="font-semibold text-ink">
                                        {firstNo}–{firstNo + items.length - 1}
                                    </span>,
                                    <span key="total" className="font-semibold text-ink">
                                        {list.length}
                                    </span>,
                                )}
                            </p>
                            {totalPages > 1 && <Pagination page={current} totalPages={totalPages} onChange={setPage} busy={!fresh} />}
                        </div>
                    )}
                </>
            )}
            {dialog?.type === "payout" && (
                <ConfirmActionDialog
                    title={TEXT.REFUND_TITLE}
                    description={`${dialog.item.patientName} · ${dialog.item.invoiceNumber}`}
                    body={TEXT.REFUND_BODY(money(dialog.item.amount))}
                    closeLabel={TEXT.CANCEL}
                    submitLabel={TEXT.REFUND}
                    submitDisabled={!(Number(dialog.item.amount) > 0)}
                    onClose={() => setDialog(null)}
                    onSubmit={async () => {
                        report(await payoutRefund(dialog.item.id), TEXT.REFUNDED(money(dialog.item.amount), dialog.item.patientName));
                        done();
                    }}
                />
            )}
        </section>
    );
};

export default RefundsTab;

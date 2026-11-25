import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import Pagination from "@/components/ui/Pagination";
import { money, dmy, phoneText } from "@/components/reception/receptionUtils";
import { LabelBadge, LoadError } from "@/components/cashier/cashierUi";
import { useDebounced, usePageTitle } from "@/hooks/usePatientRecordNav";
import { getPaymentPatients } from "@/services/cashierService";
import { PATIENT_STATUS_ORDER } from "@/utils/cashier";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { ROUTES, getCashierAccountRoute } from "@/utils/routes";

const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.LIST_TITLE }];
const DAYS = ["all", "today", "custom"];
const DEFAULT_DAY = "all";
const C = TEXT.COLUMNS;

const PAGE_SIZE_MIN = 10;
const PAGE_SIZE_MAX = 30;
const PAGE_SIZE_DEFAULT = 10;

const sizeFromUrl = (raw) => {
    if (!/^\d+$/.test(raw ?? "")) return PAGE_SIZE_DEFAULT;
    const n = Number(raw);
    return n >= PAGE_SIZE_MIN && n <= PAGE_SIZE_MAX ? n : PAGE_SIZE_DEFAULT;
};

// "Cấy ghép Implant răng 36 +1": plans by name first, then walk-ins by the services done in them
const servicesText = (patient) => {
    const [first, ...rest] = patient.open;
    if (!first) return TEXT.DASH;
    const label = first.label || TEXT.VISIT_ON(dmy(first.date).slice(0, 5));
    return rest.length ? `${label} ${TEXT.MORE(rest.length)}` : label;
};

// Thanh toán: patients by visit day and payment state; a typed search looks at every day (R1)
const CashierPayments = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const accountState = { from: ROUTES.RECEPTION_PAYMENTS, listSearch: `?${params}` };
    const q = params.get("q") ?? "";
    const rawDay = params.get("day");
    const day = DAYS.includes(rawDay) ? rawDay : DEFAULT_DAY;
    const date = params.get("date") ?? "";
    const status = PATIENT_STATUS_ORDER.includes(params.get("status")) ? params.get("status") : "";
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const rawSize = params.get("size");
    const size = sizeFromUrl(rawSize);
    const [box, setBox] = useState(q);
    const [sizeBox, setSizeBox] = useState(String(size));
    const [result, setResult] = useState(null);
    const [version, setVersion] = useState(0);
    const { schedule, cancel } = useDebounced(300);

    usePageTitle(TEXT.LIST_DOC_TITLE);

    // Reads the URL as it is now, so a search typed a moment ago never brings back filters changed since
    const update = (changes) => {
        const next = new URLSearchParams(window.location.search);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        // A new search or filter starts again from page 1
        if (!("page" in changes)) next.delete("page");
        setParams(next, { replace: true });
    };

    useEffect(() => {
        const dayInvalid = rawDay !== null && (!DAYS.includes(rawDay) || rawDay === DEFAULT_DAY);
        const sizeInvalid = rawSize !== null && String(sizeFromUrl(rawSize)) !== rawSize;
        const sizeDefault = rawSize !== null && !sizeInvalid && Number(rawSize) === PAGE_SIZE_DEFAULT;
        if (!dayInvalid && !sizeInvalid && !sizeDefault) return;
        const next = new URLSearchParams(window.location.search);
        if (dayInvalid) next.delete("day");
        if (sizeInvalid || sizeDefault) next.delete("size");
        setParams(next, { replace: true });
    }, [rawDay, rawSize, setParams]);

    // Back / Forward change q without typing: keep the box in step with the URL
    const [shownQ, setShownQ] = useState(q);
    if (shownQ !== q) {
        setShownQ(q);
        if (box.trim() !== q) setBox(q);
    }

    const [shownSize, setShownSize] = useState(size);
    if (shownSize !== size) {
        setShownSize(size);
        setSizeBox(String(size));
    }

    const commitSize = () => {
        const typed = Number(sizeBox);
        if (!sizeBox.trim() || !Number.isFinite(typed)) {
            setSizeBox(String(size));
            return;
        }
        const next = Math.min(PAGE_SIZE_MAX, Math.max(PAGE_SIZE_MIN, Math.round(typed)));
        setSizeBox(String(next));
        if (next !== size) update({ size: next === PAGE_SIZE_DEFAULT ? "" : String(next) });
    };

    const clearFilters = () => {
        cancel();
        setBox("");
        const next = new URLSearchParams();
        if (size !== PAGE_SIZE_DEFAULT) next.set("size", String(size));
        setParams(next, { replace: true });
    };

    useEffect(() => {
        let active = true;
        getPaymentPatients({ q, day, date, status, page, pageSize: size }).then(
            (response) => active && setResult({ key: `${q}|${day}|${date}|${status}|${page}|${size}|${version}`, ...response }),
        );
        return () => {
            active = false;
        };
    }, [q, day, date, status, page, size, version]);

    const loading = result?.key !== `${q}|${day}|${date}|${status}|${page}|${size}|${version}`;
    const rows = result?.data?.items ?? [];
    const total = result?.data?.totalCount ?? 0;
    const totalPages = result?.data?.totalPages ?? 1;
    const firstNo = (page - 1) * size + 1;
    const lastNo = Math.min(firstNo + rows.length - 1, total);
    const filtered = Boolean(q || status || day !== DEFAULT_DAY);
    const failed = !loading && result && !result.success;
    const empty = !loading && !failed && !rows.length;

    return (
        <div className="space-y-6">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.LIST_TITLE}</h1>
            </div>
            <section className="overflow-hidden rounded-lg border border-border bg-canvas">
                <div className="p-6">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="field w-full sm:w-80">
                            <label htmlFor="cashier-search" className="label">
                                {TEXT.SEARCH_LABEL}
                            </label>
                            <div className="search">
                                <Search aria-hidden="true" />
                                <input
                                    id="cashier-search"
                                    type="search"
                                    className="input"
                                    placeholder={TEXT.SEARCH_PLACEHOLDER}
                                    value={box}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setBox(value);
                                        schedule(() => update({ q: value.trim() }));
                                    }}
                                />
                            </div>
                        </div>
                        <div className="field w-full sm:w-auto sm:min-w-48">
                            <label htmlFor="cashier-day" className="label">
                                {TEXT.DAY_LABEL}
                            </label>
                            <select
                                id="cashier-day"
                                className="input w-full"
                                value={day}
                                disabled={Boolean(q)}
                                onChange={(e) => update({ day: e.target.value === DEFAULT_DAY ? "" : e.target.value, date: e.target.value === "custom" ? date : "" })}
                            >
                                {DAYS.map((d) => (
                                    <option key={d} value={d}>
                                        {TEXT.DAYS[d]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {day === "custom" && (
                            <div className="field w-full sm:w-auto">
                                <label htmlFor="cashier-date" className="label">
                                    {TEXT.DATE_LABEL}
                                </label>
                                <input id="cashier-date" type="date" className="input w-full sm:w-auto" value={date} disabled={Boolean(q)} onChange={(e) => update({ date: e.target.value })} />
                            </div>
                        )}
                        <div className="field w-full sm:w-auto sm:min-w-48">
                            <label htmlFor="cashier-status" className="label">
                                {TEXT.STATUS_LABEL}
                            </label>
                            <select id="cashier-status" className="input w-full" value={status} onChange={(e) => update({ status: e.target.value })}>
                                <option value="">{TEXT.DAYS.all}</option>
                                {PATIENT_STATUS_ORDER.map((value) => (
                                    <option key={value} value={value}>
                                        {TEXT.PATIENT_STATUS[value][0]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {q && <p className="help-text mt-2">{TEXT.SEARCH_ALL_DAYS}</p>}
                </div>
                {failed ? (
                    <div className="border-t border-border p-6">
                        <LoadError onRetry={() => setVersion((v) => v + 1)} />
                    </div>
                ) : empty ? (
                    <div className="empty-state border-t border-border">
                        <p className="empty-state-text">{!q && day === "custom" && !date ? TEXT.PICK_DATE : TEXT.EMPTY}</p>
                        {filtered && (
                            <button type="button" className="btn btn-secondary mt-4" onClick={clearFilters}>
                                {TEXT.CLEAR_FILTERS}
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="table-wrap rounded-none border-x-0 border-b-0" aria-busy={loading ? "true" : undefined}>
                            <table className="table table-stack">
                                <thead>
                                    <tr className="whitespace-nowrap">
                                        <th className="w-14 text-right">{C.NO}</th>
                                        <th>{C.PATIENT}</th>
                                        <th>{C.LAST_VISIT}</th>
                                        <th className="w-full">{C.SERVICES}</th>
                                        <th className="text-right">{C.OWED}</th>
                                        <th>{C.STATUS}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading
                                        ? [1, 2, 3, 4].map((n) => (
                                              <tr key={n}>
                                                  <td colSpan={6}>
                                                      <span className="skeleton block h-5 w-full" />
                                                  </td>
                                              </tr>
                                          ))
                                        : rows.map((p, index) => (
                                              <tr key={p.id} className="cursor-pointer" onClick={() => navigate(getCashierAccountRoute(p.id), { state: accountState })}>
                                                  <td data-label={C.NO} data-hide-stack className="num text-right text-muted">
                                                      {firstNo + index}
                                                  </td>
                                                  <td data-primary>
                                                      <Link
                                                          to={getCashierAccountRoute(p.id)}
                                                          state={accountState}
                                                          className="whitespace-nowrap font-semibold text-ink hover:text-primary"
                                                          onClick={(e) => e.stopPropagation()}
                                                      >
                                                          {p.name}
                                                      </Link>
                                                      <span className="num block whitespace-nowrap text-caption text-muted">
                                                          {p.code} · {phoneText(p.phone)}
                                                      </span>
                                                  </td>
                                                  <td data-label={C.LAST_VISIT} className="num whitespace-nowrap">
                                                      {p.lastVisit ? dmy(p.lastVisit) : TEXT.DASH}
                                                  </td>
                                                  <td data-label={C.SERVICES} className="min-w-48">
                                                      <span className="line-clamp-2" title={p.open.map((o) => o.label).filter(Boolean).join(" · ")}>
                                                          {servicesText(p)}
                                                      </span>
                                                  </td>
                                                  <td data-label={C.OWED} className="num whitespace-nowrap text-right font-semibold text-ink">
                                                      {money(p.owed)}
                                                  </td>
                                                  <td data-label={C.STATUS} className="whitespace-nowrap">
                                                      <LabelBadge map={TEXT.PATIENT_STATUS} value={p.status} />
                                                  </td>
                                              </tr>
                                          ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border px-6 py-3">
                            <p className="num text-body-sm text-muted" aria-live="polite">
                                {!loading &&
                                    TEXT.COUNT(
                                        <span key="range" className="font-semibold text-ink">
                                            {firstNo}–{lastNo}
                                        </span>,
                                        <span key="total" className="font-semibold text-ink">
                                            {total}
                                        </span>,
                                    )}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                                <div className="flex items-center gap-2">
                                    <label htmlFor="cashier-size" className="text-body-sm text-muted">
                                        {TEXT.PAGE_SIZE_LABEL}
                                    </label>
                                    <input
                                        id="cashier-size"
                                        type="number"
                                        inputMode="numeric"
                                        min={PAGE_SIZE_MIN}
                                        max={PAGE_SIZE_MAX}
                                        step={1}
                                        className="input num w-20 text-right"
                                        value={sizeBox}
                                        onChange={(e) => setSizeBox(e.target.value)}
                                        onBlur={commitSize}
                                        onKeyDown={(e) => e.key === "Enter" && commitSize()}
                                    />
                                </div>
                                {totalPages > 1 && (
                                    <Pagination
                                        page={page}
                                        totalPages={totalPages}
                                        onChange={(next) => update({ page: next > 1 ? String(next) : "" })}
                                        label={TEXT.PAGINATION}
                                        busy={loading}
                                    />
                                )}
                            </div>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
};

export default CashierPayments;

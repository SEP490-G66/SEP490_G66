import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import Pagination from "@/components/ui/Pagination";
import { money, dmy, phoneText } from "@/components/reception/receptionUtils";
import { LoadError, Stat } from "@/components/cashier/cashierUi";
import { useDebounced, usePageTitle } from "@/hooks/usePatientRecordNav";
import { getDebtPatients } from "@/services/cashierService";
import { clinicToday } from "@/services/receptionService";
import { debtAgeTone } from "@/utils/billing";
import { BILLING_TEXT as TEXT, CASHIER_TEXT as CT } from "@/utils/messages";
import { getCashierAccountRoute } from "@/utils/routes";

const CRUMBS = [{ label: TEXT.FINANCE_CRUMB }, { label: TEXT.DEBTS_TITLE }];
const COLUMNS = TEXT.DEBT_PATIENT_COLUMNS;
const AGES = TEXT.DEBT_AGES.map(([value]) => value).filter(Boolean);

const PAGE_SIZE_MIN = 10;
const PAGE_SIZE_MAX = 30;
const PAGE_SIZE_DEFAULT = 10;

const dateFromUrl = (raw) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw ?? "")) return "";
    const date = new Date(`${raw}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw ? raw : "";
};

const sizeFromUrl = (raw) => {
    if (!/^\d+$/.test(raw ?? "")) return PAGE_SIZE_DEFAULT;
    const n = Number(raw);
    return n >= PAGE_SIZE_MIN && n <= PAGE_SIZE_MAX ? n : PAGE_SIZE_DEFAULT;
};

const servicesText = (patient) => {
    const [first, ...rest] = patient.open;
    if (!first) return CT.DASH;
    const label = first.label || CT.VISIT_ON(dmy(first.date).slice(0, 5));
    return rest.length ? `${label} ${CT.MORE(rest.length)}` : label;
};

const ReceptionDebts = () => {
    const [params, setParams] = useSearchParams();
    const q = params.get("q") ?? "";
    const rawAge = params.get("age");
    const age = AGES.includes(rawAge) ? rawAge : "";
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const rawSize = params.get("size");
    const size = sizeFromUrl(rawSize);
    const rawFrom = params.get("from");
    const rawTo = params.get("to");
    const datesValid = !dateFromUrl(rawFrom) || !dateFromUrl(rawTo) || dateFromUrl(rawFrom) <= dateFromUrl(rawTo);
    const from = datesValid ? dateFromUrl(rawFrom) : "";
    const to = datesValid ? dateFromUrl(rawTo) : "";
    const today = clinicToday();
    const [box, setBox] = useState(q);
    const [sizeBox, setSizeBox] = useState(String(size));
    const [result, setResult] = useState(null);
    const [version, setVersion] = useState(0);
    const { schedule, cancel } = useDebounced(300);

    usePageTitle(TEXT.DEBTS_DOC_TITLE);

    const update = (changes) => {
        const next = new URLSearchParams(window.location.search);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        if (!("page" in changes)) next.delete("page");
        setParams(next, { replace: true });
    };

    useEffect(() => {
        const ageInvalid = rawAge !== null && !AGES.includes(rawAge);
        const sizeInvalid = rawSize !== null && String(sizeFromUrl(rawSize)) !== rawSize;
        const sizeDefault = rawSize !== null && !sizeInvalid && Number(rawSize) === PAGE_SIZE_DEFAULT;
        const fromInvalid = rawFrom !== null && (!datesValid || dateFromUrl(rawFrom) !== rawFrom);
        const toInvalid = rawTo !== null && (!datesValid || dateFromUrl(rawTo) !== rawTo);
        if (!ageInvalid && !sizeInvalid && !sizeDefault && !fromInvalid && !toInvalid) return;
        const next = new URLSearchParams(window.location.search);
        if (ageInvalid) next.delete("age");
        if (sizeInvalid || sizeDefault) next.delete("size");
        if (fromInvalid) next.delete("from");
        if (toInvalid) next.delete("to");
        setParams(next, { replace: true });
    }, [rawAge, rawSize, rawFrom, rawTo, datesValid, setParams]);

    const setDate = (key, value) => {
        const changes = { [key]: value };
        if (key === "from" && value && to && to < value) changes.to = value;
        if (key === "to" && value && from && from > value) changes.from = value;
        update(changes);
    };

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
        getDebtPatients({ q, age, fromDate: from, toDate: to, page, pageSize: size }).then(
            (response) => active && setResult({ key: `${q}|${age}|${from}|${to}|${page}|${size}|${version}`, ...response }),
        );
        return () => {
            active = false;
        };
    }, [q, age, from, to, page, size, version]);

    const loading = result?.key !== `${q}|${age}|${from}|${to}|${page}|${size}|${version}`;
    const rows = result?.data?.items ?? [];
    const total = result?.data?.totalCount ?? 0;
    const totalPages = result?.data?.totalPages ?? 1;
    const firstNo = (page - 1) * size + 1;
    const lastNo = Math.min(firstNo + rows.length - 1, total);
    const filtered = Boolean(q || age || from || to);
    const failed = !loading && result && !result.success;
    const empty = !loading && !failed && !rows.length;
    const statValue = (value) => (loading ? <span className="skeleton block h-7 w-32" /> : failed ? CT.DASH : value);

    return (
        <div className="space-y-6">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.DEBTS_TITLE}</h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <Stat label={TEXT.DEBT_OWED_TOTAL} value={statValue(money(result?.data?.totalOwed ?? 0))} />
                <Stat label={TEXT.DEBT_PATIENTS} value={statValue(String(total))} />
            </div>
            <section className="overflow-hidden rounded-lg border border-border bg-canvas">
                <div className="p-6">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="field w-full sm:w-80">
                            <label htmlFor="debt-search" className="label">
                                {TEXT.SEARCH}
                            </label>
                            <div className="search">
                                <Search aria-hidden="true" />
                                <input
                                    id="debt-search"
                                    type="search"
                                    className="input"
                                    placeholder={TEXT.DEBT_SEARCH_PLACEHOLDER}
                                    value={box}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setBox(value);
                                        schedule(() => update({ q: value.trim() }));
                                    }}
                                />
                            </div>
                        </div>
                        {[
                            ["from", TEXT.FROM, from],
                            ["to", TEXT.TO, to],
                        ].map(([key, label, value]) => (
                            <div key={key} className="field w-full sm:w-auto">
                                <label htmlFor={`debt-${key}`} className="label">
                                    {label}
                                </label>
                                <input id={`debt-${key}`} type="date" className="input w-full sm:w-auto" max={today} value={value} onChange={(e) => setDate(key, e.target.value)} />
                            </div>
                        ))}
                        <div className="field w-full sm:w-auto sm:min-w-48">
                            <label htmlFor="debt-age" className="label">
                                {TEXT.DEBT_AGE}
                            </label>
                            <select id="debt-age" className="input w-full" value={age} onChange={(e) => update({ age: e.target.value })}>
                                {TEXT.DEBT_AGES.map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {filtered && (
                            <button type="button" className="btn-link h-control" onClick={clearFilters}>
                                {TEXT.CLEAR_FILTERS}
                            </button>
                        )}
                    </div>
                </div>
                {failed ? (
                    <div className="border-t border-border p-6">
                        <LoadError onRetry={() => setVersion((v) => v + 1)} />
                    </div>
                ) : empty ? (
                    <div className="empty-state border-t border-border">
                        <p className="empty-state-text">{filtered ? CT.EMPTY : TEXT.DEBT_NONE}</p>
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
                                        <th className="w-14 text-right">{COLUMNS[0]}</th>
                                        <th>{COLUMNS[1]}</th>
                                        <th className="w-full">{COLUMNS[2]}</th>
                                        <th>{COLUMNS[3]}</th>
                                        <th>{COLUMNS[4]}</th>
                                        <th className="text-right">{COLUMNS[5]}</th>
                                        <th className="w-px text-right">{COLUMNS[6]}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading
                                        ? [1, 2, 3, 4].map((n) => (
                                              <tr key={n}>
                                                  <td colSpan={7}>
                                                      <span className="skeleton block h-5 w-full" />
                                                  </td>
                                              </tr>
                                          ))
                                        : rows.map((p, index) => (
                                              <tr key={p.id}>
                                                  <td data-label={COLUMNS[0]} data-hide-stack className="num text-right text-muted">
                                                      {firstNo + index}
                                                  </td>
                                                  <td data-primary>
                                                      <span className="whitespace-nowrap font-semibold text-ink">{p.name}</span>
                                                      <span className="num block whitespace-nowrap text-caption text-muted">
                                                          {p.code} · {phoneText(p.phone)}
                                                      </span>
                                                  </td>
                                                  <td data-label={COLUMNS[2]} className="min-w-48">
                                                      <span className="line-clamp-2" title={p.open.map((o) => o.label).filter(Boolean).join(" · ")}>
                                                          {servicesText(p)}
                                                      </span>
                                                  </td>
                                                  <td data-label={COLUMNS[3]} className="num whitespace-nowrap">
                                                      {p.owedSince ? dmy(p.owedSince) : CT.DASH}
                                                  </td>
                                                  <td data-label={COLUMNS[4]} className="whitespace-nowrap">
                                                      {p.debtDays == null ? (
                                                          CT.DASH
                                                      ) : (
                                                          <span className={`badge ${debtAgeTone(p.debtDays)}`}>{p.debtDays === 0 ? TEXT.TODAY : TEXT.DAYS(p.debtDays)}</span>
                                                      )}
                                                  </td>
                                                  <td data-label={COLUMNS[5]} className="num whitespace-nowrap text-right font-semibold text-ink">
                                                      {money(p.owed)}
                                                  </td>
                                                  <td data-actions className="whitespace-nowrap text-right">
                                                      <Link to={getCashierAccountRoute(p.id)} className="btn btn-primary h-8 px-2.5">
                                                          {TEXT.COLLECT}
                                                      </Link>
                                                  </td>
                                              </tr>
                                          ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border px-6 py-3">
                            <p className="num text-body-sm text-muted" aria-live="polite">
                                {!loading &&
                                    CT.COUNT(
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
                                    <label htmlFor="debt-size" className="text-body-sm text-muted">
                                        {CT.PAGE_SIZE_LABEL}
                                    </label>
                                    <input
                                        id="debt-size"
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
                                        label={TEXT.DEBT_PAGINATION}
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

export default ReceptionDebts;

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import SearchInput from "@/components/ui/SearchInput";
import FilterSelect from "@/components/ui/FilterSelect";
import { Card } from "@/components/reception/shared";
import { money, dmy } from "@/components/reception/receptionUtils";
import { LabelBadge, LoadError } from "@/components/cashier/cashierUi";
import { useDebounced, usePageTitle } from "@/hooks/usePatientRecordNav";
import { getPaymentPatients } from "@/services/cashierService";
import { PATIENT_STATUS_ORDER } from "@/utils/cashier";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { getCashierAccountRoute } from "@/utils/routes";

const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.LIST_TITLE }];
const DAYS = ["today", "all", "custom"];
const STATUS_OPTIONS = PATIENT_STATUS_ORDER.map((value) => ({ value, label: TEXT.PATIENT_STATUS[value][0] }));
const C = TEXT.COLUMNS;

// "Cấy ghép Implant răng 36 +1": plans first, then walk-ins with money left
const servicesText = (patient) => {
    const [first, ...rest] = patient.open;
    if (!first) return TEXT.DASH;
    const label = first.kind === "plan" ? first.label : TEXT.VISIT_ON(dmy(first.date).slice(0, 5));
    return rest.length ? `${label} ${TEXT.MORE(rest.length)}` : label;
};

// Thanh toán: patients by visit day and payment state; a typed search looks at every day (R1)
const CashierPayments = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const q = params.get("q") ?? "";
    const day = DAYS.includes(params.get("day")) ? params.get("day") : "today";
    const date = params.get("date") ?? "";
    const status = PATIENT_STATUS_ORDER.includes(params.get("status")) ? params.get("status") : "";
    const [box, setBox] = useState(q);
    const [result, setResult] = useState(null);
    const [version, setVersion] = useState(0);
    const { schedule, cancel } = useDebounced(300);

    usePageTitle(TEXT.LIST_DOC_TITLE);

    // Reads the URL as it is now, so a search typed a moment ago never brings back filters changed since
    const update = (changes) => {
        const next = new URLSearchParams(window.location.search);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        setParams(next, { replace: true });
    };

    // Back / Forward change q without typing: keep the box in step with the URL
    const [shownQ, setShownQ] = useState(q);
    if (shownQ !== q) {
        setShownQ(q);
        if (box.trim() !== q) setBox(q);
    }

    useEffect(() => {
        let active = true;
        getPaymentPatients({ q, day, date, status }).then((response) => active && setResult({ key: `${q}|${day}|${date}|${status}|${version}`, ...response }));
        return () => {
            active = false;
        };
    }, [q, day, date, status, version]);

    const loading = result?.key !== `${q}|${day}|${date}|${status}|${version}`;
    const rows = result?.data ?? [];
    const filtered = Boolean(q || status || day !== "today");

    return (
        <div className="app-content min-h-full space-y-5">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.LIST_TITLE}</h1>
            </div>
            <Card className="overflow-hidden">
                <div className="flex flex-wrap items-end gap-3 px-5 py-4">
                    <SearchInput
                        id="cashier-search"
                        label={TEXT.SEARCH_LABEL}
                        placeholder={TEXT.SEARCH_PLACEHOLDER}
                        value={box}
                        className="min-w-64 flex-1"
                        onChange={(value) => {
                            setBox(value);
                            schedule(() => update({ q: value.trim() }));
                        }}
                    />
                    <select
                        id="cashier-day"
                        className="input w-auto min-w-36"
                        aria-label={TEXT.DAY_LABEL}
                        value={day}
                        disabled={Boolean(q)}
                        onChange={(e) => update({ day: e.target.value === "today" ? "" : e.target.value, date: e.target.value === "custom" ? date : "" })}
                    >
                        {DAYS.map((d) => (
                            <option key={d} value={d}>
                                {TEXT.DAY_LABEL}: {TEXT.DAYS[d]}
                            </option>
                        ))}
                    </select>
                    {day === "custom" && (
                        <input
                            type="date"
                            className="input w-auto"
                            aria-label={TEXT.DATE_LABEL}
                            value={date}
                            disabled={Boolean(q)}
                            onChange={(e) => update({ date: e.target.value })}
                        />
                    )}
                    <FilterSelect id="cashier-status" label={TEXT.STATUS_LABEL} options={STATUS_OPTIONS} value={status} onChange={(value) => update({ status: value })} />
                </div>
                <p className="px-5 pb-3 text-caption text-muted" aria-live="polite">
                    {q ? `${TEXT.SEARCH_ALL_DAYS} ` : ""}
                    {!loading && result?.success ? TEXT.COUNT(rows.length) : ""}
                </p>
                {!loading && result && !result.success ? (
                    <div className="px-5 pb-5">
                        <LoadError onRetry={() => setVersion((v) => v + 1)} />
                    </div>
                ) : !loading && !rows.length ? (
                    <div className="empty-state">
                        <p className="empty-state-text">{!q && day === "custom" && !date ? TEXT.PICK_DATE : TEXT.EMPTY}</p>
                        {filtered && (
                            <button
                                type="button"
                                className="btn btn-secondary mt-4"
                                onClick={() => {
                                    cancel();
                                    setBox("");
                                    setParams({}, { replace: true });
                                }}
                            >
                                {TEXT.CLEAR_FILTERS}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="table-wrap rounded-none border-x-0 border-b-0" aria-busy={loading ? "true" : undefined}>
                        <table className="table table-stack">
                            <thead>
                                <tr>
                                    <th>{C.PATIENT}</th>
                                    <th>{C.LAST_VISIT}</th>
                                    <th>{C.SERVICES}</th>
                                    <th className="text-right">{C.OWED}</th>
                                    <th>{C.STATUS}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading
                                    ? [1, 2, 3, 4].map((n) => (
                                          <tr key={n}>
                                              <td colSpan={5}>
                                                  <span className="skeleton block h-5 w-full" />
                                              </td>
                                          </tr>
                                      ))
                                    : rows.map((p) => (
                                          <tr key={p.id} className="cursor-pointer" onClick={() => navigate(getCashierAccountRoute(p.id))}>
                                              <td data-primary>
                                                  <Link to={getCashierAccountRoute(p.id)} className="font-semibold text-ink hover:text-primary" onClick={(e) => e.stopPropagation()}>
                                                      {p.name}
                                                  </Link>
                                                  <span className="num block text-caption text-muted">
                                                      {p.code} · {String(p.phone ?? "").replace(/^\+84/, "0")}
                                                  </span>
                                              </td>
                                              <td data-label={C.LAST_VISIT} className="num whitespace-nowrap">
                                                  {p.lastVisit ? dmy(p.lastVisit) : TEXT.DASH}
                                              </td>
                                              <td data-label={C.SERVICES}>{servicesText(p)}</td>
                                              <td data-label={C.OWED} className="num whitespace-nowrap text-right font-semibold text-ink">
                                                  {money(p.owed)}
                                              </td>
                                              <td data-label={C.STATUS}>
                                                  <LabelBadge map={TEXT.PATIENT_STATUS} value={p.status} />
                                              </td>
                                          </tr>
                                      ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default CashierPayments;

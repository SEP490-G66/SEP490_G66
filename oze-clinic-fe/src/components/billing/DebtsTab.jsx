import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LabeledSelect from "@/components/ui/LabeledSelect";
import Pagination from "@/components/ui/Pagination";
import InvoiceDetailDialog from "./InvoiceDetailDialog";
import { Card } from "@/components/reception/shared";
import { money, phoneText } from "@/components/reception/receptionUtils";
import { clinicToday, getDebts } from "@/services/receptionService";
import { debtAgeTone } from "@/utils/billing";
import { dmy } from "@/utils/calendar";
import { dateKey } from "@/utils/cashShift";
import { BILLING_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import { cx } from "@/utils/cx";

const PAGE_SIZE = 10;

// Days the debt has been open: from the backend, else counted from the invoice date; null when neither is known.
const ageOf = (debt, today) => {
    const given = Number(debt.ageDays);
    if (debt.ageDays != null && Number.isFinite(given)) return Math.max(0, Math.floor(given));
    const since = dateKey(debt.createdAt);
    return since ? Math.max(0, Math.round((Date.parse(today) - Date.parse(since)) / 86400000)) : null;
};

const DebtsTab = () => {
    const navigate = useNavigate();
    const [keyword, setKeyword] = useState("");
    const [age, setAge] = useState("");
    const [page, setPage] = useState(1);
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [detail, setDetail] = useState(null);

    const key = JSON.stringify([keyword, age, page, reload]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            getDebts({ keyword: keyword.trim(), ageBucket: age, page, pageSize: PAGE_SIZE }, { skipErrorPage: true, signal: controller.signal }).then((response) => {
                if (controller.signal.aborted || response.aborted) return;
                const lastPage = Math.max(1, Number(response.data?.totalPages ?? 1));
                if (response.success && page > lastPage) {
                    setPage(lastPage);
                    return;
                }
                const items = response.success ? (response.data?.items ?? []) : [];
                setResult({
                    key,
                    ok: response.success,
                    items,
                    total: Number(response.data?.totalCount ?? items.length),
                    totalPages: Math.max(1, Number(response.data?.totalPages ?? 1)),
                    // Only the backend knows the total over every page; a page's own sum would understate it.
                    sum: response.success && response.data?.totalRemaining != null ? Number(response.data.totalRemaining) : null,
                });
            });
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [keyword, age, page, key]);

    const items = result?.items ?? [];
    const fresh = result?.key === key;
    const today = clinicToday();

    return (
        <div className="space-y-5">
            <Card>
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                    <div className="flex min-w-56 flex-1 flex-col gap-1">
                        <label htmlFor="debt-q" className="text-caption text-muted">
                            {TEXT.SEARCH}
                        </label>
                        <input
                            id="debt-q"
                            type="search"
                            className="input"
                            placeholder={TEXT.SEARCH_PLACEHOLDER}
                            value={keyword}
                            onChange={(e) => {
                                setKeyword(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <LabeledSelect
                        id="debt-age"
                        label={TEXT.DEBT_AGE}
                        value={age}
                        options={TEXT.DEBT_AGES}
                        onChange={(v) => {
                            setAge(v);
                            setPage(1);
                        }}
                    />
                    <span className="flex-1" />
                    <div className="text-right">
                        <small className="block text-caption text-muted">{TEXT.DEBT_TOTAL}</small>
                        <b className="num font-heading text-heading-3 text-danger">{fresh && result?.sum != null ? money(result.sum) : "—"}</b>
                    </div>
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
                        <div className="skeleton h-10 rounded" />
                    </div>
                ) : !result.ok && !items.length ? null : !items.length ? (
                    <p className="px-6 py-10 text-center text-body-sm text-muted">{TEXT.DEBT_EMPTY}</p>
                ) : (
                    <div className={cx("table-wrap rounded-none border-x-0", !fresh && "opacity-60")} aria-busy={!fresh ? "true" : undefined}>
                        <table className="table table-stack [&_td]:px-3 [&_td]:align-top [&_th]:px-3">
                            <thead>
                                <tr>
                                    {TEXT.DEBT_COLUMNS.map((c, i) => (
                                        <th key={c} className={i >= 4 && i <= 6 ? "text-right" : undefined}>
                                            {i === TEXT.DEBT_COLUMNS.length - 1 ? <span className="sr-only">{c}</span> : c}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((d) => {
                                    const days = ageOf(d, today);
                                    return (
                                        <tr key={d.invoiceId}>
                                            <td data-label={TEXT.DEBT_COLUMNS[0]} className="whitespace-nowrap">
                                                {d.invoiceNumber}
                                            </td>
                                            <td data-label={TEXT.DEBT_COLUMNS[1]} className="num whitespace-nowrap">
                                                {d.createdAt ? dmy(dateKey(d.createdAt)) : "—"}
                                            </td>
                                            <td data-primary>
                                                <span className="cell-primary">{d.patientName}</span>
                                            </td>
                                            <td data-label={TEXT.DEBT_COLUMNS[3]} className="num whitespace-nowrap">
                                                {phoneText(d.patientPhoneNumber)}
                                            </td>
                                            <td data-label={TEXT.DEBT_COLUMNS[4]} className="num whitespace-nowrap text-right">
                                                {money(d.finalAmount ?? d.totalAmount)}
                                            </td>
                                            <td data-label={TEXT.DEBT_COLUMNS[5]} className="num whitespace-nowrap text-right">
                                                {money(d.paidAmount)}
                                            </td>
                                            <td data-label={TEXT.DEBT_COLUMNS[6]} className="num whitespace-nowrap text-right font-semibold text-danger">
                                                {money(d.remainingAmount)}
                                            </td>
                                            <td data-label={TEXT.DEBT_COLUMNS[7]}>
                                                {days == null ? "—" : <span className={cx("badge", debtAgeTone(days))}>{days === 0 ? TEXT.TODAY : TEXT.DAYS(days)}</span>}
                                            </td>
                                            <td data-actions>
                                                <div className="ml-auto grid w-max grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary h-8 px-2.5"
                                                        disabled={!fresh}
                                                        onClick={() => navigate(`${ROUTES.RECEPTION_INVOICES}?invoice=${d.invoiceId}`)}
                                                    >
                                                        {TEXT.COLLECT}
                                                    </button>
                                                    <button type="button" className="btn btn-secondary h-8 px-2.5" onClick={() => setDetail(d.invoiceId)}>
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
                            {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + items.length} / {result.total}
                        </p>
                        {result.totalPages > 1 && <Pagination page={page} totalPages={result.totalPages} onChange={setPage} busy={!fresh} />}
                    </div>
                )}
            </Card>
            {detail && <InvoiceDetailDialog invoiceId={detail} onClose={() => setDetail(null)} onChanged={() => setReload((n) => n + 1)} />}
        </div>
    );
};

export default DebtsTab;

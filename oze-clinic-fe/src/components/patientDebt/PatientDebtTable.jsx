import { useLayoutEffect, useRef } from "react";
import { Search } from "lucide-react";
import DetailLink from "@/components/ui/DetailLink";
import Pagination from "@/components/ui/Pagination";
import StatusBadge from "@/components/ui/StatusBadge";
import { cx } from "@/utils/cx";
import { formatCurrency } from "@/utils/format";
import { isPlainClick } from "@/utils/medicalRecord";
import { PATIENT_DEBT_PAY_TYPE, PATIENT_DEBT_STATUS, PATIENT_DEBT_TEXT } from "@/utils/messages";
import { DEBT_PAGE_SIZE, pageCount } from "@/utils/patientDebt";
import { getPaymentDebtDetailRoute } from "@/utils/routes";

const OpenLink = ({ item, linkState, onOpen, className }) => (
    <DetailLink
        to={getPaymentDebtDetailRoute(item.id)}
        state={linkState}
        context={PATIENT_DEBT_TEXT.DETAIL_CONTEXT(item.name, item.start)}
        className={className}
        data-debt-open={item.id}
        onClick={(event) => {
            if (isPlainClick(event)) onOpen(item.id);
        }}
    >
        {PATIENT_DEBT_TEXT.VIEW_DETAIL}
    </DetailLink>
);

const PatientDebtTable = ({ list, page, separated, linkState, onOpen, onPageChange, onClearAll }) => {
    const pagerRef = useRef(null);
    const pendingPage = useRef(false);

    useLayoutEffect(() => {
        if (!pendingPage.current) return;
        pendingPage.current = false;
        const active = document.activeElement;
        if (!active || active === document.body || active.disabled) pagerRef.current?.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
    });

    if (!list.length) {
        return (
            <div className={cx("empty-state", separated && "border-t border-border")}>
                <Search className="empty-state-icon" aria-hidden="true" />
                <p className="empty-state-title" aria-hidden="true">
                    {PATIENT_DEBT_TEXT.NO_RESULT}
                </p>
                <p className="empty-state-text">{PATIENT_DEBT_TEXT.NO_RESULT_TEXT}</p>
                <button type="button" className="btn btn-secondary mt-3 h-8 px-3" onClick={onClearAll}>
                    {PATIENT_DEBT_TEXT.CLEAR_QUERY}
                </button>
            </div>
        );
    }

    const totalPages = pageCount(list.length);
    const from = (page - 1) * DEBT_PAGE_SIZE;
    const rows = list.slice(from, from + DEBT_PAGE_SIZE);

    const changePage = (next) => {
        pendingPage.current = true;
        onPageChange(next);
    };

    return (
        <>
            <div className="hidden overflow-x-auto xl:block">
                <table className="table">
                    <caption className="sr-only">{PATIENT_DEBT_TEXT.TABLE_CAPTION}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{PATIENT_DEBT_TEXT.COL_NAME}</th>
                            <th scope="col" className="whitespace-nowrap">{PATIENT_DEBT_TEXT.COL_TYPE}</th>
                            <th scope="col" className="text-right">
                                {PATIENT_DEBT_TEXT.COL_TOTAL}
                            </th>
                            <th scope="col" className="text-right">
                                {PATIENT_DEBT_TEXT.COL_PAID}
                            </th>
                            <th scope="col" className="text-right">
                                {PATIENT_DEBT_TEXT.COL_DUE}
                            </th>
                            <th scope="col" className="text-right">
                                {PATIENT_DEBT_TEXT.COL_PLANNED}
                            </th>
                            <th scope="col">{PATIENT_DEBT_TEXT.COL_STATUS}</th>
                            <th scope="col">
                                <span className="sr-only">{PATIENT_DEBT_TEXT.COL_ACTION}</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((item) => (
                            <tr key={item.id}>
                                <td className="min-w-56 py-2">
                                    <span className="font-semibold text-ink">{item.name}</span>
                                    <p className="num text-caption text-muted">{item.type === "once" ? item.sub : `${item.sub} · ${PATIENT_DEBT_TEXT.STARTED_ON(item.start)}`}</p>
                                </td>
                                <td className="whitespace-nowrap">
                                    <StatusBadge status={item.type} labels={PATIENT_DEBT_PAY_TYPE} />
                                </td>
                                <td className="whitespace-nowrap text-right">{formatCurrency(item.total)}</td>
                                <td className="whitespace-nowrap text-right text-success">{formatCurrency(item.paid)}</td>
                                <td className={cx("whitespace-nowrap text-right font-semibold", item.due > 0 ? "text-danger" : "text-ink")}>{formatCurrency(item.due)}</td>
                                <td className="whitespace-nowrap text-right text-muted">{formatCurrency(item.planned)}</td>
                                <td className="whitespace-nowrap py-2">
                                    <StatusBadge status={item.status} labels={PATIENT_DEBT_STATUS} />
                                    {item.next && <p className="num text-caption text-muted">{PATIENT_DEBT_TEXT.NEXT_PERIOD(item.next.date)}</p>}
                                </td>
                                <td className="text-right">
                                    <OpenLink item={item} linkState={linkState} onOpen={onOpen} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className={cx("divide-y divide-border xl:hidden", separated && "border-t border-border")}>
                {rows.map((item) => (
                    <li key={item.id} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-ink">{item.name}</span>
                            <StatusBadge status={item.type} labels={PATIENT_DEBT_PAY_TYPE} />
                        </div>
                        <p className="mt-0.5 text-caption text-muted">{item.sub}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span>
                                {PATIENT_DEBT_TEXT.DUE} <b className={cx("num font-semibold", item.due > 0 ? "text-danger" : "text-ink")}>{formatCurrency(item.due)}</b>
                            </span>
                            <span className="num text-caption text-muted">
                                {PATIENT_DEBT_TEXT.PLANNED} {formatCurrency(item.planned)}
                            </span>
                            <span className="num text-caption text-muted">
                                {PATIENT_DEBT_TEXT.TOTAL} {formatCurrency(item.total)}
                            </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <StatusBadge status={item.status} labels={PATIENT_DEBT_STATUS} />
                            <span className="num text-caption text-muted">
                                {item.next ? PATIENT_DEBT_TEXT.NEXT_PERIOD(item.next.date) : PATIENT_DEBT_TEXT.STARTED_ON(item.start)}
                            </span>
                        </div>
                        <OpenLink item={item} linkState={linkState} onOpen={onOpen} className="mt-0.5 min-h-11" />
                    </li>
                ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <span className="num text-caption text-muted">{PATIENT_DEBT_TEXT.RANGE(from + 1, Math.min(from + DEBT_PAGE_SIZE, list.length), list.length)}</span>
                {totalPages > 1 && (
                    <div ref={pagerRef} className="-m-1 max-w-full overflow-x-auto p-1">
                        <Pagination page={page} totalPages={totalPages} onChange={changePage} label={PATIENT_DEBT_TEXT.PAGINATION} />
                    </div>
                )}
            </div>
        </>
    );
};

export default PatientDebtTable;

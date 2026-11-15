import { Link } from "react-router-dom";
import { Card } from "@/components/reception/shared";
import { DASHBOARD_TEXT as TEXT } from "@/utils/messages";

// paging: the object returned by usePaging
const OverviewTable = ({ id, title, count, hint, link, keyword, onKeyword, filters, columns, paging, renderRow, empty, loading }) => (
    <Card
        title={
            <span className="flex flex-wrap items-center gap-2">
                {title}
                <span className="num rounded-full bg-primary-soft px-2 text-caption font-semibold text-primary">{count}</span>
                <small className="font-sans text-caption font-normal text-muted">{hint}</small>
            </span>
        }
        actions={
            <Link to={link.to} className="text-label font-semibold text-primary hover:underline">
                {link.label}
            </Link>
        }
    >
        <div className="flex flex-wrap items-end gap-3 px-4 py-3">
            <div className="flex min-w-60 flex-1 flex-col">
                <label htmlFor={`${id}-q`} className="sr-only">
                    {TEXT.SEARCH_LABEL}
                </label>
                <input id={`${id}-q`} type="search" className="input" placeholder={TEXT.SEARCH_PLACEHOLDER} value={keyword} onChange={(e) => onKeyword(e.target.value)} />
            </div>
            {filters}
        </div>
        {paging.pageItems.length ? (
            <div className="table-wrap rounded-none border-x-0">
                <table className="table table-stack [&_td]:px-3 [&_td]:align-top [&_th]:px-3">
                    <thead>
                        <tr>
                            {columns.map((c, i) => (
                                <th key={c}>{i === columns.length - 1 ? <span className="sr-only">{c}</span> : c}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>{paging.pageItems.map(renderRow)}</tbody>
                </table>
            </div>
        ) : (
            <p className="border-t border-border px-6 py-8 text-center text-body-sm text-muted">{loading ? "…" : empty}</p>
        )}
        {paging.footer}
    </Card>
);

export default OverviewTable;

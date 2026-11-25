import { money } from "@/components/reception/receptionUtils";
import { RECON_ISSUE, RECON_RESULT } from "@/utils/reconciliation";
import { RECON_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const ISSUE_TEXT = { [RECON_ISSUE.SHORT]: TEXT.SHORT, [RECON_ISSUE.OVER]: TEXT.OVER, [RECON_ISSUE.OUTSIDE]: TEXT.OUTSIDE };

const Result = ({ result, openCount, issues = [], pending }) => {
    if (result === RECON_RESULT.NOT_CHECKED) {
        return (
            <>
                <span className="badge badge-neutral">{TEXT.NOT_CHECKED}</span>
                <span className="block text-caption text-muted">{TEXT.OPEN_SESSIONS(openCount)}</span>
                {pending?.count > 0 && <span className="num block text-caption text-warning">{TEXT.PENDING_WAIT(pending.count, money(pending.amount))}</span>}
            </>
        );
    }
    if (result === RECON_RESULT.PENDING) {
        return (
            <>
                <span className="badge badge-warning">{TEXT.PENDING}</span>
                <span className="num block text-caption text-warning">{TEXT.PENDING_LINE(pending.count, money(pending.amount))}</span>
            </>
        );
    }
    if (result === RECON_RESULT.MISMATCH) {
        return (
            <>
                <span className="badge badge-danger">{TEXT.MISMATCH}</span>
                {issues.map((issue) => (
                    <span key={issue.kind} className="num block text-caption text-danger">
                        {ISSUE_TEXT[issue.kind](money(issue.amount))}
                    </span>
                ))}
            </>
        );
    }
    return <span className="badge badge-success">{TEXT.MATCH}</span>;
};

const DailyChannelTable = ({ view, stack = true }) => {
    const rows = [
        {
            key: "cash",
            label: TEXT.CASH,
            system: view.cash.system,
            hint: TEXT.CASH_COLLECTED(money(view.cash.collected)),
            counted: view.cash.counted,
            result: <Result result={view.cash.result} openCount={view.openCount} issues={view.cash.issues} />,
        },
        {
            key: "transfer",
            label: TEXT.TRANSFER,
            system: view.transfer.system,
            hint: TEXT.TRANSFER_CONFIRMED,
            counted: null,
            result: <Result result={view.transfer.result} openCount={view.openCount} pending={view.pending} />,
        },
    ];
    return (
        <table className={cx("table", stack && "table-stack")}>
            <thead>
                <tr>
                    {TEXT.COLUMNS.map((c, i) => (
                        <th key={c} className={i === 1 || i === 2 ? "text-right" : undefined}>
                            {c}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.key}>
                        <td data-primary className="font-semibold text-ink">
                            {row.label}
                        </td>
                        <td data-label={TEXT.COLUMNS[1]} className="num text-right">
                            <span className="font-semibold text-ink">{money(row.system)}</span>
                            <span className="block text-caption text-muted">{row.hint}</span>
                        </td>
                        <td data-label={TEXT.COLUMNS[2]} className="num text-right">
                            {row.counted == null ? "—" : money(row.counted)}
                        </td>
                        <td data-label={TEXT.COLUMNS[3]}>{row.result}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default DailyChannelTable;

import { cx } from "@/utils/cx";
import { formatCurrency } from "@/utils/format";

const Tile = ({ label, children }) => (
    <div className="rounded-md bg-surface-tint px-4 py-3">
        <p className="text-caption text-muted">{label}</p>
        <div className="mt-1 text-title text-ink">{children}</div>
    </div>
);

const has = (value) => value !== null && value !== undefined && value !== "";

// Summary tiles of a treatment plan (Figma: Chi tiết kế hoạch): doctor, pay type, progress (with bar),
// estimated total, paid (green) and remaining (red while > 0). A tile without data is left out.
// summary: { doctorName, payTypeLabel, completed, total, estimatedTotal, paid, remaining }
const PlanSummaryGrid = ({ summary }) => {
    const percent = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
    return (
        <div className="card-app grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {has(summary.doctorName) && <Tile label="Bác sĩ phụ trách">{summary.doctorName}</Tile>}
            {has(summary.payTypeLabel) && <Tile label="Hình thức thanh toán">{summary.payTypeLabel}</Tile>}
            <Tile label="Tiến độ điều trị">
                <span className="num">
                    {summary.completed}/{summary.total} buổi hoàn thành
                </span>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-label="Tiến độ điều trị" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                </div>
            </Tile>
            {has(summary.estimatedTotal) && (
                <Tile label="Tổng chi phí dự kiến">
                    <span className="num font-heading text-heading-3">{formatCurrency(summary.estimatedTotal)}</span>
                </Tile>
            )}
            {has(summary.paid) && (
                <Tile label="Đã thanh toán">
                    <span className="num font-heading text-heading-3 text-success">{formatCurrency(summary.paid)}</span>
                </Tile>
            )}
            {has(summary.remaining) && (
                <Tile label="Còn lại">
                    <span className={cx("num font-heading text-heading-3", summary.remaining > 0 ? "text-danger" : "text-ink")}>{formatCurrency(summary.remaining)}</span>
                </Tile>
            )}
        </div>
    );
};

export default PlanSummaryGrid;

import DashboardSection from "@/components/dashboard/DashboardSection";
import DataTable from "@/components/ui/DataTable";
import { cx } from "@/utils/cx";
import { formatCurrency, formatDate } from "@/utils/format";

const TITLE_ID = "plan-sessions-title";

const Badge = ({ value }) => (value ? <span className={cx("badge", value.badge)}>{value.label}</span> : null);

const AmountCell = ({ session }) => (
    <div className="flex flex-col items-end">
        <span className="num font-semibold text-ink">{formatCurrency(session.amountDue)}</span>
        {session.depositApplied > 0 && <span className="num text-caption text-muted">Đã trừ tiền cọc {formatCurrency(session.depositApplied)}</span>}
        {session.paidAmount > 0 && <span className="num text-caption text-muted">Đã trả {formatCurrency(session.paidAmount)}</span>}
    </div>
);

// "Theo dõi tiến độ điều trị" table of a plan (Figma: Chi tiết kế hoạch).
// sessions: [{ id, order, content, date, doctorName, status: {label,badge}, amountDue, depositApplied, paidAmount, payment: {label,badge} }]
// renderAction(session) optionally fills the "Thao tác" column.
const PlanSessionTable = ({ sessions = [], renderAction }) => {
    const columns = [
        { key: "order", label: "Buổi", primary: true, render: (session) => <span className="font-semibold text-ink">Buổi {session.order}</span> },
        { key: "content", label: "Nội dung", block: true },
        { key: "date", label: "Ngày", render: (session) => formatDate(session.date) || "Chưa lên lịch" },
        { key: "doctorName", label: "Bác sĩ phụ trách" },
        { key: "status", label: "Trạng thái", render: (session) => <Badge value={session.status} /> },
        { key: "amountDue", label: "Số tiền cần thanh toán", align: "right", render: (session) => <AmountCell session={session} /> },
        { key: "payment", label: "Thanh toán", render: (session) => <Badge value={session.payment} /> },
        ...(renderAction ? [{ key: "actions", label: "Thao tác", align: "right", actions: true, render: renderAction }] : []),
    ];

    return (
        <DashboardSection id={TITLE_ID} title="Theo dõi tiến độ điều trị">
            <DataTable columns={columns} rows={sessions} labelledBy={TITLE_ID} empty="Kế hoạch chưa có buổi điều trị." />
        </DashboardSection>
    );
};

export default PlanSessionTable;

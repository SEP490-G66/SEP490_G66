import { Eye } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import IconLinkButton from "@/components/ui/IconLinkButton";
import { cx } from "@/utils/cx";
import { formatCurrency, formatDate } from "@/utils/format";
import { getPaymentDebtDetailRoute } from "@/utils/routes";

// "Lịch sử thanh toán · Trả theo đợt" tab (Figma 1244:4233). The detail reuses PatientDebtOverview,
// PatientDebtSchedule and PatientDebtPayments on /payments/debts/:id.
// plans: [{ id, name, doctorName, installmentCount, total, paid, remaining, status: { label, badge }, createdAt }]
const InstallmentTable = ({ plans = [], offset = 0, loading = false, labelledBy, empty = "Chưa có kế hoạch trả theo đợt nào.", footer }) => {
    const columns = [
        { key: "stt", label: "STT", hideStack: true, render: (_, index) => offset + index + 1 },
        { key: "name", label: "Tên dịch vụ", primary: true, render: (plan) => <span className="font-semibold text-ink">{plan.name}</span> },
        { key: "doctorName", label: "Bác sĩ phụ trách" },
        { key: "installmentCount", label: "Số đợt", align: "right" },
        { key: "total", label: "Tổng chi phí", align: "right", render: (plan) => formatCurrency(plan.total) },
        { key: "paid", label: "Đã trả", align: "right", render: (plan) => <span className="num text-success">{formatCurrency(plan.paid)}</span> },
        {
            key: "remaining",
            label: "Còn lại",
            align: "right",
            render: (plan) => (plan.remaining > 0 ? <span className="num font-semibold text-danger">{formatCurrency(plan.remaining)}</span> : <span className="text-muted">—</span>),
        },
        { key: "status", label: "Trạng thái", render: (plan) => plan.status && <span className={cx("badge", plan.status.badge)}>{plan.status.label}</span> },
        { key: "createdAt", label: "Ngày tạo", render: (plan) => formatDate(plan.createdAt) },
        { key: "actions", label: "Thao tác", align: "right", actions: true, render: (plan) => <IconLinkButton icon={Eye} label={`Xem chi tiết trả theo đợt ${plan.name}`} to={getPaymentDebtDetailRoute(plan.id)} /> },
    ];

    return <DataTable columns={columns} rows={plans} labelledBy={labelledBy} loading={loading} empty={empty} footer={footer} />;
};

export default InstallmentTable;

import { Eye } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import IconLinkButton from "@/components/ui/IconLinkButton";
import { cx } from "@/utils/cx";
import { formatDate } from "@/utils/format";
import { getTreatmentPlanRoute } from "@/utils/routes";

// "Kế hoạch điều trị" list (Figma 1240:4408).
// plans: [{ id, name, doctorName, sessionCount, payTypeLabel, createdAt, status: { label, badge } }]
const TreatmentPlanTable = ({ plans = [], offset = 0, loading = false, labelledBy, empty = "Chưa có kế hoạch điều trị nào.", footer }) => {
    const columns = [
        { key: "stt", label: "STT", hideStack: true, render: (_, index) => offset + index + 1 },
        { key: "name", label: "Dịch vụ", primary: true, render: (plan) => <span className="font-semibold text-ink">{plan.name}</span> },
        { key: "doctorName", label: "Bác sĩ phụ trách" },
        { key: "sessionCount", label: "Số buổi", align: "right" },
        { key: "payTypeLabel", label: "Hình thức thanh toán", optional: true },
        { key: "createdAt", label: "Ngày lập kế hoạch", render: (plan) => formatDate(plan.createdAt) },
        { key: "status", label: "Trạng thái", render: (plan) => plan.status && <span className={cx("badge", plan.status.badge)}>{plan.status.label}</span> },
        { key: "actions", label: "Thao tác", align: "right", actions: true, render: (plan) => <IconLinkButton icon={Eye} label={`Xem kế hoạch ${plan.name}`} to={getTreatmentPlanRoute(plan.id)} /> },
    ];

    return <DataTable columns={columns} rows={plans} labelledBy={labelledBy} loading={loading} empty={empty} footer={footer} />;
};

export default TreatmentPlanTable;

import DashboardSection from "@/components/dashboard/DashboardSection";
import KeyValueList from "@/components/ui/KeyValueList";
import { formatDate, formatWeekday } from "@/utils/format";

const TITLE_ID = "visit-info-title";

// "Thông tin khám" of one visit (Figma: Chi tiết lần khám). Allergies are highlighted in red.
// visit: { date, doctorName, serviceName, history, conditions, allergies }
const VisitInfoCard = ({ visit }) => {
    const items = [
        { label: "Ngày khám", value: visit.date ? `${formatWeekday(visit.date)}, ${formatDate(visit.date)}` : "" },
        { label: "Tiểu sử bệnh", value: visit.history },
        { label: "Bác sĩ phụ trách", value: visit.doctorName },
        { label: "Bệnh nền", value: visit.conditions || "Không có" },
        { label: "Dịch vụ", value: visit.serviceName },
        { label: "Dị ứng", value: visit.allergies || "Không có", tone: visit.allergies ? "danger" : undefined },
    ];

    return (
        <DashboardSection id={TITLE_ID} title="Thông tin khám">
            <KeyValueList items={items} columns={2} />
        </DashboardSection>
    );
};

export default VisitInfoCard;

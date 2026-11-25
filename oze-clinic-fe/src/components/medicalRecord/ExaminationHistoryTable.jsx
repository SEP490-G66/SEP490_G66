import { Eye } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import IconLinkButton from "@/components/ui/IconLinkButton";
import { formatDate } from "@/utils/format";
import { getMedicalRecordDetailRoute } from "@/utils/routes";

// "Lịch sử khám" list (Figma 1240:3983). visits: [{ examinationId, date, serviceName, doctorName }].
// offset = index of the first row on this page (for STT). Toolbar (FilterBar + SearchInput + FilterSelect)
// and Pagination are composed by the page; pass the pagination as footer.
const ExaminationHistoryTable = ({ visits = [], offset = 0, loading = false, labelledBy, empty = "Chưa có lần khám nào.", footer }) => {
    const columns = [
        { key: "stt", label: "STT", hideStack: true, render: (_, index) => offset + index + 1 },
        { key: "date", label: "Ngày khám", primary: true, render: (visit) => <span className="font-semibold text-ink">{formatDate(visit.date)}</span> },
        { key: "serviceName", label: "Dịch vụ", block: true },
        { key: "doctorName", label: "Bác sĩ phụ trách" },
        {
            key: "actions",
            label: "Thao tác",
            align: "right",
            actions: true,
            render: (visit) => <IconLinkButton icon={Eye} label={`Xem lần khám ngày ${formatDate(visit.date)}`} to={getMedicalRecordDetailRoute(visit.examinationId)} />,
        },
    ];

    return <DataTable columns={columns} rows={visits} rowKey="examinationId" labelledBy={labelledBy} loading={loading} empty={empty} footer={footer} />;
};

export default ExaminationHistoryTable;

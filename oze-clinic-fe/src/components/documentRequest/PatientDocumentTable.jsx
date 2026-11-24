import { Eye, RotateCw, Trash2 } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import IconLinkButton from "@/components/ui/IconLinkButton";
import { cx } from "@/utils/cx";
import { formatDateTime } from "@/utils/format";

// "Cung cấp tài liệu" list (Figma 1242:4131): documents the patient brought from other places.
// documents: [{ id, name, provider, uploadedAt, status: { label, badge }, failed }]
// A failed upload also gets "Tải lại". The upload popup reuses imagingTechnician/ManualUploadDialog.
const PatientDocumentTable = ({ documents = [], offset = 0, loading = false, busyIds = [], labelledBy, empty = "Bạn chưa tải lên tài liệu nào.", footer, onView, onRetry, onDelete }) => {
    const columns = [
        { key: "stt", label: "STT", hideStack: true, render: (_, index) => offset + index + 1 },
        { key: "name", label: "Tên tài liệu", primary: true, render: (doc) => <span className="font-semibold text-ink">{doc.name}</span> },
        { key: "provider", label: "Địa chỉ cung cấp", block: true },
        { key: "uploadedAt", label: "Ngày upload", render: (doc) => formatDateTime(doc.uploadedAt) },
        { key: "status", label: "Trạng thái", render: (doc) => doc.status && <span className={cx("badge", doc.status.badge)}>{doc.status.label}</span> },
        {
            key: "actions",
            label: "Thao tác",
            align: "right",
            actions: true,
            render: (doc) => {
                const busy = busyIds.includes(doc.id);
                return (
                    <div className="flex justify-end gap-2">
                        <IconLinkButton icon={Eye} label={`Xem tài liệu ${doc.name}`} onClick={() => onView(doc)} />
                        {doc.failed && onRetry && <IconLinkButton icon={RotateCw} label={`Tải lại tài liệu ${doc.name}`} disabled={busy} onClick={() => onRetry(doc)} />}
                        {onDelete && <IconLinkButton icon={Trash2} label={`Xoá tài liệu ${doc.name}`} disabled={busy} onClick={() => onDelete(doc)} />}
                    </div>
                );
            },
        },
    ];

    return <DataTable columns={columns} rows={documents} labelledBy={labelledBy} loading={loading} empty={empty} footer={footer} />;
};

export default PatientDocumentTable;

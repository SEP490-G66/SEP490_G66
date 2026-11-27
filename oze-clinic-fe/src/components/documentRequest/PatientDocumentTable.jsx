import { Eye, Trash2, Upload } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import IconLinkButton from "@/components/ui/IconLinkButton";
import { cx } from "@/utils/cx";
import { formatDate } from "@/utils/format";

// "Cung cấp tài liệu" list. documents: [{ id, name, typeLabel, provider, doctorName, files, performedOn, uploadedAt,
// status: { label, badge }, canUpload, canDelete }]. canUpload adds an upload button, canDelete a delete button.
const PatientDocumentTable = ({ documents = [], loading = false, busyIds = [], labelledBy, empty = "Bạn chưa có tài liệu nào.", footer, onView, onUpload, onDelete }) => {
    const columns = [
        {
            key: "name",
            label: "Tài liệu",
            primary: true,
            render: (doc) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-ink">{doc.name}</span>
                    <span className="text-caption text-muted">
                        {[doc.provider, `${doc.files.length} tệp`, doc.doctorName && `Theo yêu cầu của ${doc.doctorName}`].filter(Boolean).join(" · ")}
                    </span>
                </div>
            ),
        },
        { key: "type", label: "Loại", render: (doc) => doc.typeLabel },
        { key: "performedOn", label: "Ngày thực hiện", optional: true, render: (doc) => (doc.performedOn ? <span className="num">{formatDate(doc.performedOn)}</span> : <span className="text-muted">—</span>) },
        { key: "uploadedAt", label: "Ngày gửi", render: (doc) => (doc.uploadedAt ? <span className="num">{formatDate(doc.uploadedAt)}</span> : <span className="text-muted">Chưa gửi</span>) },
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
                        {doc.canUpload && onUpload && <IconLinkButton icon={Upload} label={`Gửi tài liệu ${doc.name}`} disabled={busy} onClick={() => onUpload(doc)} />}
                        {/* The delete slot keeps its place so every row lines up */}
                        {doc.canDelete && onDelete ? <IconLinkButton icon={Trash2} label={`Xoá tài liệu ${doc.name}`} disabled={busy} onClick={() => onDelete(doc)} /> : onDelete && <span aria-hidden="true" className="inline-block size-9 max-md:size-11" />}
                    </div>
                );
            },
        },
    ];

    return <DataTable columns={columns} rows={documents} labelledBy={labelledBy} loading={loading} empty={empty} footer={footer} />;
};

export default PatientDocumentTable;

import KeyValueList from "@/components/ui/KeyValueList";
import Modal from "@/components/ui/Modal";
import { cx } from "@/utils/cx";
import { formatDate, formatDateTime } from "@/utils/format";

// Detail popup of one document.
// document: { name, typeLabel, status: { label, badge }, provider, performedOn, doctorName, visitDate, note, uploadedAt,
//             seenAt, seenByDoctorName, canUpload, canDelete, files: [{ id, fileName, fileUrl }] }.
// Files open through onOpenFile; canUpload shows "Gửi tài liệu", canDelete "Xoá tài liệu".
const DocumentDetailModal = ({ document, onClose, onOpenFile, onUpload, onDelete }) => {
    const files = document.files ?? [];
    const items = [
        { label: "Trạng thái", value: document.status && <span className={cx("badge", document.status.badge)}>{document.status.label}</span> },
        { label: "Loại", value: document.typeLabel },
        { label: "Nơi thực hiện", value: document.provider },
        { label: "Ngày thực hiện", value: formatDate(document.performedOn) },
        { label: "Bác sĩ yêu cầu", value: document.doctorName },
        { label: "Yêu cầu từ lần khám", value: formatDate(document.visitDate) },
        { label: document.doctorName ? "Ghi chú của bác sĩ" : "Ghi chú cho bác sĩ", value: document.note },
        { label: "Ngày gửi", value: document.uploadedAt ? formatDateTime(document.uploadedAt) : null },
        { label: "Bác sĩ đã xem", value: document.seenAt ? `${document.seenByDoctorName ?? "Bác sĩ"} · ${formatDateTime(document.seenAt)}` : null },
        {
            label: "Tệp đính kèm",
            value: files.length ? (
                <ul className="flex flex-col gap-1">
                    {files.map((file) => (
                        <li key={file.id ?? file.fileName}>
                            <button type="button" className="text-left text-primary hover:underline" onClick={() => onOpenFile(file)}>
                                {file.fileName}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null,
        },
    ];

    return (
        <Modal title={document.name} onClose={onClose}>
            <KeyValueList items={items} className="mt-6" />
            {document.canUpload && <p className="alert alert-warning mt-4">Bác sĩ đang chờ tài liệu này. Vui lòng gửi bản chụp hoặc tệp .pdf.</p>}
            {document.seenAt && !document.doctorName && <p className="mt-4 text-caption text-muted">Bác sĩ đã xem tài liệu này nên không xoá được.</p>}
            <div className="modal-actions">
                {document.canDelete && onDelete && (
                    <button type="button" className="btn btn-secondary mr-auto text-danger" onClick={() => onDelete(document)}>
                        Xoá tài liệu
                    </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Đóng
                </button>
                {document.canUpload && onUpload && (
                    <button type="button" className="btn btn-primary" onClick={() => onUpload(document)}>
                        Gửi tài liệu
                    </button>
                )}
            </div>
        </Modal>
    );
};

export default DocumentDetailModal;

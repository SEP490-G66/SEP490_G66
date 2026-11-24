import KeyValueList from "@/components/ui/KeyValueList";
import Modal from "@/components/ui/Modal";
import { cx } from "@/utils/cx";
import { formatDate, formatDateTime } from "@/utils/format";

// Detail popup of one document (Figma 1242:4384).
// document: { name, status: { label, badge }, provider, performedOn, doctorName, visitDate, note, uploadedAt, canUpload,
//             files: [{ id, fileName, fileUrl }] }. Files open through onOpenFile; canUpload shows "Tải lên".
const DocumentDetailModal = ({ document, onClose, onOpenFile, onUpload }) => {
    const files = document.files ?? [];
    const items = [
        { label: "Trạng thái", value: document.status && <span className={cx("badge", document.status.badge)}>{document.status.label}</span> },
        { label: "Địa chỉ cung cấp", value: document.provider },
        { label: "Ngày thực hiện", value: formatDate(document.performedOn) },
        { label: "Bác sĩ yêu cầu", value: document.doctorName },
        { label: "Lần khám", value: formatDate(document.visitDate) },
        { label: "Ghi chú", value: document.note },
        { label: "Ngày upload", value: document.uploadedAt ? formatDateTime(document.uploadedAt) : null },
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
            {document.canUpload && <p className="alert alert-warning mt-4">Bác sĩ đang chờ tài liệu này. Vui lòng tải lên bản chụp hoặc file .pdf.</p>}
            <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Đóng
                </button>
                {document.canUpload && onUpload && (
                    <button type="button" className="btn btn-primary" onClick={() => onUpload(document)}>
                        Tải lên
                    </button>
                )}
            </div>
        </Modal>
    );
};

export default DocumentDetailModal;

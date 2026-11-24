import KeyValueList from "@/components/ui/KeyValueList";
import Modal from "@/components/ui/Modal";
import { cx } from "@/utils/cx";
import { formatDateTime } from "@/utils/format";

// Detail popup of one provided document (Figma 1242:4384). A failed upload shows the reason and "Tải lại".
// document: { name, provider, performedAt, uploadedAt, status: { label, badge }, failed, failureReason,
//             files: [{ name, sizeText }] }
const DocumentDetailModal = ({ document, onClose, onRetry }) => {
    const files = document.files ?? [];
    const items = [
        { label: "Trạng thái", value: document.status && <span className={cx("badge", document.status.badge)}>{document.status.label}</span> },
        { label: "Địa chỉ cung cấp", value: document.provider },
        { label: "Ngày thực hiện", value: document.performedAt },
        { label: "Ngày upload", value: formatDateTime(document.uploadedAt) },
        {
            label: "Tệp đính kèm",
            value: files.length ? (
                <ul>
                    {files.map((file) => (
                        <li key={file.name}>
                            {file.name}
                            {file.sizeText && <span className="text-caption text-muted"> · {file.sizeText}</span>}
                        </li>
                    ))}
                </ul>
            ) : null,
        },
    ];

    return (
        <Modal title={document.name} onClose={onClose}>
            <KeyValueList items={items} className="mt-6" />
            {document.failed && (
                <p role="alert" className="alert alert-danger mt-4">
                    {document.failureReason || "Tải lên không thành công. Vui lòng tải lại tài liệu."}
                </p>
            )}
            <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Đóng
                </button>
                {document.failed && onRetry && (
                    <button type="button" className="btn btn-primary" onClick={() => onRetry(document)}>
                        Tải lại
                    </button>
                )}
            </div>
        </Modal>
    );
};

export default DocumentDetailModal;

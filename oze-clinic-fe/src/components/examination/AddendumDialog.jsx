import { useId, useState } from "react";
import Modal from "@/components/ui/Modal";

// Same limit as the backend (ExaminationConstants.AddendumContentMaxLength)
const CONTENT_MAX = 2000;

// "Bổ sung thông tin lần khám": a note added to a locked visit (the visit itself cannot be edited any more).
// visit: { date, doctor }. onSubmit receives the trimmed text.
const AddendumDialog = ({ visit, busy = false, onSubmit, onClose }) => {
    const contentId = useId();
    const errorId = useId();
    const [content, setContent] = useState("");
    const [error, setError] = useState(null);

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!content.trim()) {
            setError("Nhập nội dung bổ sung.");
            return;
        }
        onSubmit(content.trim());
    };

    return (
        <Modal
            title={`Bổ sung thông tin lần khám ${visit.date}`}
            description={`${visit.doctor} · Lượt khám đã khoá, chỉ thêm được ghi chú`}
            onClose={onClose}
            closeDisabled={busy}
        >
            <form noValidate onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                <div className="field">
                    <label htmlFor={contentId} className="label">
                        Nội dung bổ sung <span className="text-danger-solid">*</span>
                    </label>
                    <textarea
                        id={contentId}
                        rows={4}
                        maxLength={CONTENT_MAX}
                        className="input h-auto min-h-24 py-2"
                        placeholder="Ví dụ: Bệnh nhân báo đã hết ê buốt sau 3 ngày."
                        value={content}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        onChange={(event) => {
                            setContent(event.target.value);
                            if (error) setError(null);
                        }}
                    />
                    {error && (
                        <p id={errorId} className="error-text">
                            {error}
                        </p>
                    )}
                </div>
                <div className="modal-actions -mx-6 mt-2 border-t border-border px-6 pt-4">
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
                        Huỷ
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy && <span className="btn-spinner" aria-hidden="true" />}
                        Lưu bổ sung
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AddendumDialog;

import { useId, useState } from "react";
import DocumentCategoryPicker from "@/components/documentRequest/DocumentCategoryPicker";
import Modal from "@/components/ui/Modal";
import { DOCUMENT_NAME_MAX, DOCUMENT_NOTE_MAX } from "@/utils/constants/documentRequest";

// "Yêu cầu bổ sung tài liệu": the doctor types the document the patient must bring (free text), picks its type and
// adds a note. The request belongs to this visit. subtitle: "Nguyễn Văn A · sinh 1998".
// onSubmit receives { documentName, category, note }.
const DocumentRequestDialog = ({ subtitle, busy = false, onSubmit, onClose }) => {
    const nameId = useId();
    const noteId = useId();
    const nameErrorId = useId();
    const categoryId = useId();
    const [form, setForm] = useState({ documentName: "", category: "", note: "" });
    const [errors, setErrors] = useState({});

    const handleSubmit = (event) => {
        event.preventDefault();
        const name = form.documentName.trim();
        const nameError = !name ? "Nhập tên tài liệu cần bổ sung." : name.length > DOCUMENT_NAME_MAX ? `Tên tài liệu tối đa ${DOCUMENT_NAME_MAX} ký tự.` : null;
        const categoryError = form.category ? null : "Chọn loại tài liệu.";
        setErrors({ documentName: nameError, category: categoryError });
        if (nameError || categoryError) return;
        onSubmit({ documentName: name, category: form.category, note: form.note.trim() });
    };

    return (
        <Modal title="Yêu cầu bổ sung tài liệu" description={subtitle} onClose={onClose} closeDisabled={busy}>
            <form noValidate onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                <div className="field">
                    <label htmlFor={nameId} className="label">
                        Tên tài liệu <span className="text-danger-solid">*</span>
                    </label>
                    <input
                        id={nameId}
                        className="input"
                        maxLength={DOCUMENT_NAME_MAX}
                        placeholder="Ví dụ: Kết quả xét nghiệm máu, phim chụp ở nơi khác"
                        value={form.documentName}
                        aria-invalid={errors.documentName ? true : undefined}
                        aria-describedby={errors.documentName ? nameErrorId : undefined}
                        onChange={(event) => {
                            setForm((current) => ({ ...current, documentName: event.target.value }));
                            if (errors.documentName) setErrors((current) => ({ ...current, documentName: null }));
                        }}
                    />
                    {errors.documentName && (
                        <p id={nameErrorId} className="error-text">
                            {errors.documentName}
                        </p>
                    )}
                </div>
                <DocumentCategoryPicker
                    id={categoryId}
                    value={form.category}
                    error={errors.category}
                    onChange={(category) => {
                        setForm((current) => ({ ...current, category }));
                        setErrors((current) => ({ ...current, category: null }));
                    }}
                />
                <div className="field">
                    <label htmlFor={noteId} className="label">
                        Ghi chú cho bệnh nhân
                    </label>
                    <textarea
                        id={noteId}
                        rows={3}
                        maxLength={DOCUMENT_NOTE_MAX}
                        className="input h-auto min-h-20 py-2"
                        placeholder="Ví dụ: xét nghiệm trong 3 tháng gần đây"
                        value={form.note}
                        onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    />
                </div>
                <div className="modal-actions -mx-6 mt-2 border-t border-border px-6 pt-4">
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
                        Huỷ
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy && <span className="btn-spinner" aria-hidden="true" />}
                        Gửi yêu cầu
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default DocumentRequestDialog;

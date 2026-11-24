import { useId, useRef, useState } from "react";
import { Upload } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { DialogActions } from "@/components/reception/shared";
import { useSubmit } from "@/components/reception/receptionUtils";
import { cx } from "@/utils/cx";
import { MANUAL_UPLOAD_EXTENSIONS, MANUAL_UPLOAD_MAX_MB } from "@/utils/imagingRequest";

const NOTE_MAX = 500;

const sizeText = (bytes) => `${(bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;

const problemOf = (file, extensions, maxMb) => {
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!extensions.includes(extension)) return "Sai định dạng";
    if (file.size > maxMb * 1024 * 1024) return `Quá ${maxMb} MB`;
    return null;
};

// "Tải ảnh thủ công": when the device failed or has no connection for the order type.
// subtitle: "IR-1041 · Võ Thị Ngọc · Phim quanh chóp". onSubmit({ files, note }) gets only valid files;
// an invalid file stays in the list, marked, and blocks the upload until it is removed.
// Reused for other uploads: title, the accepted extensions, the size and count limits (maxFiles: none by default),
// the word for one file in the hint ("ảnh") and whether there is a note can be changed.
// children: extra fields shown above the file box (e.g. the document name); validate(): checks them on submit,
// false keeps the dialog open without sending.
const ManualUploadDialog = ({
    subtitle,
    title = "Tải ảnh thủ công",
    extensions = MANUAL_UPLOAD_EXTENSIONS,
    maxMb = MANUAL_UPLOAD_MAX_MB,
    maxFiles = null,
    fileLabel = "ảnh",
    withNote = true,
    validate,
    children,
    onSubmit,
    onClose,
}) => {
    const inputRef = useRef(null);
    const noteId = useId();
    const [items, setItems] = useState([]);
    const [note, setNote] = useState("");
    const [dragging, setDragging] = useState(false);
    const [busy, submit] = useSubmit(onSubmit);

    const add = (fileList) => {
        const next = Array.from(fileList ?? []).map((file) => ({ key: `${file.name}-${file.size}-${file.lastModified}`, file, problem: problemOf(file, extensions, maxMb) }));
        setItems((current) => [...current, ...next.filter((item) => !current.some((existing) => existing.key === item.key))]);
    };
    const invalid = items.some((item) => item.problem);
    const tooMany = maxFiles != null && items.length > maxFiles;
    const canSubmit = items.length > 0 && !invalid && !tooMany;

    return (
        <Modal title={title} description={subtitle} onClose={onClose} closeDisabled={busy}>
            <form
                noValidate
                className="mt-5 flex flex-col gap-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (validate && !validate()) return;
                    if (canSubmit && !busy) submit({ files: items.map((item) => item.file), note: withNote ? note.trim() : "" });
                }}
            >
                {children}
                <button
                    type="button"
                    className={cx(
                        "flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center outline-none focus-visible:shadow-focus",
                        dragging ? "border-primary bg-primary-softer" : "border-border-strong bg-surface-tint",
                    )}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        add(event.dataTransfer.files);
                    }}
                >
                    <Upload className="size-5 text-muted" aria-hidden="true" />
                    <span className="font-semibold text-ink">Kéo thả file vào đây hoặc bấm để chọn</span>
                    <span className="text-caption text-muted">
                        {extensions.filter((ext) => ext !== ".jpeg").join(", ")} · tối đa {maxMb} MB/{fileLabel}
                        {maxFiles != null && ` · tối đa ${maxFiles} ${fileLabel}/lần`}
                    </span>
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={extensions.join(",")}
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(event) => {
                        add(event.target.files);
                        event.target.value = "";
                    }}
                />

                {items.length > 0 && (
                    <ul className="flex flex-col gap-2">
                        {items.map((item) => (
                            <li key={item.key} className={cx("flex items-center gap-3 rounded-md border px-3 py-2", item.problem ? "border-danger-solid bg-danger-soft" : "border-border")}>
                                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{item.file.name}</span>
                                <span className="num shrink-0 text-caption text-muted">{sizeText(item.file.size)}</span>
                                <span className={cx("badge shrink-0", item.problem ? "badge-danger" : "badge-success")}>{item.problem ?? "Hợp lệ"}</span>
                                <button
                                    type="button"
                                    className="shrink-0 cursor-pointer text-caption font-medium text-danger hover:underline"
                                    aria-label={`Xoá ${item.file.name}`}
                                    onClick={() => setItems((current) => current.filter((other) => other.key !== item.key))}
                                >
                                    Xoá
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {invalid && (
                    <p role="alert" className="error-text">
                        Xoá các file không hợp lệ trước khi tải lên.
                    </p>
                )}
                {tooMany && (
                    <p role="alert" className="error-text">
                        Mỗi lần tải tối đa {maxFiles} {fileLabel}. Xoá bớt rồi tải lên.
                    </p>
                )}

                {withNote && (
                    <div className="field">
                        <label htmlFor={noteId} className="label">
                            Ghi chú
                        </label>
                        <textarea
                            id={noteId}
                            rows={3}
                            maxLength={NOTE_MAX}
                            className="input h-auto min-h-20 py-2"
                            placeholder="Ví dụ: chụp trên máy Cephalometric phòng 2 do máy giả lập không hỗ trợ"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                        />
                    </div>
                )}

                <DialogActions onClose={onClose} closeLabel="Huỷ" submitLabel={`Tải lên${items.length ? ` (${items.length})` : ""}`} disabled={!canSubmit} busy={busy} closeDisabled={busy} />
            </form>
        </Modal>
    );
};

export default ManualUploadDialog;

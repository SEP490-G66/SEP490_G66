import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import Drawer from "@/components/ui/Drawer";
import KeyValueList from "@/components/ui/KeyValueList";
import api from "@/services/api";
import { cx } from "@/utils/cx";
import { formatDate, formatDateTime } from "@/utils/format";

const IMAGE = /\.(jpe?g|png)$/i;

// One attached file: a picture shows a small preview (loaded with the sign-in token), other files a plain tile.
const FileTile = ({ file, onOpen }) => {
    const isImage = IMAGE.test(file.fileName ?? "");
    const [preview, setPreview] = useState(null);

    useEffect(() => {
        if (!isImage || !file.fileUrl) return undefined;
        let url = null;
        let cancelled = false;
        api.get(file.fileUrl, { skipErrorPage: true, responseType: "blob" })
            .then((response) => {
                if (cancelled) return;
                url = URL.createObjectURL(response.data);
                setPreview(url);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [isImage, file.fileUrl]);

    const extension = (file.fileName ?? "").split(".").pop()?.toUpperCase() ?? "";
    return (
        <button type="button" className="group flex flex-col overflow-hidden rounded-md border border-border text-left hover:border-primary" onClick={() => onOpen(file)}>
            <span className={cx("grid h-28 place-items-center", isImage ? "bg-ink/80 text-on-primary" : "bg-surface-tint text-muted")}>
                {preview ? (
                    <img src={preview} alt="" className="h-full w-full object-cover" />
                ) : (
                    <span className="flex flex-col items-center gap-1 text-caption font-semibold">
                        <FileText className="size-6" aria-hidden="true" />
                        {isImage ? "Ảnh" : extension}
                    </span>
                )}
            </span>
            <span className="truncate px-3 py-2 text-caption text-ink group-hover:text-primary" title={file.fileName}>
                {file.fileName}
            </span>
        </button>
    );
};

const Section = ({ title, children }) => (
    <section className="flex flex-col gap-2">
        <h3 className="text-body-sm font-semibold text-muted">{title}</h3>
        {children}
    </section>
);

// Detail of one document, sliding in from the right so the list stays in view.
// document: { name, typeLabel, typeFull, status: { label, badge }, provider, performedOn, doctorName, visitDate, note,
//             requestedAt, uploadedAt, seenAt, seenByDoctorName, canUpload, canDelete, files: [{ id, fileName, fileUrl }] }.
const DocumentDetailDrawer = ({ document, onClose, onOpenFile, onUpload, onDelete }) => {
    const files = document.files ?? [];
    const requested = Boolean(document.doctorName);
    const info = [
        { label: "Loại", value: document.typeFull ?? document.typeLabel },
        { label: "Ngày thực hiện", value: document.performedOn ? formatDate(document.performedOn) : null },
        { label: "Nơi thực hiện", value: document.provider },
        { label: "Bác sĩ yêu cầu", value: document.doctorName },
        { label: "Yêu cầu từ lần khám", value: document.visitDate ? formatDate(document.visitDate) : null },
    ];

    const steps = requested
        ? [
              { done: true, label: `${document.doctorName} yêu cầu`, at: document.requestedAt },
              document.uploadedAt ? { done: true, label: "Bạn đã gửi", at: document.uploadedAt } : { done: false, label: "Chờ bạn gửi", hint: "Bác sĩ cần tài liệu này cho lần khám tới" },
          ]
        : [
              { done: true, label: "Bạn đã gửi", at: document.uploadedAt },
              document.seenAt
                  ? { done: true, label: `${document.seenByDoctorName ?? "Bác sĩ"} đã xem`, at: document.seenAt }
                  : { done: false, label: "Chờ bác sĩ xem", hint: "Bác sĩ sẽ xem khi bạn đến khám" },
          ];

    return (
        <Drawer title={document.name} badge={document.status && <span className={cx("badge", document.status.badge)}>{document.status.label}</span>} onClose={onClose}>
            <div className="flex flex-col gap-6">
                <Section title={`Tệp đính kèm (${files.length})`}>
                    {files.length ? (
                        <div className="grid grid-cols-2 gap-3">
                            {files.map((file) => (
                                <FileTile key={file.id ?? file.fileName} file={file} onOpen={onOpenFile} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-body-sm text-muted">Chưa có tệp nào.</p>
                    )}
                </Section>

                <Section title="Thông tin">
                    <KeyValueList items={info} />
                </Section>

                {document.note && (
                    <Section title={requested ? "Bác sĩ ghi chú" : "Ghi chú cho bác sĩ"}>
                        <p className="rounded-md bg-surface-tint px-4 py-3 text-body-sm text-ink">{document.note}</p>
                    </Section>
                )}

                {requested && document.patientNote && (
                    <Section title="Ghi chú cho bác sĩ">
                        <p className="rounded-md bg-surface-tint px-4 py-3 text-body-sm text-ink">{document.patientNote}</p>
                    </Section>
                )}

                <Section title="Theo dõi">
                    <ol className="flex flex-col">
                        {steps.map((step, index) => (
                            <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
                                {index < steps.length - 1 && <span aria-hidden className="absolute top-4 left-[5px] h-full w-px bg-border" />}
                                <span aria-hidden className={cx("mt-1.5 size-3 shrink-0 rounded-full", step.done ? "bg-primary" : "border-2 border-border-strong bg-canvas")} />
                                <div>
                                    <p className={cx("text-body-sm", step.done ? "text-ink" : "text-muted")}>{step.label}</p>
                                    <p className="num text-caption text-muted">{step.at ? formatDateTime(step.at) : step.hint}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </Section>

                {document.canUpload && <p className="alert alert-warning">Bác sĩ đang chờ tài liệu này. Vui lòng gửi bản chụp hoặc tệp .pdf.</p>}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    {document.canDelete && onDelete ? (
                        <button type="button" className="btn btn-link text-danger" onClick={() => onDelete(document)}>
                            Xoá tài liệu
                        </button>
                    ) : (
                        <span className="text-caption text-muted">{!requested && document.seenAt ? "Bác sĩ đã xem nên không xoá được." : ""}</span>
                    )}
                    <div className="flex gap-2">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Đóng
                        </button>
                        {document.canUpload && onUpload && (
                            <button type="button" className="btn btn-primary" onClick={() => onUpload(document)}>
                                Gửi tài liệu
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Drawer>
    );
};

export default DocumentDetailDrawer;

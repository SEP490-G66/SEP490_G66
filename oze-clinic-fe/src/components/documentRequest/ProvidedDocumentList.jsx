import { FileText } from "lucide-react";
import { providedCategoryOf } from "@/utils/constants/providedDocument";
import { formatDate, formatDateTime } from "@/utils/format";

// Read-only list of the documents the patient provided themselves (doctor, step 1 of the examination).
// documents: [{ id, documentName, category, note, providerAddress, performedOn, createdAt, files }]; onOpen(file) opens one file.
const ProvidedDocumentList = ({ documents, onOpen }) => (
    <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {documents.map((document) => (
            <li key={document.id} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">{document.documentName}</span>
                    <span className="num text-caption text-muted">Tải lên {formatDateTime(document.createdAt)}</span>
                </div>
                <p className="text-caption text-muted">
                    {[providedCategoryOf(document.category)?.label, document.providerAddress, document.performedOn && `Thực hiện ${formatDate(document.performedOn)}`]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
                {document.note && <p className="text-body-sm text-ink">Bệnh nhân ghi chú: {document.note}</p>}
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {document.files.map((file) => (
                        <li key={file.id}>
                            <button type="button" className="inline-flex items-center gap-1 text-body-sm text-primary hover:underline" onClick={() => onOpen(file)}>
                                <FileText className="size-4" aria-hidden="true" />
                                {file.fileName}
                            </button>
                        </li>
                    ))}
                </ul>
            </li>
        ))}
    </ul>
);

export default ProvidedDocumentList;

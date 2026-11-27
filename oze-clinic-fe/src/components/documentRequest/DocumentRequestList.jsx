import { FileText } from "lucide-react";
import { toast } from "react-toastify";
import { openDocumentFile } from "@/services/documentRequestService";
import { DOCUMENT_REQUEST_STATUS, DOCUMENT_REQUEST_STATUS_LABELS } from "@/utils/constants/documentRequest";
import { doctorTitle, providedCategoryOf } from "@/utils/constants/providedDocument";
import { formatDateTime, getClinicDateTimeParts } from "@/utils/format";

const open = async (file) => {
    const response = await openDocumentFile(file);
    if (!response.success) toast.error(response.message);
};

// Document requests of one visit: name, note, status, the uploaded files (each opens in a new tab).
// requests: the backend's DocumentRequestResponse list. Only one of the actions is given:
// onCancel(request) shows "Huỷ yêu cầu" on a request the backend marks canCancel (Pending, made by this doctor);
// onUpload(request) shows "Tải file lên" on a request that is not cancelled (patient). busyIds: requests whose action is running.
// showVisit: the visit date is added to each line (requests of earlier visits).
const DocumentRequestList = ({ requests, onCancel, onUpload, busyIds, showVisit = false }) => (
    <ul>
        {requests.map((request) => {
            const status = DOCUMENT_REQUEST_STATUS_LABELS[request.status] ?? { label: request.status, badge: "badge-neutral" };
            const canCancel = onCancel && request.canCancel && request.status === DOCUMENT_REQUEST_STATUS.PENDING;
            const canUpload = onUpload && request.status !== DOCUMENT_REQUEST_STATUS.CANCELLED;
            const busy = busyIds?.has(request.id) ?? false;
            return (
                <li key={request.id} className="flex flex-col gap-2 border-t border-border px-5 py-3">
                    <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold break-words text-ink">{request.documentName}</p>
                            <p className="num text-caption text-muted">
                                {[
                                    providedCategoryOf(request.category)?.label,
                                    showVisit && request.examinationDate && `Lượt khám ${getClinicDateTimeParts(request.examinationDate).date}`,
                                    formatDateTime(request.createdAt),
                                    request.doctorName && doctorTitle(request.doctorName),
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                            {request.note && <p className="mt-1 text-caption break-words text-ink">{request.note}</p>}
                            {request.patientNote && <p className="mt-1 text-caption break-words text-ink">Bệnh nhân ghi chú: {request.patientNote}</p>}
                        </div>
                        <span className={`badge shrink-0 ${status.badge}`}>{status.label}</span>
                        {canCancel && (
                            <button type="button" className="btn btn-secondary shrink-0" disabled={busy} onClick={() => onCancel(request)}>
                                {busy && <span className="btn-spinner" aria-hidden="true" />}
                                Huỷ yêu cầu
                            </button>
                        )}
                        {canUpload && (
                            <button type="button" className="btn btn-primary shrink-0" disabled={busy} onClick={() => onUpload(request)}>
                                Tải file lên
                            </button>
                        )}
                    </div>
                    {request.files?.length > 0 && (
                        <ul className="flex flex-wrap gap-2">
                            {request.files.map((file) => (
                                <li key={file.id} className="min-w-0 max-w-full">
                                    <button
                                        type="button"
                                        className="inline-flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-md bg-surface-tint px-3 py-1.5 text-caption font-medium text-primary hover:underline"
                                        title={`Mở ${file.fileName}`}
                                        onClick={() => open(file)}
                                    >
                                        <FileText className="size-4 shrink-0" aria-hidden="true" />
                                        <span className="truncate">{file.fileName}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </li>
            );
        })}
    </ul>
);

export default DocumentRequestList;

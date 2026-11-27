import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "react-toastify";
import DocumentDetailModal from "@/components/documentRequest/DocumentDetailModal";
import PatientDocumentTable from "@/components/documentRequest/PatientDocumentTable";
import ProvidedDocumentUploadModal from "@/components/documentRequest/ProvidedDocumentUploadModal";
import ManualUploadDialog from "@/components/imagingTechnician/ManualUploadDialog";
import FilterBar, { FILTER_SEARCH_CLASS, FILTER_SELECT_CLASS } from "@/components/ui/FilterBar";
import FilterSelect from "@/components/ui/FilterSelect";
import ListFooter from "@/components/ui/ListFooter";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import PageLoadState from "@/components/ui/PageLoadState";
import SearchInput from "@/components/ui/SearchInput";
import useAsync from "@/hooks/useAsync";
import usePagedList from "@/hooks/usePagedList";
import { getMyDocumentRequests, openDocumentFile, submitDocumentFiles } from "@/services/documentRequestService";
import { deleteProvidedDocument, getMyProvidedDocuments, uploadProvidedDocument } from "@/services/providedDocumentService";
import { DOCUMENT_REQUEST_STATUS, DOCUMENT_REQUEST_STATUS_LABELS, DOCUMENT_UPLOAD_EXTENSIONS, DOCUMENT_UPLOAD_MAX_FILES, DOCUMENT_UPLOAD_MAX_MB } from "@/utils/constants/documentRequest";
import { PROVIDED_DOCUMENT_CATEGORIES, PROVIDED_DOCUMENT_STATUS, providedCategoryOf } from "@/utils/constants/providedDocument";
import { formatDate } from "@/utils/format";
import { norm } from "@/utils/medicalRecord";

const TITLE_ID = "patient-documents-title";
// Type filter value of the documents a doctor asked for (they have no type of their own)
const REQUESTED = "requested";
const TYPE_OPTIONS = [...PROVIDED_DOCUMENT_CATEGORIES.map(({ value, label }) => ({ value, label })), { value: REQUESTED, label: "Bác sĩ yêu cầu" }];

const lastUpload = (files) => (files ?? []).map((file) => file.createdAt).filter(Boolean).sort().at(-1) ?? null;

// A document the patient uploaded themselves. It belongs to the record, not to a visit; deletable until a doctor opens it.
const fromProvided = (document) => {
    const category = providedCategoryOf(document.category);
    return {
        id: `provided-${document.id}`,
        providedId: document.id,
        name: document.documentName,
        type: document.category ?? "Other",
        typeLabel: category?.label ?? "Khác",
        provider: document.providerAddress || null,
        performedOn: document.performedOn,
        note: document.note,
        uploadedAt: document.createdAt,
        seenAt: document.seenAt,
        seenByDoctorName: document.seenByDoctorName,
        status: document.seenAt ? PROVIDED_DOCUMENT_STATUS.SEEN : PROVIDED_DOCUMENT_STATUS.WAITING,
        canDelete: document.canDelete,
        files: document.files ?? [],
        sortKey: document.createdAt ?? "",
    };
};

// A document a doctor asked for at a visit: the patient sends it while it is pending.
const fromRequest = (request) => ({
    id: `request-${request.id}`,
    requestId: request.id,
    name: request.documentName,
    type: REQUESTED,
    typeLabel: "Bác sĩ yêu cầu",
    doctorName: request.doctorName,
    visitDate: request.examinationDate,
    note: request.note,
    requestedAt: request.createdAt,
    uploadedAt: lastUpload(request.files),
    status: DOCUMENT_REQUEST_STATUS_LABELS[request.status] ?? null,
    canUpload: request.status === DOCUMENT_REQUEST_STATUS.PENDING,
    files: request.files ?? [],
    sortKey: lastUpload(request.files) ?? request.createdAt ?? "",
});

const resultOf = ({ loading, error, value }) => {
    if (loading) return "loading";
    return error || !value?.success ? "failed" : "ready";
};

// "Cung cấp tài liệu": documents the patient brings from elsewhere (films, test results, prescriptions...). They are
// kept in the patient's record and shared by every visit: any doctor reads them at any visit. On top, the documents a
// doctor asked for and is still waiting for.
const PatientDocuments = () => {
    const [version, setVersion] = useState(0);
    const providedState = useAsync(() => getMyProvidedDocuments(), [version]);
    const requestsState = useAsync(() => getMyDocumentRequests(), [version]);
    const [search, setSearch] = useState("");
    const [type, setType] = useState("");
    const [viewing, setViewing] = useState(null);
    const [creating, setCreating] = useState(false);
    const [uploading, setUploading] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [busyIds, setBusyIds] = useState([]);
    const reload = () => setVersion((current) => current + 1);

    const states = [resultOf(providedState), resultOf(requestsState)];
    let pageStatus = "ready";
    if (states.includes("loading")) pageStatus = "loading";
    else if (states.includes("failed")) pageStatus = "failed";

    const requests = pageStatus === "ready" ? (requestsState.value.data ?? []).map(fromRequest) : [];
    const waiting = requests.filter((doc) => doc.canUpload).sort((a, b) => (a.requestedAt ?? "").localeCompare(b.requestedAt ?? ""));
    const documents =
        pageStatus === "ready"
            ? [...(providedState.value.data ?? []).map(fromProvided), ...requests.filter((doc) => !doc.canUpload)].sort((a, b) => b.sortKey.localeCompare(a.sortKey))
            : [];
    const keyword = norm(search.trim());
    const rows = documents.filter((doc) => (!keyword || norm(`${doc.name} ${doc.provider ?? ""} ${doc.doctorName ?? ""}`).includes(keyword)) && (!type || doc.type === type));
    const list = usePagedList(rows, { resetKey: `${keyword}|${type}` });
    const filtered = Boolean(keyword || type);

    const clear = () => {
        setSearch("");
        setType("");
    };

    const create = async (values) => {
        const response = await uploadProvidedDocument(values);
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        setCreating(false);
        toast.success(response.message);
        reload();
    };

    const startUpload = (doc) => {
        setViewing(null);
        setUploading(doc);
    };

    const upload = async ({ files }) => {
        const response = await submitDocumentFiles(uploading.requestId, files);
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        setUploading(null);
        toast.success(response.message);
        reload();
    };

    const startDelete = (doc) => {
        setViewing(null);
        setDeleting(doc);
    };

    const confirmDelete = async () => {
        const doc = deleting;
        setBusyIds((current) => [...current, doc.id]);
        const response = await deleteProvidedDocument(doc.providedId);
        setBusyIds((current) => current.filter((id) => id !== doc.id));
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        setDeleting(null);
        toast.success(response.message);
        reload();
    };

    const openFile = async (file) => {
        const response = await openDocumentFile(file);
        if (!response.success) toast.error(response.message);
    };

    return (
        <>
            <PageHeader
                id={TITLE_ID}
                title="Cung cấp tài liệu"
                description="Gửi phim chụp, kết quả xét nghiệm từ nơi khác. Tài liệu lưu trong hồ sơ, bác sĩ xem được ở mọi lần khám."
                actions={
                    <button type="button" className="btn btn-primary min-h-11 md:min-h-0" onClick={() => setCreating(true)}>
                        <Upload className="size-4" aria-hidden="true" />
                        Tải lên tài liệu
                    </button>
                }
            />
            <PageLoadState status={pageStatus} onRetry={reload} />
            {pageStatus === "ready" && (
                <div className="flex flex-col gap-4">
                    {waiting.length > 0 && (
                        <section aria-labelledby="patient-documents-waiting" className="rounded-md border border-l-4 border-border border-l-primary bg-canvas px-4 pt-3">
                            <h2 id="patient-documents-waiting" className="text-body font-semibold text-ink">
                                Bác sĩ cần bạn gửi thêm {waiting.length} tài liệu
                            </h2>
                            <ul className="mt-2 flex flex-col divide-y divide-border">
                                {waiting.map((doc) => (
                                    <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-ink">{doc.name}</p>
                                            <p className="text-caption text-muted">
                                                {[`${doc.doctorName} yêu cầu ngày ${formatDate(doc.requestedAt)}`, doc.note].filter(Boolean).join(" · ")}
                                            </p>
                                        </div>
                                        <button type="button" className="btn btn-secondary min-h-11 md:min-h-0" onClick={() => startUpload(doc)}>
                                            <Upload className="size-4" aria-hidden="true" />
                                            Gửi tài liệu
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                    <FilterBar canClear={filtered} onClear={clear}>
                        <SearchInput id="patient-documents-search" label="Tìm tên tài liệu, nơi thực hiện" placeholder="Tìm tên tài liệu, nơi thực hiện" value={search} onChange={setSearch} className={FILTER_SEARCH_CLASS} />
                        <FilterSelect id="patient-documents-type" label="Loại tài liệu" allLabel="Tất cả loại" options={TYPE_OPTIONS} value={type} onChange={setType} className={FILTER_SELECT_CLASS} />
                    </FilterBar>
                    <PatientDocumentTable
                        documents={list.rows}
                        busyIds={busyIds}
                        labelledBy={TITLE_ID}
                        empty={documents.length ? "Không có tài liệu phù hợp." : "Bạn chưa gửi tài liệu nào. Nếu có phim chụp, kết quả xét nghiệm hay đơn thuốc từ nơi khác, bấm \"Tải lên tài liệu\" để gửi cho bác sĩ."}
                        footer={list.total > 0 && <ListFooter list={list} label="Phân trang tài liệu" />}
                        onView={setViewing}
                        onUpload={startUpload}
                        onDelete={startDelete}
                    />
                </div>
            )}
            {viewing && <DocumentDetailModal document={viewing} onClose={() => setViewing(null)} onOpenFile={openFile} onUpload={startUpload} onDelete={startDelete} />}
            {creating && <ProvidedDocumentUploadModal onSubmit={create} onClose={() => setCreating(false)} />}
            {uploading && (
                <ManualUploadDialog
                    title="Gửi tài liệu bác sĩ yêu cầu"
                    subtitle={`${uploading.name} · ${uploading.doctorName}`}
                    extensions={DOCUMENT_UPLOAD_EXTENSIONS}
                    maxMb={DOCUMENT_UPLOAD_MAX_MB}
                    maxFiles={DOCUMENT_UPLOAD_MAX_FILES}
                    fileLabel="file"
                    withNote={false}
                    submitLabel="Gửi cho bác sĩ"
                    onSubmit={upload}
                    onClose={() => setUploading(null)}
                />
            )}
            {deleting && (
                <Modal title="Xoá tài liệu" onClose={() => setDeleting(null)} closeDisabled={busyIds.includes(deleting.id)}>
                    <p className="mt-4">
                        Xoá tài liệu <strong className="text-ink">{deleting.name}</strong> và {deleting.files.length} tệp đính kèm? Bác sĩ sẽ không xem được tài liệu này nữa.
                    </p>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" disabled={busyIds.includes(deleting.id)} onClick={() => setDeleting(null)}>
                            Giữ lại
                        </button>
                        <button type="button" className="btn btn-danger" disabled={busyIds.includes(deleting.id)} onClick={confirmDelete}>
                            Xoá tài liệu
                        </button>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default PatientDocuments;

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
import SortSelect from "@/components/ui/SortSelect";
import useAsync from "@/hooks/useAsync";
import usePagedList from "@/hooks/usePagedList";
import { getMyDocumentRequests, openDocumentFile, submitDocumentFiles } from "@/services/documentRequestService";
import { deleteProvidedDocument, getMyProvidedDocuments, uploadProvidedDocument } from "@/services/providedDocumentService";
import { DOCUMENT_REQUEST_STATUS, DOCUMENT_REQUEST_STATUS_LABELS, DOCUMENT_UPLOAD_EXTENSIONS, DOCUMENT_UPLOAD_MAX_FILES, DOCUMENT_UPLOAD_MAX_MB } from "@/utils/constants/documentRequest";
import { PROVIDED_DOCUMENT_STATUS } from "@/utils/constants/providedDocument";
import { norm } from "@/utils/medicalRecord";

const TITLE_ID = "patient-documents-title";
const PROVIDED = "provided";
const SORT_OPTIONS = [
    { value: "new", label: "Ngày upload mới nhất" },
    { value: "old", label: "Ngày upload cũ nhất" },
];
const STATUS_OPTIONS = [
    { value: PROVIDED, label: PROVIDED_DOCUMENT_STATUS.label },
    ...Object.entries(DOCUMENT_REQUEST_STATUS_LABELS).map(([value, meta]) => ({ value, label: meta.label })),
];

const lastUpload = (files) => (files ?? []).map((file) => file.createdAt).filter(Boolean).sort().at(-1) ?? null;

// A document the patient uploaded themselves: can be deleted, never "waiting".
const fromProvided = (document) => ({
    id: `provided-${document.id}`,
    providedId: document.id,
    name: document.documentName,
    provider: document.providerAddress,
    performedOn: document.performedOn,
    uploadedAt: document.createdAt,
    statusKey: PROVIDED,
    status: PROVIDED_DOCUMENT_STATUS,
    canDelete: true,
    files: document.files ?? [],
    sortKey: document.createdAt ?? "",
});

// A document a doctor asked for: the patient uploads it while it is pending.
const fromRequest = (request) => ({
    id: `request-${request.id}`,
    requestId: request.id,
    name: request.documentName,
    doctorName: request.doctorName,
    visitDate: request.examinationDate,
    note: request.note,
    uploadedAt: lastUpload(request.files),
    statusKey: request.status,
    status: DOCUMENT_REQUEST_STATUS_LABELS[request.status] ?? null,
    canUpload: request.status === DOCUMENT_REQUEST_STATUS.PENDING,
    files: request.files ?? [],
    sortKey: lastUpload(request.files) ?? request.createdAt ?? "",
});

const resultOf = ({ loading, error, value }) => {
    if (loading) return "loading";
    return error || !value?.success ? "failed" : "ready";
};

// "Cung cấp tài liệu" (Figma 1242:4131): documents the patient brings from elsewhere for the doctors to read —
// uploaded freely ("Tải lên tài liệu") or asked for by a doctor at a visit.
const PatientDocuments = () => {
    const [version, setVersion] = useState(0);
    const providedState = useAsync(() => getMyProvidedDocuments(), [version]);
    const requestsState = useAsync(() => getMyDocumentRequests(), [version]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [sort, setSort] = useState("new");
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
    const documents = pageStatus === "ready" ? [...(providedState.value.data ?? []).map(fromProvided), ...(requestsState.value.data ?? []).map(fromRequest)] : [];
    const keyword = norm(search.trim());
    const rows = documents
        .filter((doc) => (!keyword || norm(`${doc.name} ${doc.provider ?? ""} ${doc.doctorName ?? ""}`).includes(keyword)) && (!status || doc.statusKey === status))
        .sort((a, b) => (sort === "new" ? b.sortKey.localeCompare(a.sortKey) : a.sortKey.localeCompare(b.sortKey)));
    const list = usePagedList(rows, { resetKey: `${keyword}|${status}|${sort}` });
    const filtered = Boolean(keyword || status || sort !== "new");

    const clear = () => {
        setSearch("");
        setStatus("");
        setSort("new");
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
                description="Tài liệu từ nơi khác để bác sĩ tham khảo khi khám."
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
                    <FilterBar canClear={filtered} onClear={clear}>
                        <SearchInput id="patient-documents-search" label="Tìm theo tên tài liệu, địa chỉ cung cấp" placeholder="Tìm theo tên tài liệu, địa chỉ cung cấp" value={search} onChange={setSearch} className={FILTER_SEARCH_CLASS} />
                        <FilterSelect id="patient-documents-status" label="Trạng thái" allLabel="Tất cả trạng thái" options={STATUS_OPTIONS} value={status} onChange={setStatus} className={FILTER_SELECT_CLASS} />
                        <SortSelect id="patient-documents-sort" options={SORT_OPTIONS} value={sort} onChange={setSort} />
                    </FilterBar>
                    <PatientDocumentTable
                        documents={list.rows}
                        offset={list.offset}
                        busyIds={busyIds}
                        labelledBy={TITLE_ID}
                        empty={documents.length ? "Không có tài liệu phù hợp." : "Bạn chưa có tài liệu nào. Bấm \"Tải lên tài liệu\" để gửi tài liệu cho bác sĩ."}
                        footer={list.total > 0 && <ListFooter list={list} label="Phân trang tài liệu" />}
                        onView={setViewing}
                        onUpload={startUpload}
                        onDelete={setDeleting}
                    />
                </div>
            )}
            {viewing && <DocumentDetailModal document={viewing} onClose={() => setViewing(null)} onOpenFile={openFile} onUpload={startUpload} />}
            {creating && <ProvidedDocumentUploadModal onSubmit={create} onClose={() => setCreating(false)} />}
            {uploading && (
                <ManualUploadDialog
                    title="Tải lên tài liệu"
                    subtitle={uploading.name}
                    extensions={DOCUMENT_UPLOAD_EXTENSIONS}
                    maxMb={DOCUMENT_UPLOAD_MAX_MB}
                    maxFiles={DOCUMENT_UPLOAD_MAX_FILES}
                    fileLabel="file"
                    withNote={false}
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

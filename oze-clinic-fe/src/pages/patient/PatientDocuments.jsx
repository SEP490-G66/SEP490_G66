import { useState } from "react";
import { Check, Eye, Upload } from "lucide-react";
import { toast } from "react-toastify";
import DocumentDetailDrawer from "@/components/documentRequest/DocumentDetailDrawer";
import PatientDocumentTable from "@/components/documentRequest/PatientDocumentTable";
import ProvidedDocumentUploadModal from "@/components/documentRequest/ProvidedDocumentUploadModal";
import FilterBar, { FILTER_SEARCH_CLASS } from "@/components/ui/FilterBar";
import ListFooter from "@/components/ui/ListFooter";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import PageLoadState from "@/components/ui/PageLoadState";
import SearchInput from "@/components/ui/SearchInput";
import StatusTabs from "@/components/ui/StatusTabs";
import useAsync from "@/hooks/useAsync";
import usePagedList from "@/hooks/usePagedList";
import { getMyDocumentRequests, openDocumentFile, submitDocumentFiles } from "@/services/documentRequestService";
import { deleteProvidedDocument, getMyProvidedDocuments, uploadProvidedDocument } from "@/services/providedDocumentService";
import { DOCUMENT_REQUEST_STATUS, DOCUMENT_REQUEST_STATUS_LABELS } from "@/utils/constants/documentRequest";
import { PROVIDED_DOCUMENT_CATEGORIES, PROVIDED_DOCUMENT_STATUS, doctorTitle, providedCategoryOf } from "@/utils/constants/providedDocument";
import { cx } from "@/utils/cx";
import { formatDate } from "@/utils/format";
import { norm } from "@/utils/medicalRecord";

const TITLE_ID = "patient-documents-title";
const MINE = "mine";
const REQUESTED = "requested";
const TYPE_OPTIONS = PROVIDED_DOCUMENT_CATEGORIES.map(({ value, label }) => ({ value, label }));

const lastUpload = (files) => (files ?? []).map((file) => file.createdAt).filter(Boolean).sort().at(-1) ?? null;

const typeOf = (value) => {
    const category = providedCategoryOf(value);
    return { type: category?.value ?? "Other", typeLabel: category?.label ?? "Khác", typeFull: category?.full ?? "Khác" };
};

// A document the patient uploaded themselves. It belongs to the record and is shared by every visit; it can be
// deleted until a doctor opens it.
const fromProvided = (document) => ({
    id: `provided-${document.id}`,
    providedId: document.id,
    name: document.documentName,
    ...typeOf(document.category),
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
});

// A document a doctor asked for at one visit: it is sent to that visit only.
const fromRequest = (request) => ({
    id: `request-${request.id}`,
    requestId: request.id,
    request,
    name: request.documentName,
    ...typeOf(request.category),
    doctorName: request.doctorName,
    examinationId: request.examinationId,
    visitDate: request.examinationDate,
    note: request.note,
    patientNote: request.patientNote,
    provider: request.providerAddress || null,
    performedOn: request.performedOn,
    requestedAt: request.createdAt,
    uploadedAt: lastUpload(request.files),
    statusKey: request.status,
    status: DOCUMENT_REQUEST_STATUS_LABELS[request.status] ?? null,
    canUpload: request.status === DOCUMENT_REQUEST_STATUS.PENDING,
    files: request.files ?? [],
});

// The requests of each visit, newest visit first: { examinationId, visitDate, doctorName, items, sent, open }
const byVisit = (requests) => {
    const visits = new Map();
    requests.forEach((doc) => {
        const visit = visits.get(doc.examinationId) ?? { examinationId: doc.examinationId, visitDate: doc.visitDate, doctorName: doc.doctorName, items: [] };
        visit.items.push(doc);
        visits.set(doc.examinationId, visit);
    });
    return [...visits.values()]
        .map((visit) => {
            const active = visit.items.filter((doc) => doc.statusKey !== DOCUMENT_REQUEST_STATUS.CANCELLED);
            return { ...visit, total: active.length, sent: active.filter((doc) => doc.statusKey === DOCUMENT_REQUEST_STATUS.SUBMITTED).length, open: visit.items.some((doc) => doc.canUpload) };
        })
        .sort((a, b) => (b.visitDate ?? "").localeCompare(a.visitDate ?? ""));
};

const resultOf = ({ loading, error, value }) => {
    if (loading) return "loading";
    return error || !value?.success ? "failed" : "ready";
};

const visitTitle = (visit) => `Lần khám ${visit.visitDate ? formatDate(visit.visitDate) : ""}`;

// "Cung cấp tài liệu": two kinds of documents.
// - "Tài liệu của tôi": brought by the patient on their own (films, test results...), kept in the record and shared by
//   every visit.
// - "Bác sĩ yêu cầu": asked for by a doctor at one visit, sent to that visit only; a visit may ask for several.
// On top, the visits whose doctor is still waiting for a document.
const PatientDocuments = () => {
    const [version, setVersion] = useState(0);
    const providedState = useAsync(() => getMyProvidedDocuments(), [version]);
    const requestsState = useAsync(() => getMyDocumentRequests(), [version]);
    const [tab, setTab] = useState(MINE);
    const [search, setSearch] = useState("");
    const [type, setType] = useState("");
    const [viewing, setViewing] = useState(null);
    const [creating, setCreating] = useState(false);
    const [answering, setAnswering] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [busyIds, setBusyIds] = useState([]);
    const reload = () => setVersion((current) => current + 1);

    const states = [resultOf(providedState), resultOf(requestsState)];
    let pageStatus = "ready";
    if (states.includes("loading")) pageStatus = "loading";
    else if (states.includes("failed")) pageStatus = "failed";

    const mine = pageStatus === "ready" ? (providedState.value.data ?? []).map(fromProvided).sort((a, b) => b.sortKey.localeCompare(a.sortKey)) : [];
    const requests = pageStatus === "ready" ? (requestsState.value.data ?? []).map(fromRequest) : [];
    const visits = byVisit(requests);
    const waitingVisits = visits.filter((visit) => visit.open);

    const keyword = norm(search.trim());
    const rows = mine.filter((doc) => (!keyword || norm(`${doc.name} ${doc.provider ?? ""}`).includes(keyword)) && (!type || doc.type === type));
    const list = usePagedList(rows, { resetKey: `${keyword}|${type}` });
    const counts = mine.reduce((total, doc) => ({ ...total, [doc.type]: (total[doc.type] ?? 0) + 1 }), { "": mine.length });

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

    const startAnswer = (doc) => {
        setViewing(null);
        setAnswering(doc);
    };

    const answer = async ({ files, note, performedOn, providerAddress }) => {
        const response = await submitDocumentFiles(answering.requestId, files, { note, performedOn, providerAddress });
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        setAnswering(null);
        toast.success(`Đã gửi "${answering.name}" cho ${doctorTitle(answering.doctorName)}.`);
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

    const tabButton = (value, label, count) => (
        <button
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={cx("-mb-px border-b-2 px-4 py-2.5 text-body-sm font-medium", tab === value ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink")}
            onClick={() => setTab(value)}
        >
            {label}
            <span className="num ml-2 rounded-full bg-surface-muted px-1.5 text-caption">{count}</span>
        </button>
    );

    return (
        <>
            <PageHeader
                id={TITLE_ID}
                title="Cung cấp tài liệu"
                description="Tài liệu bạn tự gửi lưu chung trong hồ sơ. Tài liệu bác sĩ yêu cầu gửi riêng cho lần khám đã yêu cầu."
                actions={
                    <button type="button" className="btn btn-primary min-h-11 md:min-h-0" onClick={() => setCreating(true)}>
                        <Upload className="size-4" aria-hidden="true" />
                        Tải lên tài liệu
                    </button>
                }
            />
            <PageLoadState status={pageStatus} onRetry={reload} />
            {pageStatus === "ready" && (
                <div className="flex flex-col gap-5">
                    {waitingVisits.length > 0 && (
                        <section aria-labelledby="patient-documents-waiting" className="flex flex-col gap-3">
                            <h2 id="patient-documents-waiting" className="text-body font-semibold text-ink">
                                Bác sĩ đang chờ bạn gửi
                            </h2>
                            {waitingVisits.map((visit) => (
                                <article key={visit.examinationId} className="rounded-md border border-l-4 border-border border-l-primary bg-canvas">
                                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                                        <div>
                                            <p className="font-semibold text-ink">{visitTitle(visit)}</p>
                                            <p className="text-caption text-muted">
                                                {doctorTitle(visit.doctorName)} yêu cầu {visit.total} tài liệu
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-caption text-muted">
                                            Đã gửi {visit.sent}/{visit.total}
                                            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                                                <span className="block h-full bg-primary" style={{ width: `${visit.total ? (visit.sent / visit.total) * 100 : 0}%` }} />
                                            </span>
                                        </div>
                                    </header>
                                    <ol className="divide-y divide-border">
                                        {visit.items
                                            .filter((doc) => doc.statusKey !== DOCUMENT_REQUEST_STATUS.CANCELLED)
                                            .map((doc, index) => (
                                                <li key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                                                    <span
                                                        className={cx(
                                                            "grid size-6 shrink-0 place-items-center rounded-full text-caption font-semibold",
                                                            doc.canUpload ? "bg-primary-softer text-primary" : "bg-success-soft text-success",
                                                        )}
                                                    >
                                                        {doc.canUpload ? index + 1 : <Check className="size-3.5" aria-label="Đã gửi" />}
                                                    </span>
                                                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setViewing(doc)}>
                                                        <span className="block font-semibold text-ink hover:text-primary">{doc.name}</span>
                                                        <span className="block text-caption text-muted">{[doc.typeLabel, doc.note].filter(Boolean).join(" · ")}</span>
                                                    </button>
                                                    {doc.canUpload ? (
                                                        <button type="button" className="btn btn-primary min-h-11 md:min-h-0" onClick={() => startAnswer(doc)}>
                                                            <Upload className="size-4" aria-hidden="true" />
                                                            Gửi tài liệu
                                                        </button>
                                                    ) : (
                                                        <span className="badge badge-success">Đã gửi {formatDate(doc.uploadedAt)}</span>
                                                    )}
                                                </li>
                                            ))}
                                    </ol>
                                </article>
                            ))}
                        </section>
                    )}

                    <div role="tablist" aria-label="Loại tài liệu" className="flex border-b border-border">
                        {tabButton(MINE, "Tài liệu của tôi", mine.length)}
                        {tabButton(REQUESTED, "Bác sĩ yêu cầu", requests.length)}
                    </div>

                    {tab === MINE ? (
                        <div className="flex flex-col gap-4">
                            <p className="-mt-2 text-caption text-muted">Bạn tự gửi · dùng chung, bác sĩ xem được ở mọi lần khám.</p>
                            <FilterBar canClear={Boolean(keyword || type)} onClear={() => { setSearch(""); setType(""); }}>
                                <SearchInput id="patient-documents-search" label="Tìm tên tài liệu, nơi thực hiện" placeholder="Tìm tên tài liệu, nơi thực hiện" value={search} onChange={setSearch} className={FILTER_SEARCH_CLASS} />
                                <StatusTabs label="Loại tài liệu" options={TYPE_OPTIONS} value={type} onChange={setType} counts={counts} />
                            </FilterBar>
                            <PatientDocumentTable
                                documents={list.rows}
                                busyIds={busyIds}
                                labelledBy={TITLE_ID}
                                empty={mine.length ? "Không có tài liệu phù hợp." : "Bạn chưa gửi tài liệu nào. Nếu có phim chụp, kết quả xét nghiệm hay đơn thuốc từ nơi khác, bấm \"Tải lên tài liệu\" để gửi cho bác sĩ."}
                                footer={list.total > 0 && <ListFooter list={list} label="Phân trang tài liệu" />}
                                onView={setViewing}
                                onDelete={startDelete}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <p className="-mt-2 text-caption text-muted">Bác sĩ yêu cầu · chỉ gửi cho lần khám đã yêu cầu, gom theo lần khám.</p>
                            {visits.length === 0 ? (
                                <p className="rounded-md border border-border bg-canvas px-4 py-8 text-center text-muted">Chưa có bác sĩ nào yêu cầu bổ sung tài liệu.</p>
                            ) : (
                                <div className="overflow-hidden rounded-md border border-border bg-canvas">
                                    {/* Fixed columns so every row lines up, whatever its status */}
                                    <table className="w-full table-fixed border-collapse text-left max-md:table-auto">
                                        <colgroup>
                                            <col />
                                            <col className="w-32" />
                                            <col className="w-28" />
                                            <col className="w-36" />
                                            <col className="w-40" />
                                        </colgroup>
                                        <thead className="bg-surface-tint text-caption text-muted max-md:hidden">
                                            <tr>
                                                <th className="px-4 py-2.5 font-medium">Tài liệu yêu cầu</th>
                                                <th className="px-4 py-2.5 font-medium">Loại</th>
                                                <th className="px-4 py-2.5 font-medium">Ngày gửi</th>
                                                <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                                                <th className="px-4 py-2.5 text-right font-medium">Thao tác</th>
                                            </tr>
                                        </thead>
                                        {visits.map((visit) => (
                                            <tbody key={visit.examinationId} className="border-t border-border">
                                                <tr className="bg-surface-tint/60">
                                                    <th colSpan={5} scope="rowgroup" className="px-4 py-2 text-body-sm font-semibold text-ink">
                                                        {visitTitle(visit)}
                                                        <span className="font-normal text-muted">
                                                            {" "}
                                                            · {doctorTitle(visit.doctorName)} · {visit.sent}/{visit.total} đã gửi
                                                        </span>
                                                    </th>
                                                </tr>
                                                {visit.items.map((doc) => (
                                                    <tr key={doc.id} className="border-t border-border align-middle max-md:flex max-md:flex-col max-md:gap-1 max-md:py-3">
                                                        <td className="px-4 py-3 max-md:py-0">
                                                            <button type="button" className="block max-w-full truncate text-left font-semibold text-ink hover:text-primary" onClick={() => setViewing(doc)}>
                                                                {doc.name}
                                                            </button>
                                                            <span className="block truncate text-caption text-muted">{[doc.note, doc.files.length ? `${doc.files.length} tệp` : null].filter(Boolean).join(" · ")}</span>
                                                        </td>
                                                        <td className="px-4 py-3 max-md:py-0">{doc.typeLabel}</td>
                                                        <td className="num px-4 py-3 max-md:py-0">{doc.uploadedAt ? formatDate(doc.uploadedAt) : <span className="text-muted">—</span>}</td>
                                                        <td className="px-4 py-3 max-md:py-0">{doc.status && <span className={cx("badge", doc.status.badge)}>{doc.status.label}</span>}</td>
                                                        <td className="px-4 py-3 text-right max-md:pt-2 max-md:pb-0 max-md:text-left">
                                                            {/* One button per row, same width: send while the doctor waits, otherwise open it */}
                                                            {doc.canUpload ? (
                                                                <button type="button" className="btn btn-primary w-32 justify-center" onClick={() => startAnswer(doc)}>
                                                                    <Upload className="size-4" aria-hidden="true" />
                                                                    Gửi tài liệu
                                                                </button>
                                                            ) : (
                                                                <button type="button" className="btn btn-secondary w-32 justify-center" onClick={() => setViewing(doc)}>
                                                                    <Eye className="size-4" aria-hidden="true" />
                                                                    Xem
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        ))}
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            {viewing && <DocumentDetailDrawer document={viewing} onClose={() => setViewing(null)} onOpenFile={openFile} onUpload={startAnswer} onDelete={startDelete} />}
            {creating && <ProvidedDocumentUploadModal onSubmit={create} onClose={() => setCreating(false)} />}
            {answering && <ProvidedDocumentUploadModal request={answering.request} onSubmit={answer} onClose={() => setAnswering(null)} />}
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

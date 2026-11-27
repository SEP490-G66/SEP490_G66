import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import useHistoryAutosave from "@/hooks/useHistoryAutosave";
import { cancelDocumentRequest, createDocumentRequest, getDocumentRequests, openDocumentFile } from "@/services/documentRequestService";
import { getExaminationProvidedDocuments } from "@/services/providedDocumentService";
import DocumentRequestDialog from "@/components/documentRequest/DocumentRequestDialog";
import DocumentRequestList from "@/components/documentRequest/DocumentRequestList";
import ProvidedDocumentList from "@/components/documentRequest/ProvidedDocumentList";
import ClinicalExamSection from "@/components/examination/ClinicalExamSection";
import MedicalHistoryCard from "@/components/examination/MedicalHistoryCard";
import PatientInfoCard from "@/components/examination/PatientInfoCard";
import PreviousVisitsCard from "@/components/examination/PreviousVisitsCard";
import StepActionBar from "@/components/examination/StepActionBar";

// Step 1 "Lập hồ sơ bệnh án": read-only identity, medical history the doctor completes (each new item is saved to the
// patient's record shortly after the change), previous visits. Items already in the record are locked: the record
// keeps them (record.historySaved, then what each save answers). onHistoryChange gets every edit; onNext
// receives the latest history ("Kết thúc lượt khám" is in the visit header). "Yêu cầu bổ sung tài liệu" asks the patient for a document (uploaded from the medical book);
// every request of the patient is listed under the previous visits, this visit's first, then earlier visits' (files sent
// after a visit ended are read here at the next one), then the documents the patient uploaded without a request.
// They never block moving on or ending the visit.
const PatientRecordTab = ({ queueId, record, busy = false, onHistoryChange, onNext }) => {
    const [saved, setSaved] = useState(record.historySaved);
    const { history, setHistory, statusText } = useHistoryAutosave(queueId, record.history, onHistoryChange, setSaved);
    // { examinationId (this visit), requests } once loaded; error: why the list could not be loaded
    const [loaded, setLoaded] = useState({ examinationId: null, requests: [], error: null });
    const [requestOpen, setRequestOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [cancellingIds, setCancellingIds] = useState(() => new Set());
    // Documents the patient uploaded themselves ("Cung cấp tài liệu"); null until loaded
    const [provided, setProvided] = useState({ documents: null, error: null });
    const setRequests = (change) => setLoaded((current) => ({ ...current, requests: change(current.requests) }));
    const markCancelling = (id, busyNow) =>
        setCancellingIds((current) => {
            const next = new Set(current);
            if (busyNow) next.add(id);
            else next.delete(id);
            return next;
        });

    useEffect(() => {
        let active = true;
        getDocumentRequests(queueId).then((response) => {
            if (!active) return;
            setLoaded(response.success ? { ...response.data, error: null } : { examinationId: null, requests: [], error: response.message || "Không tải được danh sách tài liệu yêu cầu." });
        });
        return () => {
            active = false;
        };
    }, [queueId]);

    useEffect(() => {
        let active = true;
        getExaminationProvidedDocuments(queueId).then((response) => {
            if (!active) return;
            setProvided(response.success ? { documents: response.data, error: null } : { documents: [], error: response.message || "Không tải được tài liệu bệnh nhân cung cấp." });
        });
        return () => {
            active = false;
        };
    }, [queueId]);

    const openProvidedFile = async (file) => {
        const response = await openDocumentFile(file);
        if (!response.success) toast.error(response.message);
    };

    const sendRequest = async (request) => {
        setSending(true);
        const response = await createDocumentRequest(queueId, request);
        setSending(false);
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        // Also after a failed first load: the error goes, the new request shows as this visit's
        setLoaded((current) => ({
            examinationId: current.examinationId ?? response.data.examinationId,
            requests: [response.data, ...current.requests],
            error: null,
        }));
        setRequestOpen(false);
        toast.success(response.message);
    };

    const cancelRequest = async (request) => {
        if (cancellingIds.has(request.id)) return;
        markCancelling(request.id, true);
        const response = await cancelDocumentRequest(request.id);
        markCancelling(request.id, false);
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        // The answer of a cancel is not a doctor list: it carries no canCancel and no visit date
        setRequests((current) => current.map((item) => (item.id === request.id ? { ...item, ...response.data, examinationDate: item.examinationDate, canCancel: false } : item)));
        toast.success(response.message);
    };

    const thisVisit = loaded.requests.filter((request) => request.examinationId === loaded.examinationId);
    const earlierVisits = loaded.requests.filter((request) => request.examinationId !== loaded.examinationId);

    return (
        <>
            <PatientInfoCard patient={record.patient} reason={record.intake.reason} />
            <MedicalHistoryCard history={history} saved={saved} gender={record.patient.gender} onChange={setHistory} />
            <PreviousVisitsCard queueId={queueId} visits={record.visits} />
            {loaded.error ? (
                <ClinicalExamSection title="Tài liệu yêu cầu bổ sung" divided={false}>
                    <p role="alert" className="error-text">
                        {loaded.error}
                    </p>
                </ClinicalExamSection>
            ) : (
                <>
                    {thisVisit.length > 0 && (
                        <ClinicalExamSection title="Tài liệu yêu cầu bổ sung · Lượt khám này" divided={false} flush>
                            <DocumentRequestList requests={thisVisit} onCancel={cancelRequest} busyIds={cancellingIds} />
                        </ClinicalExamSection>
                    )}
                    {earlierVisits.length > 0 && (
                        <ClinicalExamSection title="Tài liệu yêu cầu bổ sung · Các lượt trước" divided={false} flush>
                            <DocumentRequestList requests={earlierVisits} onCancel={cancelRequest} busyIds={cancellingIds} showVisit />
                        </ClinicalExamSection>
                    )}
                </>
            )}
            {provided.error && (
                <ClinicalExamSection title="Tài liệu bệnh nhân tự cung cấp" divided={false}>
                    <p role="alert" className="error-text">
                        {provided.error}
                    </p>
                </ClinicalExamSection>
            )}
            {provided.documents?.length > 0 && (
                <ClinicalExamSection title="Tài liệu bệnh nhân tự cung cấp" divided={false} flush>
                    <ProvidedDocumentList documents={provided.documents} onOpen={openProvidedFile} />
                </ClinicalExamSection>
            )}
            <StepActionBar status={statusText}>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setRequestOpen(true)}>
                    Yêu cầu bổ sung tài liệu
                </button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onNext?.(history)}>
                    Lưu & chuyển sang Khám & chẩn đoán
                </button>
            </StepActionBar>
            {requestOpen && (
                <DocumentRequestDialog subtitle={record.patient.name} busy={sending} onSubmit={sendRequest} onClose={() => setRequestOpen(false)} />
            )}
        </>
    );
};

export default PatientRecordTab;

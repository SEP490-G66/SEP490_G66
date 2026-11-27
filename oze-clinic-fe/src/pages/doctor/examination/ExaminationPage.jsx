import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import DocumentRequestDialog from "@/components/documentRequest/DocumentRequestDialog";
import CalledExamView from "@/components/examination/CalledExamView";
import EndVisitDialog from "@/components/examination/EndVisitDialog";
import ExamVisitHeader from "@/components/examination/ExamVisitHeader";
import NoExamView from "@/components/examination/NoExamView";
import ReferRoomDialog from "@/components/examination/ReferRoomDialog";
import XrayRequestDialog from "@/components/examination/XrayRequestDialog";
import useSession from "@/hooks/useSession";
import { createDocumentRequest } from "@/services/documentRequestService";
import {
    endExamination,
    finalizePrescription,
    getExamRecord,
    getExamWorkspace,
    referToMinorSurgery,
    requestXray,
    saveMedicalHistory,
    startExamination,
} from "@/services/examinationService";
import { GENERIC_ERROR_MESSAGE, QUEUE_STATUS } from "@/utils/messages";
import { DOCTOR_EXAM_STEP_PATHS, ROUTES, getDoctorExamStepRoute } from "@/utils/routes";
import ClinicalExamTab from "./tab/ClinicalExamTab";
import PatientRecordTab from "./tab/PatientRecordTab";
import PrescriptionTab from "./tab/PrescriptionTab";
import TreatmentPlanTab from "./tab/TreatmentPlanTab";
import TreatmentTab from "./tab/TreatmentTab";

const STEP = { HISTORY: 0, EXAM: 1, PLAN: 2, TREATMENT: 3, PRESCRIPTION: 4 };

// Page title of each step (Figma); the sidebar's "Khám & Điều trị" opens EXAM … PRESCRIPTION, the header's
// "Hồ sơ bệnh án" opens HISTORY.
const STEP_TITLES = {
    [STEP.HISTORY]: "Lập hồ sơ bệnh án",
    [STEP.EXAM]: "Khám & chẩn đoán",
    [STEP.PLAN]: "Lập kế hoạch điều trị",
    [STEP.TREATMENT]: "Điều trị",
    [STEP.PRESCRIPTION]: "Kê đơn thuốc",
};

// "2026-11-02" -> "02/11/2026"
const dmy = (date) => (date ? String(date).slice(0, 10).split("-").reverse().join("/") : null);

// The tabs of a visit (index = STEP). Each tab is a component in ./tab; render gets what the frame shares: the queue
// item, the record, busy, the record updaters (on*Change), goTo(step), draft (the header's "Lưu nháp" and autosave status).
const EXAM_TABS = {
    [STEP.HISTORY]: ({ item, record, busy, handlers, goTo }) => (
        <PatientRecordTab
            queueId={item.id}
            record={record}
            busy={busy}
            onHistoryChange={handlers.onHistoryChange}
            onNext={async (history) => {
                await saveMedicalHistory(item.id, history);
                handlers.onHistoryChange(history);
                goTo(STEP.EXAM);
            }}
        />
    ),
    [STEP.EXAM]: ({ item, record, busy, handlers, onReload, draft }) => (
        <ClinicalExamTab queueId={item.id} record={record} busy={busy} onExamChange={handlers.onExamChange} onXraySent={onReload} draft={draft} />
    ),
    [STEP.PLAN]: ({ item, record, busy, handlers, goTo, draft }) => (
        <TreatmentPlanTab
            queueId={item.id}
            record={record}
            busy={busy}
            onPlanChange={handlers.onPlanChange}
            onComplete={() => goTo(STEP.TREATMENT)}
            onToDiagnosis={() => goTo(STEP.EXAM)}
            draft={draft}
        />
    ),
    [STEP.TREATMENT]: ({ item, record, busy, handlers, goTo, draft }) => (
        <TreatmentTab
            queueId={item.id}
            record={record}
            busy={busy}
            onTreatmentChange={handlers.onTreatmentChange}
            onPlanChange={handlers.onPlanChange}
            onEditPlan={() => goTo(STEP.PLAN)}
            onComplete={() => goTo(STEP.PRESCRIPTION)}
            draft={draft}
        />
    ),
    [STEP.PRESCRIPTION]: ({ item, record, busy, handlers, draft }) => (
        <PrescriptionTab queueId={item.id} record={record} busy={busy} onPrescriptionChange={handlers.onPrescriptionChange} draft={draft} />
    ),
};

// Patient in the room: the one being examined, else the one called. Others are called in from "Hàng chờ".
const patientInRoom = (queue) => queue.find((item) => item.status === QUEUE_STATUS.IN_EXAMINATION) ?? queue.find((item) => item.status === QUEUE_STATUS.CALLED) ?? null;

// Exam in progress (Figma): the step title, the patient header with "Lưu nháp" / "Kết thúc lượt khám", then the step.
// The step comes from the URL (/doctor/examination/<step>, DOCTOR_EXAM_STEP_PATHS) so the sidebar opens it; none = Khám & chẩn đoán.
// Steps are open in any order; a step that needs an earlier one shows why (no diagnosis yet, no plan yet).
const InExamView = ({ shown, item, record, busy, handlers, onEnd, onReload }) => {
    const navigate = useNavigate();
    // The shown tab registers its "save now" here and reports its autosave status
    const saveRef = useRef(null);
    const [status, setStatus] = useState("");
    const [saving, setSaving] = useState(false);
    const draft = { saveRef, onStatus: setStatus };

    const goTo = (step) => {
        navigate(getDoctorExamStepRoute(step));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const saveDraft = async () => {
        if (!saveRef.current) return;
        setSaving(true);
        const response = await saveRef.current();
        setSaving(false);
        if (response?.success === false) toast.error(response.message || "Chưa lưu được nháp, thử lại sau.");
        else toast.success("Đã lưu nháp.");
    };

    // "Chỉ định chuyển phòng": null | "room" (pick the room) | "imaging" (the X-ray order)
    const [refer, setRefer] = useState(null);
    const [referring, setReferring] = useState(false);
    const { userName } = useSession();
    const birthYear = record.patient.birthdate?.slice(0, 4);

    // What is being typed in the step is saved first: the patient leaves the room
    const sendToImaging = async (request) => {
        setReferring(true);
        await saveRef.current?.();
        const response = await requestXray(item.id, request);
        setReferring(false);
        if (!response.success) {
            toast.error(response.message ?? GENERIC_ERROR_MESSAGE);
            return;
        }
        toast.success(response.message);
        setRefer(null);
        onReload();
    };

    // "Yêu cầu tài liệu": the patient uploads it from the medical book; the requests and files are listed in "Hồ sơ bệnh án"
    const [askingDocument, setAskingDocument] = useState(false);
    const [sendingDocument, setSendingDocument] = useState(false);
    const sendDocumentRequest = async (request) => {
        setSendingDocument(true);
        const response = await createDocumentRequest(item.id, request);
        setSendingDocument(false);
        if (!response.success) {
            toast.error(response.message ?? GENERIC_ERROR_MESSAGE);
            return;
        }
        toast.success(`${response.message} Theo dõi ở mục Hồ sơ bệnh án.`);
        setAskingDocument(false);
    };

    const sendToSurgery = async (request) => {
        setReferring(true);
        await saveRef.current?.();
        const response = await referToMinorSurgery(item.id, request);
        setReferring(false);
        if (!response.success) {
            toast.error(response.message ?? GENERIC_ERROR_MESSAGE);
            return;
        }
        toast.success(response.message);
        navigate(ROUTES.DOCTOR_QUEUE);
    };

    return (
        <>
            <ExamVisitHeader
                name={record.patient.name}
                services={record.services}
                status={status}
                actions={
                    <>
                        <button type="button" className="btn btn-secondary" disabled={busy || referring} onClick={() => setRefer("room")}>
                            Chỉ định chuyển phòng
                        </button>
                        {/* "Lập hồ sơ bệnh án" has its own button next to the list of requests */}
                        {shown !== STEP.HISTORY && (
                            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setAskingDocument(true)}>
                                Yêu cầu tài liệu
                            </button>
                        )}
                        {shown !== STEP.HISTORY && (
                            <Link to={getDoctorExamStepRoute(STEP.HISTORY)} className="btn btn-secondary">
                                Hồ sơ bệnh án
                            </Link>
                        )}
                        {shown !== STEP.HISTORY && (
                            <button type="button" className="btn btn-secondary" disabled={busy || saving} onClick={saveDraft}>
                                Lưu nháp
                            </button>
                        )}
                        <button type="button" className="btn btn-primary" disabled={busy} onClick={onEnd}>
                            Kết thúc lượt khám
                        </button>
                    </>
                }
            />
            {/* key: each step starts with its own draft and status */}
            <div key={shown} className="flex flex-col gap-5">
                {EXAM_TABS[shown]({ item, record, busy, handlers, goTo, onReload, draft })}
            </div>
            {refer === "room" && (
                <ReferRoomDialog
                    patientName={record.patient.name}
                    busy={referring}
                    onImaging={() => setRefer("imaging")}
                    onSurgery={sendToSurgery}
                    onClose={() => setRefer(null)}
                />
            )}
            {askingDocument && (
                <DocumentRequestDialog
                    subtitle={record.patient.name}
                    busy={sendingDocument}
                    onSubmit={sendDocumentRequest}
                    onClose={() => setAskingDocument(false)}
                />
            )}
            {refer === "imaging" && (
                <XrayRequestDialog
                    subtitle={[record.patient.name, birthYear && `sinh ${birthYear}`, userName && `BS. ${userName}`].filter(Boolean).join(" · ")}
                    busy={referring}
                    onSubmit={sendToImaging}
                    onClose={() => setRefer(null)}
                />
            )}
        </>
    );
};

const ExaminationPage = () => {
    const { "*": stepPath } = useParams();
    const requested = DOCTOR_EXAM_STEP_PATHS.indexOf(stepPath);
    const shown = requested >= 0 ? requested : STEP.EXAM;
    const [workspace, setWorkspace] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [record, setRecord] = useState(null); // { id, data, failed }
    const [busy, setBusy] = useState(false);
    const [ending, setEnding] = useState(false);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        let alive = true;
        getExamWorkspace().then((response) => {
            if (!alive) return;
            setLoadFailed(!response.success);
            if (response.success) setWorkspace(response.data);
        });
        return () => {
            alive = false;
        };
    }, [version]);

    const queue = workspace?.queue ?? [];
    const selected = patientInRoom(queue);
    const selectedId = selected?.id ?? null;

    useEffect(() => {
        if (selectedId == null) return undefined;
        let cancelled = false;
        getExamRecord(selectedId).then((response) => {
            if (!cancelled) setRecord({ id: selectedId, data: response.success ? response.data : null, failed: !response.success });
        });
        return () => {
            cancelled = true;
        };
    }, [selectedId]);

    const recordReady = record?.id === selectedId && record.data;

    // Runs a queue action and shows the new queue; true when it worked
    const runAction = async (action, id) => {
        setBusy(true);
        const response = await action(id);
        setBusy(false);
        if (!response.success) {
            toast.error(response.message ?? GENERIC_ERROR_MESSAGE);
            return false;
        }
        if (response.message) toast.success(response.message);
        if (response.data?.queue) setWorkspace(response.data);
        return true;
    };

    // Keeps the page's copy of the record in sync with the drafts edited in the steps.
    const updateRecord = (key) => (value) => setRecord((current) => (current?.data ? { ...current, data: { ...current.data, [key]: value } } : current));
    const recordHandlers = {
        onHistoryChange: updateRecord("history"),
        onExamChange: updateRecord("exam"),
        onPlanChange: updateRecord("plan"),
        onTreatmentChange: updateRecord("treatment"),
        onPrescriptionChange: updateRecord("prescription"),
    };

    // "Kết thúc lượt khám": the prescription is finalized first (the visit cannot end on a draft with medicines)
    const endVisit = async () => {
        setBusy(true);
        const finalized = await finalizePrescription(selected.id, record.data.prescription);
        setBusy(false);
        if (!finalized.success) {
            toast.error(finalized.message ?? GENERIC_ERROR_MESSAGE);
            return;
        }
        if (await runAction(endExamination, selected.id)) setEnding(false);
    };

    const renderMain = () => {
        if (loadFailed) return <p role="alert" className="alert alert-danger">{GENERIC_ERROR_MESSAGE}</p>;
        if (!workspace) return <div className="skeleton h-64 rounded-lg" aria-hidden="true" />;
        if (!selected) return <NoExamView waitingCount={queue.filter((item) => item.status === QUEUE_STATUS.WAITING).length} />;
        if (selected.status === QUEUE_STATUS.CALLED) return <CalledExamView item={selected} busy={busy} onStart={() => runAction(startExamination, selected.id)} />;
        if (record?.id === selectedId && record.failed) return <p role="alert" className="alert alert-danger">Không tải được hồ sơ của bệnh nhân này.</p>;
        if (!recordReady) return <div className="skeleton h-64 rounded-lg" aria-hidden="true" />;
        return (
            <InExamView
                key={selected.id}
                shown={shown}
                item={selected}
                record={record.data}
                busy={busy}
                handlers={recordHandlers}
                onEnd={() => setEnding(true)}
                onReload={() => setVersion((current) => current + 1)}
            />
        );
    };

    const data = recordReady ? record.data : null;

    return (
        <section className="flex min-w-0 flex-col gap-5" aria-label="Khám bệnh">
            <h1 className="page-title">{STEP_TITLES[shown]}</h1>
            {renderMain()}
            {ending && data && (
                <EndVisitDialog
                    patientName={data.patient.name}
                    queueNumber={selected.queueNumber}
                    summary={{
                        diagnoses: data.exam.diagnoses.length,
                        treatments: data.treatment.items.length,
                        medicines: data.prescription.items.length,
                        followUpDate: dmy((data.followUp ?? data.treatment.followUp)?.date),
                    }}
                    busy={busy}
                    onConfirm={endVisit}
                    onClose={() => setEnding(false)}
                />
            )}
        </section>
    );
};

export default ExaminationPage;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import useAutosave from "@/hooks/useAutosave";
import useExamDraft from "@/hooks/useExamDraft";
import useSession from "@/hooks/useSession";
import { requestXray, saveExamDraft } from "@/services/examinationService";
import { CHART_TYPE, CHILD_CHART_MAX_AGE, isPrimaryTooth } from "@/utils/examination";
import DiagnosisDialog from "@/components/examination/DiagnosisDialog";
import DiagnosisSection from "@/components/examination/DiagnosisSection";
import ExamDentalChart from "@/components/examination/ExamDentalChart";
import SymptomSection from "@/components/examination/SymptomSection";
import ToothConditionTable from "@/components/examination/ToothConditionTable";
import ToothEntryDialog from "@/components/examination/ToothEntryDialog";
import ToothPanel from "@/components/examination/ToothPanel";
import XrayRequestDialog from "@/components/examination/XrayRequestDialog";
import XraySection from "@/components/examination/XraySection";
import { ROUTES } from "@/utils/routes";

const newId = (prefix) => `${prefix}-${Date.now()}`;

// Step 2 "Khám & Chẩn đoán": reason and symptoms, dental chart findings, X-ray orders and final diagnoses.
// record.exam is the saved draft ({ chiefComplaint, symptoms, note, entries, films, diagnoses }); every change is saved
// automatically and passed to onExamChange so the page keeps it when the doctor moves between steps.
// onXraySent: the patient has left for the imaging room, the page reloads the queue.
// draft: the visit header's "Lưu nháp" and autosave status (useExamDraft). "Lập kế hoạch điều trị" needs a diagnosis.
const ClinicalExamTab = ({ queueId, record, onExamChange, onXraySent, draft }) => {
    const navigate = useNavigate();
    const { userName } = useSession();
    const { value: exam, setValue: setExam, statusText, saveNow } = useAutosave((value) => saveExamDraft(queueId, value), record.exam, onExamChange);
    const [chartType, setChartType] = useState(record.patient.age <= CHILD_CHART_MAX_AGE ? CHART_TYPE.CHILD : CHART_TYPE.ADULT);
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [editingEntry, setEditingEntry] = useState(null);
    const [diagnosisDialog, setDiagnosisDialog] = useState(null); // { diagnosis } while open
    const [xrayOpen, setXrayOpen] = useState(false);
    const [sendingXray, setSendingXray] = useState(false);

    const set = (key, value) => setExam({ ...exam, [key]: value });
    const recordedTeeth = [...new Set(exam.entries.map((entry) => Number(entry.tooth)))].sort((a, b) => a - b);

    const changeChartType = (type) => {
        setChartType(type);
        if (selectedTooth && isPrimaryTooth(selectedTooth) !== (type === CHART_TYPE.CHILD)) setSelectedTooth(null);
    };

    const addEntry = (entry) => {
        set("entries", [...exam.entries, { ...entry, id: newId("tooth") }]);
        toast.success(`Đã thêm ghi nhận răng ${entry.tooth}.`);
    };

    const saveEntry = (entry) => {
        set("entries", exam.entries.map((item) => (item.id === entry.id ? entry : item)));
        setEditingEntry(null);
        toast.success(`Đã cập nhật ghi nhận răng ${entry.tooth}.`);
    };

    const removeEntry = (entry) => {
        set("entries", exam.entries.filter((item) => item.id !== entry.id));
        toast.success(`Đã xoá "${entry.condition}" của răng ${entry.tooth}.`);
    };

    const selectToothFromTable = (tooth) => {
        changeChartType(isPrimaryTooth(tooth) ? CHART_TYPE.CHILD : CHART_TYPE.ADULT);
        setSelectedTooth(tooth);
    };

    const saveDiagnosis = (diagnosis) => {
        const exists = diagnosis.id != null;
        set("diagnoses", exists ? exam.diagnoses.map((item) => (item.id === diagnosis.id ? diagnosis : item)) : [...exam.diagnoses, { ...diagnosis, id: newId("diag") }]);
        setDiagnosisDialog(null);
        toast.success(exists ? `Đã cập nhật chẩn đoán ${diagnosis.code}.` : `Đã thêm chẩn đoán ${diagnosis.code}.`);
    };

    const sendXray = async (request) => {
        setSendingXray(true);
        const response = await requestXray(queueId, request);
        setSendingXray(false);
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        set("films", [...response.data, ...exam.films]);
        setXrayOpen(false);
        toast.success(response.message);
        await saveNow();
        onXraySent?.();
    };

    useExamDraft(draft, saveNow, statusText);

    const birthYear = record.patient.birthdate?.slice(0, 4);

    return (
        <>
            <SymptomSection
                value={exam.symptoms}
                note={exam.note}
                chiefComplaint={exam.chiefComplaint ?? ""}
                onChange={(symptoms) => set("symptoms", symptoms)}
                onNoteChange={(note) => set("note", note)}
                onChiefComplaintChange={(chiefComplaint) => set("chiefComplaint", chiefComplaint)}
            />
            <ExamDentalChart
                entries={exam.entries}
                chartType={chartType}
                onChartTypeChange={changeChartType}
                selectedTooth={selectedTooth}
                onSelectTooth={(tooth) => setSelectedTooth(tooth === selectedTooth ? null : tooth)}
            >
                {selectedTooth && (
                    <ToothPanel
                        key={selectedTooth}
                        tooth={selectedTooth}
                        entries={exam.entries.filter((entry) => Number(entry.tooth) === selectedTooth)}
                        onAdd={addEntry}
                        onEdit={setEditingEntry}
                        onRemove={removeEntry}
                        onClose={() => setSelectedTooth(null)}
                    />
                )}
            </ExamDentalChart>
            <ToothConditionTable entries={exam.entries} selectedTooth={selectedTooth} onSelectTooth={selectToothFromTable} onEdit={setEditingEntry} onRemove={removeEntry} />
            <XraySection
                films={exam.films}
                onRequest={() => setXrayOpen(true)}
                onView={() => navigate(ROUTES.DOCTOR_IMAGING_REVIEWS)}
            />
            <DiagnosisSection
                items={exam.diagnoses}
                onAdd={() => setDiagnosisDialog({ diagnosis: null })}
                onEdit={(diagnosis) => setDiagnosisDialog({ diagnosis })}
                onRemove={(diagnosis) => {
                    set("diagnoses", exam.diagnoses.filter((item) => item.id !== diagnosis.id));
                    toast.success(`Đã xoá chẩn đoán ${diagnosis.code}.`);
                }}
            />
            {editingEntry && <ToothEntryDialog entry={editingEntry} onSave={saveEntry} onClose={() => setEditingEntry(null)} />}
            {diagnosisDialog && (
                <DiagnosisDialog
                    diagnosis={diagnosisDialog.diagnosis}
                    recordedTeeth={recordedTeeth}
                    usedCodes={exam.diagnoses.map((item) => item.code)}
                    onSave={saveDiagnosis}
                    onClose={() => setDiagnosisDialog(null)}
                />
            )}
            {xrayOpen && (
                <XrayRequestDialog
                    subtitle={[record.patient.name, birthYear && `sinh ${birthYear}`, userName && `BS. ${userName}`].filter(Boolean).join(" · ")}
                    defaultArea={selectedTooth ? `Răng ${selectedTooth}` : ""}
                    busy={sendingXray}
                    onSubmit={sendXray}
                    onClose={() => setXrayOpen(false)}
                />
            )}
        </>
    );
};

export default ClinicalExamTab;

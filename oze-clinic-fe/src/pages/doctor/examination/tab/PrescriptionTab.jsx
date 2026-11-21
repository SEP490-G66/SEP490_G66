import { useState } from "react";
import { toast } from "react-toastify";
import useAutosave from "@/hooks/useAutosave";
import { finalizePrescription, reopenPrescription, savePrescriptionDraft } from "@/services/examinationService";
import { GENERIC_ERROR_MESSAGE } from "@/utils/messages";
import AllergyAlert from "@/components/examination/AllergyAlert";
import PrescriptionErrorAlert from "@/components/examination/PrescriptionErrorAlert";
import PrescriptionItemDeleteDialog from "@/components/examination/PrescriptionItemDeleteDialog";
import PrescriptionItemDialog from "@/components/examination/PrescriptionItemDialog";
import PrescriptionNoteCard from "@/components/examination/PrescriptionNoteCard";
import PrescriptionTable from "@/components/examination/PrescriptionTable";
import StepActionBar from "@/components/examination/StepActionBar";

// TODO(api): contraindication warnings come from the AI check ({ [itemId]: message }); none until it is connected.
const NO_WARNINGS = {};

// Step 5 "Kê đơn thuốc", the last step: the medicines of this visit and the prescription's note.
// record.prescription is the visit's prescription ({ items, notes, status: "Draft" | "Finalized" }); changes are saved to
// the backend automatically and passed to onPrescriptionChange. "Hoàn tất & kết thúc lượt khám" saves and finalizes it
// (the visit cannot end on a draft with medicines), then onEnd (the page confirms the end). A visit without medicine
// can be completed too. A finalized prescription is read only until "Mở lại đơn".
const PrescriptionTab = ({ queueId, record, busy = false, onPrescriptionChange, onEnd }) => {
    const { value: prescription, setValue: setPrescription, statusText, saveNow } = useAutosave(
        (value) => savePrescriptionDraft(queueId, value),
        record.prescription,
        onPrescriptionChange
    );
    const [dialog, setDialog] = useState(null); // { type: "add" | "edit" | "delete", item? }
    const [saveError, setSaveError] = useState("");
    const [working, setWorking] = useState(false);

    const setItems = (items) => setPrescription({ ...prescription, items });

    const saveItem = (item) => {
        if (dialog.type === "add") {
            setItems([...prescription.items, { ...item, id: `rx-${Date.now()}` }]);
            toast.success("Đã thêm thuốc vào đơn.");
        } else {
            setItems(prescription.items.map((entry) => (entry.id === item.id ? item : entry)));
            toast.success("Đã lưu thay đổi.");
        }
        setDialog(null);
    };

    const removeItem = () => {
        setItems(prescription.items.filter((entry) => entry.id !== dialog.item.id));
        toast.success("Đã xoá thuốc khỏi đơn.");
        setDialog(null);
    };

    const save = async () => {
        const response = await saveNow();
        setSaveError(response.success ? "" : (response.message ?? GENERIC_ERROR_MESSAGE));
        return response.success;
    };

    const finish = async () => {
        setWorking(true);
        const response = await finalizePrescription(queueId, prescription);
        setWorking(false);
        if (!response.success) {
            setSaveError(response.message ?? GENERIC_ERROR_MESSAGE);
            return;
        }
        setSaveError("");
        setPrescription(response.data);
        onEnd();
    };

    const reopen = async () => {
        setWorking(true);
        const response = await reopenPrescription(queueId);
        setWorking(false);
        if (!response.success) {
            toast.error(response.message ?? GENERIC_ERROR_MESSAGE);
            return;
        }
        setPrescription(response.data);
        toast.success(response.message);
    };

    const disabled = busy || working;
    const finalized = prescription.status === "Finalized";

    return (
        <>
            <PrescriptionErrorAlert message={saveError} />
            {finalized && (
                <div role="status" className="alert alert-info items-center">
                    <p className="min-w-0 flex-1">Đơn thuốc đã được chốt. Mở lại đơn nếu cần sửa thuốc hoặc lời dặn.</p>
                    <button type="button" className="btn btn-secondary shrink-0" disabled={disabled} onClick={reopen}>
                        Mở lại đơn
                    </button>
                </div>
            )}
            <AllergyAlert allergies={record.history.allergies} />
            {/* A finalized prescription is shown with every field and button turned off */}
            <fieldset disabled={finalized} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
                <PrescriptionTable
                    items={prescription.items}
                    warnings={NO_WARNINGS}
                    onAdd={() => setDialog({ type: "add" })}
                    onEdit={(item) => setDialog({ type: "edit", item })}
                    onRemove={(item) => setDialog({ type: "delete", item })}
                />
                <PrescriptionNoteCard value={prescription.notes} onChange={(notes) => setPrescription({ ...prescription, notes })} />
            </fieldset>
            <StepActionBar status={finalized ? "Đơn thuốc đã chốt" : statusText}>
                <button type="button" className="btn btn-secondary" disabled={disabled || finalized} onClick={save}>
                    Lưu nháp
                </button>
                <button type="button" className="btn btn-primary" disabled={disabled} onClick={finish}>
                    {working && <span className="btn-spinner" aria-hidden="true" />}
                    Hoàn tất & kết thúc lượt khám
                </button>
            </StepActionBar>

            {(dialog?.type === "add" || dialog?.type === "edit") && <PrescriptionItemDialog item={dialog.item ?? null} onSave={saveItem} onClose={() => setDialog(null)} />}
            {dialog?.type === "delete" && <PrescriptionItemDeleteDialog item={dialog.item} onConfirm={removeItem} onClose={() => setDialog(null)} />}
        </>
    );
};

export default PrescriptionTab;

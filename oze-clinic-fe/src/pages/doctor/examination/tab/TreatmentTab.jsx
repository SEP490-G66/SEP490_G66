import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import useAutosave from "@/hooks/useAutosave";
import useExamDraft from "@/hooks/useExamDraft";
import { completeTreatmentSession, saveTreatmentDraft } from "@/services/examinationService";
import { currentTreatmentSessionId, initialTreatmentItems, planSessionList, upcomingPlanSessions } from "@/utils/examination";
import { getClinicToday } from "@/utils/format";
import { GENERIC_ERROR_MESSAGE } from "@/utils/messages";
import FollowUpCard from "@/components/examination/FollowUpCard";
import SessionInvoiceCard from "@/components/examination/SessionInvoiceCard";
import StepBlockedCard from "@/components/examination/StepBlockedCard";
import TreatmentItemDeleteDialog from "@/components/examination/TreatmentItemDeleteDialog";
import TreatmentItemDialog from "@/components/examination/TreatmentItemDialog";
import TreatmentItemTable from "@/components/examination/TreatmentItemTable";
import TreatmentNoteCard from "@/components/examination/TreatmentNoteCard";
import TreatmentSessionCard from "@/components/examination/TreatmentSessionCard";

// Draft to start from: today's session picked, a new draft pre-filled with that session.
const initialDraftOf = ({ plan, treatment }) => {
    const sessionId = currentTreatmentSessionId(plan, treatment);
    const session = planSessionList(plan.services).find((item) => item.id === sessionId);
    const isNew = !treatment.sessionId && !treatment.items.length;
    return { ...treatment, sessionId, items: isNew ? initialTreatmentItems(session) : treatment.items };
};

// The plan the patient agreed to; only then can its sessions be carried out
const AGREED_STATUSES = ["Approved", "InProgress", "Completed"];

const BACK_TO_PLAN = "Quay lại Lập kế hoạch điều trị";

// Step 4 "Thực hiện điều trị": today's session of the plan, what was done and its price, a note and the session invoice.
// When today's session is the last one of the plan, the doctor can also propose a check-up date ("Hẹn tái khám").
// record.treatment is the saved draft; changes are saved automatically (the session's stage is started on the first
// change, then its actual cost and note updated) and passed to onTreatmentChange.
// "Chuyển sang Đơn thuốc" completes the session's stage (onPlanChange gets the new plan) then onComplete.
// draft: the visit header's "Lưu nháp" and autosave status (useExamDraft).
const TreatmentTab = ({ queueId, record, busy = false, onTreatmentChange, onPlanChange, onEditPlan, onComplete, draft: visitDraft }) => {
    const [initialDraft] = useState(() => initialDraftOf(record));
    const { value: draft, setValue: setDraft, statusText, saveNow } = useAutosave((value) => saveTreatmentDraft(queueId, value), initialDraft, onTreatmentChange);
    // Today's session pre-fills the draft: the page gets it at once, so "Kê đơn thuốc" and "Kết thúc lượt khám" count it
    useEffect(() => {
        onTreatmentChange?.(initialDraft);
        // once, with the draft the step opened with
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [dialog, setDialog] = useState(null); // { type: "add" | "edit" | "delete", item? }
    const [working, setWorking] = useState(false); // while "Chuyển sang Đơn thuốc" runs
    const [pickerKey, setPickerKey] = useState(0);

    const setItems = (items) => setDraft({ ...draft, items });

    const saveItem = (item) => {
        if (dialog.type === "add") {
            setItems([...draft.items, { ...item, id: `item-${Date.now()}`, createdAt: new Date().toISOString() }]);
            toast.success("Đã thêm nội dung điều trị.");
        } else {
            setItems(draft.items.map((entry) => (entry.id === item.id ? item : entry)));
            toast.success("Đã lưu thay đổi.");
        }
        setDialog(null);
    };

    const removeItem = () => {
        setItems(draft.items.filter((entry) => entry.id !== dialog.item.id));
        toast.success("Đã xoá nội dung điều trị.");
        setDialog(null);
    };

    const goToPrescription = async () => {
        if (!draft.items.length) {
            toast.error("Thêm ít nhất một nội dung điều trị.");
            return;
        }
        setWorking(true);
        const response = await completeTreatmentSession(queueId, draft);
        setWorking(false);
        if (!response.success) {
            toast.error(response.message ?? GENERIC_ERROR_MESSAGE);
            if (response.followUpFailed) {
                setDraft({ ...draft, followUp: null });
                setPickerKey((n) => n + 1);
            }
            return;
        }
        onPlanChange(response.data);
        onComplete();
    };

    useExamDraft(visitDraft, saveNow, statusText);

    if (!record.plan.planId) {
        return (
            <StepBlockedCard
                title="Chưa lập kế hoạch điều trị"
                text="Lập kế hoạch điều trị cho lượt khám này trước khi ghi nhận điều trị."
                action={
                    <button type="button" className="btn btn-primary" onClick={onEditPlan}>
                        Lập kế hoạch điều trị
                    </button>
                }
            />
        );
    }

    if (!AGREED_STATUSES.includes(record.plan.status)) {
        return (
            <StepBlockedCard
                title="Bệnh nhân chưa đồng ý kế hoạch điều trị"
                text="Xác nhận kế hoạch ở bước Lập kế hoạch điều trị trước khi thực hiện buổi điều trị."
                actionLabel={BACK_TO_PLAN}
                onAction={onEditPlan}
            />
        );
    }

    if (!draft.sessionId) {
        return (
            <StepBlockedCard
                title="Không còn buổi điều trị nào trong kế hoạch"
                text="Thêm buổi điều trị ở bước Lập kế hoạch điều trị để thực hiện."
                actionLabel={BACK_TO_PLAN}
                onAction={onEditPlan}
            />
        );
    }

    const disabled = busy || working;
    const isLastSession = upcomingPlanSessions(record.plan.services, draft.sessionId).length === 0;

    return (
        <>
            <TreatmentSessionCard plan={record.plan} currentSessionId={draft.sessionId} onEditPlan={onEditPlan} />
            <TreatmentItemTable
                items={draft.items}
                onAdd={() => setDialog({ type: "add" })}
                onEdit={(item) => setDialog({ type: "edit", item })}
                onRemove={(item) => setDialog({ type: "delete", item })}
            />
            <TreatmentNoteCard value={draft.note} onChange={(note) => setDraft({ ...draft, note })} />
            <SessionInvoiceCard items={draft.items} />
            {isLastSession && (
                <FollowUpCard
                    key={pickerKey}
                    value={draft.followUp}
                    booked={record.followUp}
                    doctor={record.doctor}
                    today={getClinicToday()}
                    onChange={(followUp) => setDraft({ ...draft, followUp })}
                />
            )}
            {/* Completes today's session of the plan (its cost goes to the invoice), then the prescription */}
            <div className="flex justify-end">
                <button type="button" className="btn btn-primary" disabled={disabled} onClick={goToPrescription}>
                    {working && <span className="btn-spinner" aria-hidden="true" />}
                    Hoàn thành buổi điều trị
                </button>
            </div>

            {(dialog?.type === "add" || dialog?.type === "edit") && (
                <TreatmentItemDialog
                    item={dialog.item ?? null}
                    patientName={record.patient.name}
                    subtitle={`${record.patient.name} · Lượt khám ${record.encounterCode}`}
                    onSave={saveItem}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog?.type === "delete" && <TreatmentItemDeleteDialog item={dialog.item} onConfirm={removeItem} onClose={() => setDialog(null)} />}
        </>
    );
};

export default TreatmentTab;

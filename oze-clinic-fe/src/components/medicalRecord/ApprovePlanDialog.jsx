import { useRef, useState } from "react";
import { toast } from "react-toastify";
import Modal from "@/components/ui/Modal";
import { approveMyTreatmentPlan } from "@/services/medicalBookService";
import { formatCurrency } from "@/utils/format";
import { MEDICAL_RECORD_TEXT as TEXT } from "@/utils/messages";

const ApprovePlanDialog = ({ plan, onClose, onApproved }) => {
    const confirmRef = useRef(null);
    const [sending, setSending] = useState(false);
    const [failed, setFailed] = useState(false);
    const stageCount = plan.stages.filter((stage) => !stage.cancelled).length;

    const confirm = async () => {
        setFailed(false);
        setSending(true);
        const result = await approveMyTreatmentPlan(plan.id);
        setSending(false);
        if (result.success) {
            toast.success(TEXT.APPROVE_DONE(plan.variant));
            onApproved();
            return;
        }
        setFailed(true);
    };

    return (
        <Modal title={TEXT.APPROVE_DIALOG_TITLE} onClose={() => onClose(failed)} closeDisabled={sending} initialFocusRef={confirmRef}>
            <div className="mt-4 flex flex-col gap-3">
                <p>{TEXT.APPROVE_DIALOG_TEXT(plan.variant, stageCount, formatCurrency(plan.total))}</p>
                <p className="text-caption text-muted">{TEXT.APPROVE_DIALOG_NOTE}</p>
                {failed && (
                    <div role="alert" className="alert alert-danger">
                        {TEXT.APPROVE_FAILED}
                    </div>
                )}
                <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" disabled={sending} onClick={() => onClose(failed)}>
                        {TEXT.APPROVE_LATER}
                    </button>
                    <button ref={confirmRef} type="button" className="btn btn-primary" disabled={sending} onClick={confirm}>
                        {sending && <span className="btn-spinner" aria-hidden="true" />}
                        {sending ? TEXT.APPROVE_SENDING : TEXT.APPROVE_CONFIRM}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ApprovePlanDialog;

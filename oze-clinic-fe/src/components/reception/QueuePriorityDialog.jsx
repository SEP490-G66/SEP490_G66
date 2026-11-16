import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { DialogActions, PriorityFields } from "./shared";
import { useSubmit } from "./receptionUtils";
import { PRIORITY } from "@/services/receptionService";
import { QUEUE_TEXT as TEXT } from "@/utils/messages";

// Changes the priority of one row in the queue; the page reorders the room afterwards.
// Ưu tiên / Khẩn need a reason (law on medical examination): staff see it, the patient is only told they were moved up.
const QueuePriorityDialog = ({ row, roomName, onClose, onSubmit }) => {
    const current = row.priority ?? PRIORITY.NORMAL;
    const [priority, setPriority] = useState(current);
    const [reason, setReason] = useState(row.priorityReason ?? "");
    const [busy, submit] = useSubmit(onSubmit);
    const needsReason = priority > PRIORITY.NORMAL && !reason.trim();
    const unchanged = priority === current && reason.trim() === (row.priorityReason ?? "");

    return (
        <Modal title={TEXT.PRIORITY_TITLE} description={[row.patientName, roomName].filter(Boolean).join(" · ")} onClose={onClose} closeDisabled={busy}>
            <form
                noValidate
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!busy && !needsReason && !unchanged) submit({ priority, reason: priority > PRIORITY.NORMAL ? reason.trim() : null });
                }}
            >
                <PriorityFields priority={priority} setPriority={setPriority} reason={reason} setReason={setReason} idPrefix="qp" />
                <p className="text-sm text-muted">{TEXT.PRIORITY_NOTE}</p>
                <DialogActions
                    onClose={onClose}
                    closeLabel={TEXT.CLOSE}
                    submitLabel={TEXT.PRIORITY_SUBMIT}
                    busy={busy}
                    closeDisabled={busy}
                    disabled={unchanged || needsReason}
                />
            </form>
        </Modal>
    );
};

export default QueuePriorityDialog;

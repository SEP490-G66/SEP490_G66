import { useState } from "react";
import Modal from "@/components/ui/Modal";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { DialogActions } from "./shared";
import { PRIORITY_LABEL, useSubmit } from "./receptionUtils";
import { QUEUE_TEXT as TEXT } from "@/utils/messages";

const OPTIONS = Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value: Number(value), label }));

// Changes the priority of one row in the queue; the page reorders the room afterwards.
const QueuePriorityDialog = ({ row, roomName, onClose, onSubmit }) => {
    const current = row.priority ?? 0;
    const [priority, setPriority] = useState(current);
    const [busy, submit] = useSubmit(onSubmit);

    return (
        <Modal title={TEXT.PRIORITY_TITLE} description={[row.patientName, roomName].filter(Boolean).join(" · ")} onClose={onClose} closeDisabled={busy}>
            <form
                noValidate
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!busy) submit(priority);
                }}
            >
                <div className="field">
                    <span className="label">{TEXT.PRIORITY_NEW}</span>
                    <SegmentedControl options={OPTIONS} value={priority} onChange={setPriority} label={TEXT.PRIORITY_NEW} className="self-start" />
                </div>
                <p className="text-sm text-muted">{TEXT.PRIORITY_NOTE}</p>
                <DialogActions onClose={onClose} closeLabel={TEXT.CLOSE} submitLabel={TEXT.PRIORITY_SUBMIT} busy={busy} closeDisabled={busy} disabled={priority === current} />
            </form>
        </Modal>
    );
};

export default QueuePriorityDialog;

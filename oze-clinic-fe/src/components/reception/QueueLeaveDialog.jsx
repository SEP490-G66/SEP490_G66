import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { DialogActions } from "./shared";
import { useSubmit } from "./receptionUtils";
import { QUEUE_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

// The patient goes home without being seen. Nothing is deleted: an exam appointment becomes "Bỏ về", another room's entry leaves the queue.
const QueueLeaveDialog = ({ row, roomName, onClose, onSubmit }) => {
    const [reason, setReason] = useState("");
    const [tried, setTried] = useState(false);
    const [busy, submit] = useSubmit(onSubmit);
    const [before, name, after] = TEXT.LEAVE_BODY(row.patientName, roomName, row.kind === "exam");
    const missing = !reason.trim();

    return (
        <Modal title={TEXT.LEAVE_TITLE} description={row.patientName} onClose={onClose} closeDisabled={busy}>
            <form
                noValidate
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    setTried(true);
                    if (!busy && !missing) submit(reason.trim());
                }}
            >
                <p className="text-sm">
                    {before}
                    <b className="text-ink">{name}</b>
                    {after}
                </p>
                <div className="field">
                    <label className="label label-required" htmlFor="queue-leave-reason">
                        {TEXT.LEAVE_REASON}
                    </label>
                    <textarea
                        id="queue-leave-reason"
                        className="input min-h-20"
                        maxLength={500}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        aria-required="true"
                        aria-invalid={tried && missing}
                        aria-describedby={tried && missing ? "queue-leave-error" : undefined}
                    />
                    {tried && missing && (
                        <p id="queue-leave-error" className={cx("text-caption text-danger")}>
                            {TEXT.ERR_REASON}
                        </p>
                    )}
                </div>
                <DialogActions onClose={onClose} closeLabel={TEXT.CLOSE} submitLabel={TEXT.MENU_LEAVE} busy={busy} closeDisabled={busy} danger />
            </form>
        </Modal>
    );
};

export default QueueLeaveDialog;

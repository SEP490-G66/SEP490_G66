import Modal from "@/components/ui/Modal";
import { DialogActions } from "./shared";
import { useSubmit } from "./receptionUtils";
import { QUEUE_TEXT as TEXT } from "@/utils/messages";

// Confirms taking a patient out of the queue (no-show for an exam, removal for the other rooms).
const QueueLeaveDialog = ({ row, roomName, onClose, onSubmit }) => {
    const [busy, submit] = useSubmit(onSubmit);
    const [before, name, after] = TEXT.LEAVE_BODY(row.patientName, roomName);

    return (
        <Modal title={TEXT.LEAVE_TITLE} description={row.patientName} onClose={onClose} closeDisabled={busy}>
            <form
                noValidate
                className="mt-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!busy) submit();
                }}
            >
                <p className="text-sm">
                    {before}
                    <b className="text-ink">{name}</b>
                    {after}
                </p>
                <DialogActions onClose={onClose} closeLabel={TEXT.CLOSE} submitLabel={TEXT.MENU_LEAVE} busy={busy} closeDisabled={busy} danger />
            </form>
        </Modal>
    );
};

export default QueueLeaveDialog;

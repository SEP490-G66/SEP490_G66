import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { DialogActions } from "./shared";
import { useSubmit } from "./receptionUtils";
import { QUEUE_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

// Moves one or more queue rows to another room or doctor of the same tab.
// targets: [{ key, name, staff?, waiting }], the rooms working now without the current one.
// The reason is required: it goes into the notification the patient receives. defaultReason pre-fills it (doctor's shift ended).
const QueueMoveDialog = ({ rows, targets, defaultReason = "", onClose, onSubmit }) => {
    const [selected, setSelected] = useState(targets.length === 1 ? targets[0].key : null);
    const [reason, setReason] = useState(defaultReason);
    const [tried, setTried] = useState(false);
    const [busy, submit] = useSubmit(onSubmit);
    const target = targets.find((t) => t.key === selected);
    const reasonMissing = !reason.trim();

    return (
        <Modal title={TEXT.MOVE_TITLE(rows.length)} description={rows.map((r) => r.patientName).join(", ")} onClose={onClose} closeDisabled={busy}>
            <form
                noValidate
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    setTried(true);
                    if (!busy && target && !reasonMissing) submit({ target, reason: reason.trim() });
                }}
            >
                <fieldset className="field">
                    <legend className="label">{TEXT.MOVE_TO}</legend>
                    {targets.length === 0 ? (
                        <p className="text-sm text-muted">{TEXT.MOVE_NONE}</p>
                    ) : (
                        <div className="grid gap-2">
                            {targets.map((t) => (
                                <label
                                    key={t.key}
                                    className={cx(
                                        "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2",
                                        selected === t.key ? "border-primary bg-primary-soft" : "border-border",
                                    )}
                                >
                                    <input type="radio" name="queue-move-target" checked={selected === t.key} onChange={() => setSelected(t.key)} />
                                    <span className="min-w-0 flex-1">
                                        <b className="block text-ink">{t.name}</b>
                                        {t.staff && <small className="block text-caption text-muted">{t.staff}</small>}
                                    </span>
                                    <small className="text-caption text-muted">{TEXT.MOVE_WAITING(t.waiting ?? 0)}</small>
                                </label>
                            ))}
                        </div>
                    )}
                </fieldset>
                <div className="field">
                    <label className="label label-required" htmlFor="queue-move-reason">
                        {TEXT.MOVE_REASON}
                    </label>
                    <textarea
                        id="queue-move-reason"
                        className="input min-h-20"
                        maxLength={500}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        aria-required="true"
                        aria-invalid={tried && reasonMissing}
                        aria-describedby="queue-move-reason-hint"
                    />
                    <p id="queue-move-reason-hint" className={cx("text-caption", tried && reasonMissing ? "text-danger" : "text-muted")}>
                        {tried && reasonMissing ? TEXT.ERR_REASON : TEXT.MOVE_REASON_HINT}
                    </p>
                </div>
                <p className="text-sm text-muted">{TEXT.MOVE_NOTE}</p>
                <DialogActions onClose={onClose} closeLabel={TEXT.CLOSE} submitLabel={TEXT.MOVE_SUBMIT} busy={busy} closeDisabled={busy} disabled={!target} />
            </form>
        </Modal>
    );
};

export default QueueMoveDialog;

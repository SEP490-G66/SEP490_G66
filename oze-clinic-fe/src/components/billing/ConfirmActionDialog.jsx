import { useId, useState } from "react";
import Modal from "@/components/ui/Modal";
import { DialogActions } from "@/components/reception/shared";
import { useSubmit } from "@/components/reception/receptionUtils";

// body: [text, bold, text, bold, …] — every odd piece is drawn bold.
// reasonLabel: when set, a required reason box is shown and its trimmed text is passed to onSubmit.
// The dialog cannot be closed while the request is on its way, so a cashier never thinks an action was stopped when it went through.
const ConfirmActionDialog = ({ title, description, body, submitLabel, closeLabel, danger, submitDisabled, reasonLabel, reasonPlaceholder, onClose, onSubmit }) => {
    const reasonId = useId();
    const [reason, setReason] = useState("");
    const [busy, submit] = useSubmit(onSubmit);
    return (
        <Modal title={title} description={description} onClose={onClose} closeDisabled={busy}>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    submit(reason.trim());
                }}
            >
                <p className="text-body-sm text-body">
                    {body.map((piece, index) =>
                        index % 2 ? (
                            <b key={index} className="text-ink">
                                {piece}
                            </b>
                        ) : (
                            piece
                        ),
                    )}
                </p>
                {reasonLabel && (
                    <div className="field mt-4">
                        <label className="label label-required" htmlFor={reasonId}>
                            {reasonLabel}
                        </label>
                        <textarea
                            id={reasonId}
                            className="input h-24 py-2"
                            value={reason}
                            placeholder={reasonPlaceholder}
                            onChange={(event) => setReason(event.target.value)}
                        />
                    </div>
                )}
                <DialogActions
                    onClose={onClose}
                    closeDisabled={busy}
                    closeLabel={closeLabel}
                    submitLabel={submitLabel}
                    danger={danger}
                    busy={busy}
                    disabled={Boolean(submitDisabled) || (Boolean(reasonLabel) && !reason.trim())}
                />
            </form>
        </Modal>
    );
};

export default ConfirmActionDialog;

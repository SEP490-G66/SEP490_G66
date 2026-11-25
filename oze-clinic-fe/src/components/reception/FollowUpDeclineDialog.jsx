import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { DialogActions } from "./shared";
import { dmy } from "./receptionUtils";
import { appointmentErrorText, cancelAppointment, recordFollowUpContact } from "@/services/receptionService";
import { FOLLOW_UP_TEXT as TEXT } from "@/utils/messages";
import { slotRange } from "@/utils/booking";
import { dueDateOf, hasLiveAppointment, slotOf } from "@/utils/followUp";

const WRITE = { skipErrorPage: true };
const DECLINED = "Declined";

const FollowUpDeclineDialog = ({ item, state, onClose, onSaved }) => {
    const live = hasLiveAppointment(state);
    const [reason, setReason] = useState("");
    const [error, setError] = useState(null);
    const [alert, setAlert] = useState(null);
    const [busy, setBusy] = useState(false);
    const [cancelled, setCancelled] = useState(false);

    const submit = async () => {
        const text = reason.trim();
        if (!text) {
            setError(TEXT.ERR_REASON);
            return;
        }
        setBusy(true);
        setAlert(null);
        if (live && !cancelled) {
            const cancel = await cancelAppointment(item.followUpAppointmentId, text);
            if (!cancel.success) {
                setBusy(false);
                setAlert(appointmentErrorText(cancel, TEXT.GENERIC_ERROR));
                return;
            }
            setCancelled(true);
        }
        const result = await recordFollowUpContact(item.examinationId, { outcome: DECLINED, note: text }, WRITE);
        setBusy(false);
        if (result.success) onSaved(TEXT.DECLINED(item.patientName));
        else setAlert(appointmentErrorText(result, TEXT.GENERIC_ERROR));
    };

    return (
        <Modal title={TEXT.DECLINE_TITLE} description={live ? TEXT.DECLINE_SUB_LIVE : TEXT.DECLINE_SUB_CLOSE} onClose={onClose} closeDisabled={busy}>
            <form
                noValidate
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!busy) submit();
                }}
            >
                <dl className="divide-y divide-border rounded-md border border-border">
                    {[
                        [TEXT.FIELD_PATIENT, `${item.patientName} · ${item.patientCode}`],
                        [TEXT.FIELD_FOLLOW_UP, [dmy(dueDateOf(item, state)), slotRange(slotOf(item, state))].filter(Boolean).join(" · ")],
                    ].map(([label, value]) => (
                        <div key={label} className="grid gap-1 px-3.5 py-2.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
                            <dt className="text-body-sm text-muted">{label}</dt>
                            <dd className="min-w-0 text-body-sm font-medium break-words text-ink">{value}</dd>
                        </div>
                    ))}
                </dl>
                <div className="field">
                    <label className="label label-required" htmlFor="fu-decline-reason">
                        {TEXT.REASON}
                    </label>
                    <textarea
                        id="fu-decline-reason"
                        rows={3}
                        className="input"
                        placeholder={TEXT.REASON_PLACEHOLDER}
                        value={reason}
                        aria-invalid={error ? "true" : undefined}
                        aria-describedby={error ? "fu-decline-error" : undefined}
                        onChange={(event) => {
                            setReason(event.target.value);
                            setError(null);
                        }}
                    />
                    {error && (
                        <p id="fu-decline-error" className="error-text">
                            {error}
                        </p>
                    )}
                </div>
                {alert && (
                    <p role="alert" className="alert alert-danger">
                        {alert}
                    </p>
                )}
                <DialogActions onClose={onClose} submitLabel={TEXT.DECLINE_SUBMIT} danger busy={busy} closeDisabled={busy} closeLabel={TEXT.BACK} />
            </form>
        </Modal>
    );
};

export default FollowUpDeclineDialog;

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { DialogActions } from "./shared";
import { dmy, phoneText } from "./receptionUtils";
import { appointmentErrorText, confirmAppointment } from "@/services/receptionService";
import { FOLLOW_UP_TEXT as TEXT } from "@/utils/messages";
import { slotRange } from "@/utils/booking";
import { doctorOf, dueDateOf, slotOf } from "@/utils/followUp";

const FollowUpConfirmDialog = ({ item, state, reminded, onClose, onSaved }) => {
    const [alert, setAlert] = useState(null);
    const [busy, setBusy] = useState(false);
    const rows = [
        [TEXT.FIELD_PATIENT, `${item.patientName} · ${item.patientCode}`],
        [TEXT.FIELD_PHONE, phoneText(item.patientPhoneNumber)],
        [TEXT.FIELD_DOCTOR, doctorOf(item, state)],
        [TEXT.FIELD_WHEN, [dmy(dueDateOf(item, state)), slotRange(slotOf(item, state))].filter(Boolean).join(" · ")],
        [TEXT.FIELD_REMINDED, reminded],
    ];

    const submit = async () => {
        setBusy(true);
        setAlert(null);
        const result = await confirmAppointment(item.followUpAppointmentId);
        setBusy(false);
        if (result.success) onSaved(TEXT.CONFIRMED(item.patientName));
        else setAlert(appointmentErrorText(result, TEXT.GENERIC_ERROR));
    };

    return (
        <Modal title={TEXT.CONFIRM_TITLE} description={TEXT.CONFIRM_SUB} onClose={onClose} closeDisabled={busy}>
            <form
                noValidate
                className="mt-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!busy) submit();
                }}
            >
                <dl className="divide-y divide-border rounded-md border border-border">
                    {rows.map(([label, value]) => (
                        <div key={label} className="grid gap-1 px-3.5 py-2.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
                            <dt className="text-body-sm text-muted">{label}</dt>
                            <dd className="min-w-0 text-body-sm font-medium break-words text-ink">{value}</dd>
                        </div>
                    ))}
                </dl>
                {alert && (
                    <p role="alert" className="alert alert-danger mt-4">
                        {alert}
                    </p>
                )}
                <DialogActions onClose={onClose} submitLabel={TEXT.CONFIRM_SUBMIT} busy={busy} closeDisabled={busy} closeLabel={TEXT.BACK} />
            </form>
        </Modal>
    );
};

export default FollowUpConfirmDialog;

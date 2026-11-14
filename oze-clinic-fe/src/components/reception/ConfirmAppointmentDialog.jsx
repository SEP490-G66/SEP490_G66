import Modal from "@/components/ui/Modal";
import { DialogActions } from "./shared";
import { phoneText, useSubmit } from "./receptionUtils";
import { longDate } from "@/utils/confirmAppointments";
import { slotOf } from "@/utils/checkIn";
import { CONFIRM_TEXT as TEXT } from "@/utils/messages";

const ConfirmAppointmentDialog = ({ appointment: a, onClose, onSubmit }) => {
    const [busy, submit] = useSubmit(onSubmit);
    const [before, middle, after] = TEXT.CONFIRM_BODY;
    return (
        <Modal title={TEXT.CONFIRM_TITLE} description={`${a.patientName} · ${phoneText(a.patientPhoneNumber)}`} onClose={onClose}>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <p className="text-body-sm text-body">
                    {before}
                    <b className="text-ink">
                        {longDate(a.appointmentDate)}, {slotOf(a)}
                    </b>
                    {middle}
                    {a.doctorName ?? TEXT.NO_DOCTOR}
                    {after}
                </p>
                <DialogActions onClose={onClose} closeLabel={TEXT.CLOSE} submitLabel={TEXT.CONFIRM} busy={busy} />
            </form>
        </Modal>
    );
};

export default ConfirmAppointmentDialog;

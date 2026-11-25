import { useState } from "react";
import Modal from "@/components/ui/Modal";
import CompactSlotPicker from "@/components/booking/CompactSlotPicker";
import { DialogActions } from "./shared";
import { phoneText } from "./receptionUtils";
import { appointmentErrorText, clinicToday, rescheduleAppointment, scheduleFollowUpAppointment } from "@/services/receptionService";
import { FOLLOW_UP_TEXT as TEXT } from "@/utils/messages";
import { addDays } from "@/utils/calendar";

const SLOT_TAKEN = "time slot is no longer available";

const FollowUpScheduleDialog = ({ item, mode, doctors, onClose, onSaved }) => {
    const move = mode === "move";
    const today = clinicToday();
    const [doctorId, setDoctorId] = useState("");
    const [slot, setSlot] = useState(null);
    const [pickerKey, setPickerKey] = useState(0);
    const [slotError, setSlotError] = useState(null);
    const [alert, setAlert] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!slot) {
            setSlotError(TEXT.ERR_SLOT);
            return;
        }
        setBusy(true);
        setAlert(null);
        const request = { date: slot.date, slotStart: slot.slotStart, doctorId: doctorId ? Number(doctorId) : move ? null : slot.doctorId };
        const result = move ? await rescheduleAppointment(item.followUpAppointmentId, request) : await scheduleFollowUpAppointment(item.examinationId, request);
        setBusy(false);
        if (result.success) {
            onSaved(move ? TEXT.MOVED(item.patientName) : TEXT.BOOKED(item.patientName));
            return;
        }
        if (String(result.message ?? "").toLowerCase().includes(SLOT_TAKEN)) {
            setSlot(null);
            setSlotError(appointmentErrorText(result));
            setPickerKey((n) => n + 1);
            return;
        }
        setAlert(appointmentErrorText(result, TEXT.GENERIC_ERROR));
    };

    return (
        <Modal title={move ? TEXT.MOVE_TITLE : TEXT.BOOK_TITLE} description={move ? TEXT.MOVE_SUB : TEXT.BOOK_SUB} size="md" onClose={onClose} closeDisabled={busy}>
            <form
                noValidate
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!busy) submit();
                }}
            >
                <div className="rounded-md border border-border bg-canvas px-3.5 py-2.5">
                    <p className="text-body-sm font-semibold text-ink">
                        {item.patientName} · <span className="num">{item.patientCode}</span> · <span className="num">{phoneText(item.patientPhoneNumber)}</span>
                    </p>
                </div>
                <div className="field">
                    <label className="label" htmlFor="fu-schedule-doctor">
                        {TEXT.DOCTOR}
                    </label>
                    <select
                        id="fu-schedule-doctor"
                        className="input"
                        value={doctorId}
                        onChange={(event) => {
                            setDoctorId(event.target.value);
                            setSlot(null);
                            setSlotError(null);
                        }}
                    >
                        <option value="">{TEXT.ANY_DOCTOR}</option>
                        {doctors.map((d) => (
                            <option key={d.id} value={String(d.id)}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                </div>
                <CompactSlotPicker
                    key={`${doctorId}|${pickerKey}`}
                    today={today}
                    minDate={addDays(today, 1)}
                    doctorId={doctorId || null}
                    initialDate={move ? null : item.followUpDate}
                    showEarliest
                    value={slot}
                    slotError={slotError}
                    onChange={(next) => {
                        setSlot(next);
                        if (next) setSlotError(null);
                    }}
                />
                {alert && (
                    <p role="alert" className="alert alert-danger">
                        {alert}
                    </p>
                )}
                <DialogActions onClose={onClose} submitLabel={move ? TEXT.MOVE_SUBMIT : TEXT.BOOK_SUBMIT} busy={busy} closeDisabled={busy} closeLabel={TEXT.BACK} />
            </form>
        </Modal>
    );
};

export default FollowUpScheduleDialog;

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { DialogActions } from "./shared";
import { phoneText } from "./receptionUtils";
import { clinicToday, recordFollowUpContact } from "@/services/receptionService";
import { FOLLOW_UP_TEXT as TEXT } from "@/utils/messages";
import { OUTCOME_OF_CHOICE, addDays } from "@/utils/followUp";

const CHOICES = Object.entries(TEXT.RESULT_OPTIONS).map(([value, label]) => ({ value, label }));
const WRITE = { skipErrorPage: true };

const FollowUpCallDialog = ({ item, onClose, onSaved }) => {
    const [choice, setChoice] = useState("noanswer");
    const [date, setDate] = useState(() => addDays(clinicToday(), 1));
    const [time, setTime] = useState("09:00");
    const [error, setError] = useState(null);
    const [alert, setAlert] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!date || !time) {
            setError(TEXT.ERR_CALL_BACK);
            return;
        }
        setBusy(true);
        setAlert(null);
        const result = await recordFollowUpContact(item.examinationId, { outcome: OUTCOME_OF_CHOICE[choice], callBackDate: date, callBackTime: time }, WRITE);
        setBusy(false);
        if (result.success) onSaved(TEXT.CALL_SAVED(item.patientName));
        else setAlert(TEXT.GENERIC_ERROR);
    };

    return (
        <Modal title={TEXT.CALL_TITLE} description={`${item.patientName} · ${phoneText(item.patientPhoneNumber)}`} onClose={onClose} closeDisabled={busy}>
            <form
                noValidate
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!busy) submit();
                }}
            >
                <div className="field">
                    <span className="label">{TEXT.RESULT}</span>
                    <SegmentedControl options={CHOICES} value={choice} onChange={setChoice} label={TEXT.RESULT} className="self-start" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="field">
                        <label className="label" htmlFor="fu-cb-date">
                            {TEXT.CALL_BACK_DATE}
                        </label>
                        <input
                            id="fu-cb-date"
                            type="date"
                            className="input"
                            min={clinicToday()}
                            value={date}
                            aria-invalid={error && !date ? "true" : undefined}
                            onChange={(event) => {
                                setDate(event.target.value);
                                setError(null);
                            }}
                        />
                    </div>
                    <div className="field">
                        <label className="label" htmlFor="fu-cb-time">
                            {TEXT.CALL_BACK_TIME}
                        </label>
                        <input
                            id="fu-cb-time"
                            type="time"
                            className="input"
                            value={time}
                            aria-invalid={error && !time ? "true" : undefined}
                            onChange={(event) => {
                                setTime(event.target.value);
                                setError(null);
                            }}
                        />
                    </div>
                </div>
                {error && <p className="error-text">{error}</p>}
                {alert && (
                    <p role="alert" className="alert alert-danger">
                        {alert}
                    </p>
                )}
                <DialogActions onClose={onClose} submitLabel={TEXT.SAVE} busy={busy} closeDisabled={busy} closeLabel={TEXT.CANCEL} />
            </form>
        </Modal>
    );
};

export default FollowUpCallDialog;

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { DialogActions } from "./shared";
import { phoneText, useSubmit } from "./receptionUtils";
import { CONFIRM_TEXT as TEXT } from "@/utils/messages";

const OPTIONS = TEXT.CALL_OPTIONS.map(([value, label]) => ({ value, label }));

const ConfirmCallDialog = ({ appointment: a, today, onClose, onSubmit }) => {
    const [outcome, setOutcome] = useState(OPTIONS[0].value);
    const [date, setDate] = useState(today);
    const [time, setTime] = useState("15:00");
    const [busy, submit] = useSubmit(onSubmit);
    const dateOk = date >= today && date <= a.appointmentDate;
    return (
        <Modal title={TEXT.CALL_TITLE} description={`${a.patientName} · ${phoneText(a.patientPhoneNumber)}`} onClose={onClose}>
            <form
                className="space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (dateOk && time) submit({ outcome, callBackDate: date, callBackTime: time });
                }}
            >
                <div className="field">
                    <span className="label">{TEXT.CALL_RESULT}</span>
                    <SegmentedControl label={TEXT.CALL_RESULT} options={OPTIONS} value={outcome} onChange={setOutcome} className="w-full" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="field">
                        <label className="label" htmlFor="cb-date">
                            {TEXT.CALL_DATE}
                        </label>
                        <input
                            id="cb-date"
                            type="date"
                            className="input"
                            min={today}
                            max={a.appointmentDate}
                            value={date}
                            aria-invalid={!dateOk || undefined}
                            aria-describedby={dateOk ? undefined : "cb-date-error"}
                            onChange={(e) => setDate(e.target.value)}
                        />
                        {!dateOk && (
                            <p id="cb-date-error" className="error-text">
                                {TEXT.CALL_DATE_RANGE}
                            </p>
                        )}
                    </div>
                    <div className="field">
                        <label className="label" htmlFor="cb-time">
                            {TEXT.CALL_TIME}
                        </label>
                        <input id="cb-time" type="time" className="input" value={time} required onChange={(e) => setTime(e.target.value)} />
                    </div>
                </div>
                <DialogActions onClose={onClose} closeLabel={TEXT.CLOSE} submitLabel={TEXT.SAVE} busy={busy} disabled={!dateOk || !time} />
            </form>
        </Modal>
    );
};

export default ConfirmCallDialog;

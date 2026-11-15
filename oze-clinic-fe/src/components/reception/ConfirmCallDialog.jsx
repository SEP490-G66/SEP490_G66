import { useState } from "react";
import Modal from "@/components/ui/Modal";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { DialogActions } from "./shared";
import { phoneText, useSubmit } from "./receptionUtils";
import { CONFIRM_TEXT as TEXT } from "@/utils/messages";
<<<<<<< HEAD
import { addDays } from "@/utils/calendar";

const CHOICES = TEXT.CALL_OPTIONS.map(([value, label]) => ({ value, label }));

// Records a confirmation call that did not end in a confirmation: the patient asked to be called back, or did not
// answer. Either way the receptionist picks when to call again, from today up to the appointment day.
const ConfirmCallDialog = ({ appointment, today, onClose, onSubmit }) => {
    const lastDay = appointment.appointmentDate && appointment.appointmentDate >= today ? appointment.appointmentDate : today;
    const [outcome, setOutcome] = useState(CHOICES[0].value);
    const [date, setDate] = useState(() => (addDays(today, 1) <= lastDay ? addDays(today, 1) : today));
    const [time, setTime] = useState("09:00");
    const [error, setError] = useState(null);
    const [busy, submit] = useSubmit(onSubmit);

    const send = () => {
        if (!date || !time || date < today || date > lastDay) {
            setError(TEXT.CALL_DATE_RANGE);
            return;
        }
        submit({ outcome, callBackDate: date, callBackTime: time });
    };

    return (
        <Modal
            title={TEXT.CALL_BACK}
            description={[appointment.patientName, phoneText(appointment.patientPhoneNumber)].filter(Boolean).join(" · ")}
            onClose={onClose}
            closeDisabled={busy}
        >
            <form
                noValidate
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!busy) send();
=======

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
>>>>>>> main
                }}
            >
                <div className="field">
                    <span className="label">{TEXT.CALL_RESULT}</span>
<<<<<<< HEAD
                    <SegmentedControl options={CHOICES} value={outcome} onChange={setOutcome} label={TEXT.CALL_RESULT} className="self-start" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="field">
                        <label className="label" htmlFor="cf-cb-date">
                            {TEXT.CALL_DATE}
                        </label>
                        <input
                            id="cf-cb-date"
                            type="date"
                            className="input"
                            min={today}
                            max={lastDay}
                            value={date}
                            aria-invalid={error ? "true" : undefined}
                            onChange={(event) => {
                                setDate(event.target.value);
                                setError(null);
                            }}
                        />
                    </div>
                    <div className="field">
                        <label className="label" htmlFor="cf-cb-time">
                            {TEXT.CALL_TIME}
                        </label>
                        <input
                            id="cf-cb-time"
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
                {error && (
                    <p role="alert" className="text-sm text-danger">
                        {error}
                    </p>
                )}
                <DialogActions onClose={onClose} closeLabel={TEXT.CLOSE} submitLabel={TEXT.SAVE} busy={busy} closeDisabled={busy} />
=======
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
>>>>>>> main
            </form>
        </Modal>
    );
};

export default ConfirmCallDialog;

import { useId, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { DialogActions, PriorityFields } from "./shared";
import { clinicClock, useSubmit } from "./receptionUtils";
import { PRIORITY } from "@/services/receptionService";
import { allergiesOf, isLate, serviceNames, slotOf } from "@/utils/checkIn";
import { CHECK_IN_TEXT as TEXT } from "@/utils/messages";

const UNAVAILABLE = ["Ended", "OnLeave"];

// Why the booked doctor cannot take the patient today
const awayNoteOf = (a, own) => {
    if (!a.doctorId) return TEXT.NO_DOCTOR_NOTE;
    if (!own) return TEXT.NO_SHIFT_NOTE(a.doctorName);
    return own.status === "OnLeave" ? TEXT.ON_LEAVE_NOTE(a.doctorName) : TEXT.ENDED_NOTE(a.doctorName, own.end);
};

// doctors: today's shifts (useDoctorsOnDuty); doctorsLoaded: false while they are still loading.
// waiting: today's waiting list, or null when it could not be loaded (counts are then hidden).
// onReschedule: opens the reschedule dialog for this appointment.
// When the booked doctor is away, the patient can see another doctor today (working now, or starting later)
// or the appointment is rescheduled with the booked doctor.
const CheckInDialog = ({ appointment: a, doctors = [], doctorsLoaded = true, waiting = [], onClose, onSubmit, onReschedule }) => {
    const noteId = useId();
    const errorId = useId();
    const firstRef = useRef(null);
    const now = clinicClock();
    const own = doctors.find((d) => d.id === a.doctorId);
    const away = !a.doctorId || (doctorsLoaded && (!own || UNAVAILABLE.includes(own.status)));
    const counted = Array.isArray(waiting);
    const waitingOf = (id) => (counted ? waiting.filter((w) => w.doctorId === id).length : null);
    // Working doctors first (least busy first), then doctors whose shift has not started yet (earliest first)
    const working = doctors.filter((d) => d.id !== a.doctorId && d.status === "Working").sort((x, y) => (waitingOf(x.id) ?? 0) - (waitingOf(y.id) ?? 0));
    const later = doctors.filter((d) => d.id !== a.doctorId && d.status === "NotStarted" && (!d.end || d.end > now)).sort((x, y) => (x.start ?? "").localeCompare(y.start ?? ""));
    const others = [...working, ...later];
    // null until the receptionist picks; a working doctor is suggested, a later shift never is
    const [picked, setPicked] = useState(null);
    const doctorId = away ? (others.some((d) => d.id === picked) ? picked : (working[0]?.id ?? null)) : a.doctorId;
    const [priority, setPriority] = useState(PRIORITY.NORMAL);
    const [reason, setReason] = useState("");
    const [tried, setTried] = useState(false);
    const [busy, submit] = useSubmit(onSubmit);
    const target = doctors.find((d) => d.id === doctorId);
    const allergies = allergiesOf(a);
    const late = isLate(a, now);
    const needsReason = priority > PRIORITY.NORMAL && !reason.trim();
    const stuck = away && others.length === 0;
    const optionOf = (d) => (d.status === "NotStarted" ? TEXT.DOCTOR_OPTION_LATER(d.name, d.room, d.start, waitingOf(d.id)) : TEXT.DOCTOR_OPTION(d.name, d.room, waitingOf(d.id)));
    const canReschedule = away && Boolean(onReschedule);

    const reschedule = canReschedule && !stuck && (
        <button type="button" className="btn btn-secondary" onClick={onReschedule} disabled={busy}>
            {TEXT.RESCHEDULE_WITH(a.doctorName)}
        </button>
    );

    return (
        <Modal
            title={TEXT.CHECK_IN}
            description={[a.patientName, a.patientCode].filter(Boolean).join(" · ")}
            onClose={onClose}
            closeDisabled={busy}
            initialFocusRef={firstRef}
        >
            <form
                noValidate
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (stuck) {
                        onReschedule?.();
                        return;
                    }
                    setTried(true);
                    if (busy || needsReason || (away && !doctorId)) return;
                    submit({ priority, reason: priority > PRIORITY.NORMAL ? reason.trim() : null, doctorId: away ? doctorId : undefined, room: target?.room });
                }}
            >
                <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 rounded-lg bg-surface-tint p-4 text-body-sm">
                    <dt className="text-muted">{TEXT.DIALOG_SLOT}</dt>
                    <dd className="num text-ink">
                        {slotOf(a) || TEXT.WALK_IN_SLOT}
                        {late && <span className="ml-2 font-semibold text-warning">{TEXT.LATE}</span>}
                    </dd>
                    <dt className="text-muted">{TEXT.DIALOG_SERVICES}</dt>
                    <dd className="text-ink">
                        {serviceNames(a).map((name) => (
                            <span key={name} className="block">
                                {name}
                            </span>
                        ))}
                    </dd>
                    {!away && (
                        <>
                            <dt className="text-muted">{TEXT.DIALOG_DOCTOR}</dt>
                            <dd className="text-ink">{a.doctorName ?? TEXT.NO_DOCTOR}</dd>
                        </>
                    )}
                    {allergies.length > 0 && (
                        <>
                            <dt className="text-muted">{TEXT.DIALOG_ALLERGY}</dt>
                            <dd>
                                <span className="badge badge-danger whitespace-normal">{allergies.join(", ")}</span>
                            </dd>
                        </>
                    )}
                </dl>
                {a.status === "PENDING" && !stuck && <p className="alert alert-warning">{TEXT.UNCONFIRMED}</p>}
                {away && (
                    <>
                        <p id={noteId} className="alert alert-danger">
                            {stuck ? TEXT.NO_OTHER_DOCTOR(a.doctorName) : awayNoteOf(a, own)}
                        </p>
                        {!stuck && (
                            <div className="field">
                                <label className="label label-required" htmlFor="ci-doctor-pick">
                                    {TEXT.PICK_DOCTOR}
                                </label>
                                <select
                                    ref={firstRef}
                                    id="ci-doctor-pick"
                                    className="input"
                                    value={doctorId ?? ""}
                                    aria-describedby={tried && !doctorId ? `${noteId} ${errorId}` : noteId}
                                    aria-invalid={tried && !doctorId}
                                    onChange={(e) => setPicked(e.target.value ? Number(e.target.value) : null)}
                                >
                                    {!doctorId && <option value="">{TEXT.PICK_DOCTOR_PLACEHOLDER}</option>}
                                    {working.length > 0 && (
                                        <optgroup label={TEXT.GROUP_WORKING}>
                                            {working.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {optionOf(d)}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {later.length > 0 && (
                                        <optgroup label={TEXT.GROUP_LATER}>
                                            {later.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {optionOf(d)}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                {tried && !doctorId && (
                                    <p id={errorId} role="alert" className="text-caption text-danger">
                                        {TEXT.ERR_DOCTOR}
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                )}
                {target && !stuck && (
                    <p className="rounded-lg border border-primary/20 bg-primary-softer px-4 py-2.5 text-body-sm text-body">
                        {[target.room, target.status === "NotStarted" && TEXT.STARTS_AT(target.start), counted && TEXT.WAITING_COUNT(waitingOf(target.id))].filter(Boolean).join(" · ")}
                    </p>
                )}
                {!stuck && <PriorityFields priority={priority} setPriority={setPriority} reason={reason} setReason={setReason} idPrefix="ci" />}
                {tried && needsReason && (
                    <p role="alert" className="text-caption text-danger">
                        {TEXT.ERR_REASON}
                    </p>
                )}
                {stuck && !onReschedule ? (
                    <div className="mt-6 flex justify-end">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            {TEXT.CLOSE}
                        </button>
                    </div>
                ) : (
                    <DialogActions
                        submitRef={away && !stuck ? undefined : firstRef}
                        extra={reschedule}
                        onClose={onClose}
                        closeLabel={TEXT.CLOSE}
                        submitLabel={stuck ? TEXT.RESCHEDULE_WITH(a.doctorName) : TEXT.CHECK_IN}
                        busy={busy}
                        closeDisabled={busy}
                    />
                )}
            </form>
        </Modal>
    );
};

export default CheckInDialog;

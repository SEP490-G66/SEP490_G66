import { useId, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { DialogActions, PriorityFields } from "./shared";
import { useSubmit } from "./receptionUtils";
import { PRIORITY } from "@/services/receptionService";
import { allergiesOf, serviceNames, slotOf } from "@/utils/checkIn";
import { CHECK_IN_TEXT as TEXT } from "@/utils/messages";

const UNAVAILABLE = ["Ended", "OnLeave"];

// late: the slot is over; onReschedule: opens the reschedule dialog for this appointment (offered when no doctor can take the patient)
const CheckInDialog = ({ appointment: a, doctors = [], waiting = [], late = false, onClose, onSubmit, onReschedule }) => {
    const noteId = useId();
    const own = doctors.find((d) => d.id === a.doctorId);
    const away = Boolean(own && UNAVAILABLE.includes(own.status));
    const waitingOf = (id) => waiting.filter((w) => w.doctorId === id).length;
    // Only a doctor working now can take the patient; the least busy first
    const others = doctors.filter((d) => d.id !== a.doctorId && d.status === "Working").sort((x, y) => waitingOf(x.id) - waitingOf(y.id));
    const [doctorId, setDoctorId] = useState(away ? (others[0]?.id ?? null) : a.doctorId);
    const [priority, setPriority] = useState(PRIORITY.NORMAL);
    const [reason, setReason] = useState("");
    const [tried, setTried] = useState(false);
    const [busy, submit] = useSubmit(onSubmit);
    const submitRef = useRef(null);
    const target = doctors.find((d) => d.id === doctorId);
    const [room, count] = TEXT.WAITING(target?.room, waitingOf(doctorId));
    const allergies = allergiesOf(a);
    const needsReason = priority > PRIORITY.NORMAL && !reason.trim();
    const stuck = away && others.length === 0;
    const awayNote = own?.status === "OnLeave" ? TEXT.ON_LEAVE_NOTE(a.doctorName) : TEXT.ENDED_NOTE(a.doctorName, own?.end);

    return (
        <Modal
            title={TEXT.CHECK_IN}
            description={[a.patientName, a.patientCode].filter(Boolean).join(" · ")}
            onClose={onClose}
            closeDisabled={busy}
            initialFocusRef={away ? undefined : submitRef}
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
                {a.status === "PENDING" && <p className="alert alert-warning">{TEXT.UNCONFIRMED}</p>}
                {away && (
                    <>
                        <p id={noteId} className="alert alert-danger">
                            {stuck ? TEXT.NO_OTHER_DOCTOR : awayNote}
                        </p>
                        {others.length > 0 && (
                            <div className="field">
                                <label className="label label-required" htmlFor="ci-doctor-pick">
                                    {TEXT.PICK_DOCTOR}
                                </label>
                                <select
                                    id="ci-doctor-pick"
                                    className="input"
                                    value={doctorId ?? ""}
                                    aria-describedby={noteId}
                                    onChange={(e) => setDoctorId(Number(e.target.value))}
                                >
                                    {others.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {TEXT.DOCTOR_OPTION(d.name, d.room, waitingOf(d.id))}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </>
                )}
                {target && !stuck && (
                    <p className="rounded-lg border border-primary/20 bg-primary-softer px-4 py-2.5 text-body-sm text-body">
                        {room && `${room} · `}
                        <b className="text-ink">{count}</b>
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
                    <DialogActionsWithRef
                        submitRef={submitRef}
                        onClose={onClose}
                        closeLabel={TEXT.CLOSE}
                        submitLabel={stuck ? TEXT.RESCHEDULE : TEXT.CHECK_IN}
                        busy={busy}
                        closeDisabled={busy}
                    />
                )}
            </form>
        </Modal>
    );
};

// DialogActions with a ref on the submit button, so a plain check-in can be confirmed with Enter right away.
const DialogActionsWithRef = ({ submitRef, ...props }) => (
    <div
        ref={(node) => {
            submitRef.current = node?.querySelector("button[type=submit]") ?? null;
        }}
    >
        <DialogActions {...props} />
    </div>
);

export default CheckInDialog;

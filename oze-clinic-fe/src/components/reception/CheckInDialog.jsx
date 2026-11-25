import { useId, useState } from "react";
import Modal from "@/components/ui/Modal";
import { DialogActions } from "./shared";
import { clinicClock, useSubmit } from "./receptionUtils";
import { fitsRoomTypes } from "@/utils/constants/room";
import { allergiesOf, serviceNames, slotOf } from "@/utils/checkIn";
import { CHECK_IN_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const awayNoteOf = (a, own) => {
    if (!a.doctorId) return TEXT.NO_DOCTOR_NOTE;
    if (!own) return TEXT.NO_SHIFT_NOTE(a.doctorName);
    return own.status === "OnLeave" ? TEXT.ON_LEAVE_NOTE(a.doctorName) : TEXT.ENDED_NOTE(a.doctorName, own.endedAt ?? own.end);
};

const CheckInDialog = ({ appointment: a, doctors = [], waiting = [], onClose, onSubmit, onReschedule, onCancel }) => {
    const groupId = useId();
    const now = clinicClock();
    const own = doctors.find((d) => d.id === a.doctorId);
    const counted = Array.isArray(waiting);
    // Without the waiting list, the count the backend gives with the doctors on duty
    const waitingOf = (id) => (counted ? waiting.filter((w) => w.doctorId === id).length : (doctors.find((d) => d.id === id)?.waiting ?? null));
    // Only doctors with a shift in the kind of room the services need (the backend refuses any other)
    const suitable = doctors.filter((d) => fitsRoomTypes(d.roomTypes, a.requiredRoomType));
    const working = suitable.filter((d) => d.id !== a.doctorId && d.status === "Working").sort((x, y) => (waitingOf(x.id) ?? 0) - (waitingOf(y.id) ?? 0));
    const later = suitable.filter((d) => d.id !== a.doctorId && d.status === "NotStarted" && (!d.end || d.end > now)).sort((x, y) => (x.start ?? "").localeCompare(y.start ?? ""));
    const others = [...working, ...later];
    const [choice, setChoice] = useState(others.length ? "other" : "reschedule");
    const [picked, setPicked] = useState(null);
    const doctorId = others.some((d) => d.id === picked) ? picked : (others[0]?.id ?? null);
    const target = others.find((d) => d.id === doctorId);
    const [busy, submit] = useSubmit(onSubmit);
    const allergies = allergiesOf(a);
    const optionOf = (d) => (d.status === "NotStarted" ? TEXT.DOCTOR_OPTION_LATER(d.name, d.room, d.start, waitingOf(d.id)) : TEXT.DOCTOR_OPTION(d.name, d.room, waitingOf(d.id)));

    const options = [
        { key: "other", label: TEXT.CHOICE_OTHER, hint: TEXT.CHOICE_OTHER_HINT, disabled: others.length === 0 },
        { key: "reschedule", label: TEXT.CHOICE_RESCHEDULE, hint: TEXT.CHOICE_RESCHEDULE_HINT, disabled: !a.timeSlotStart },
        { key: "cancel", label: TEXT.CHOICE_CANCEL, hint: TEXT.CHOICE_CANCEL_HINT },
    ];

    const handleSubmit = (event) => {
        event.preventDefault();
        if (busy) return;
        if (choice === "reschedule") onReschedule?.();
        else if (choice === "cancel") onCancel?.();
        else if (doctorId) submit({ doctorId, room: target?.room, doctorName: target?.name });
    };

    return (
        <Modal title={TEXT.CHECK_IN} description={[a.patientName, a.patientCode].filter(Boolean).join(" · ")} onClose={onClose} closeDisabled={busy}>
            <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-4">
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 rounded-lg bg-surface-muted px-3 py-2 text-body-sm">
                    {a.timeSlotStart && (
                        <>
                            <dt className="text-muted">{TEXT.DIALOG_SLOT}</dt>
                            <dd className="num text-ink">{slotOf(a)}</dd>
                        </>
                    )}
                    <dt className="text-muted">{TEXT.DIALOG_SERVICES}</dt>
                    <dd className="text-ink">{serviceNames(a).join(", ")}</dd>
                    <dt className="text-muted">{TEXT.DIALOG_DOCTOR}</dt>
                    <dd className="text-ink">{a.doctorName ?? TEXT.NO_DOCTOR}</dd>
                    {allergies.length > 0 && (
                        <>
                            <dt className="text-muted">{TEXT.DIALOG_ALLERGY}</dt>
                            <dd>
                                <span className="badge badge-danger whitespace-normal">{allergies.join(", ")}</span>
                            </dd>
                        </>
                    )}
                </dl>
                <div className="alert alert-danger">
                    <div>
                        <p className="font-semibold">{awayNoteOf(a, own)}</p>
                        {own?.absenceReason && <p className="mt-1">{TEXT.AWAY_REASON(own.absenceReason)}</p>}
                    </div>
                </div>
                <fieldset className="field" aria-describedby={others.length === 0 ? `${groupId}-none` : undefined}>
                    <legend className="label">{TEXT.CHOICE_LABEL}</legend>
                    <div className="flex flex-col gap-2">
                        {options.map((o) => (
                            <label
                                key={o.key}
                                className={cx(
                                    "flex items-start gap-3 rounded-lg border px-3 py-2.5",
                                    o.disabled ? "cursor-not-allowed border-border opacity-60" : "cursor-pointer",
                                    choice === o.key ? "border-primary bg-primary-softer" : "border-border-strong",
                                )}
                            >
                                <input type="radio" name={`${groupId}-choice`} className="mt-1" checked={choice === o.key} disabled={o.disabled} onChange={() => setChoice(o.key)} />
                                <span className="min-w-0 flex-1">
                                    <span className="block font-semibold text-ink">{o.label}</span>
                                    {o.key === "other" && choice === "other" ? (
                                        <>
                                            <select
                                                className="input mt-2"
                                                aria-label={TEXT.PICK_DOCTOR}
                                                value={doctorId ?? ""}
                                                onChange={(e) => setPicked(Number(e.target.value))}
                                            >
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
                                            <span className="mt-1 block text-caption text-muted">{o.hint}</span>
                                        </>
                                    ) : (
                                        <span className="block text-caption text-muted">{o.hint}</span>
                                    )}
                                </span>
                            </label>
                        ))}
                    </div>
                    {others.length === 0 && (
                        <p id={`${groupId}-none`} className="help-text">
                            {TEXT.NO_OTHER_DOCTOR}
                        </p>
                    )}
                </fieldset>
                <DialogActions
                    onClose={onClose}
                    closeLabel={TEXT.CLOSE}
                    submitLabel={choice === "other" ? TEXT.CHECK_IN_WITH(target?.name) : TEXT.CONTINUE}
                    busy={busy}
                    closeDisabled={busy}
                    disabled={choice === "other" && !doctorId}
                />
            </form>
        </Modal>
    );
};

export default CheckInDialog;

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { DialogActions } from "./shared";
import { PRIORITY_LABEL, useSubmit } from "./receptionUtils";
import { PRIORITY } from "@/services/receptionService";
import { serviceNames, slotOf } from "@/utils/checkIn";
import { CHECK_IN_TEXT as TEXT } from "@/utils/messages";

const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value: Number(value), label }));

const ENDED = ["Ended", "OnLeave"];

const CheckInDialog = ({ appointment: a, doctors = [], waiting = [], onClose, onSubmit }) => {
    const own = doctors.find((d) => d.id === a.doctorId);
    const ended = Boolean(own && ENDED.includes(own.status));
    const others = doctors.filter((d) => d.id !== a.doctorId && !ENDED.includes(d.status));
    const [doctorId, setDoctorId] = useState(ended ? (others[0]?.id ?? null) : a.doctorId);
    const [priority, setPriority] = useState(PRIORITY.NORMAL);
    const [busy, submit] = useSubmit(onSubmit);
    const target = doctors.find((d) => d.id === doctorId);
    const waitingCount = waiting.filter((w) => w.doctorId === doctorId).length;
    const [room, count] = TEXT.WAITING(target?.room, waitingCount);

    return (
        <Modal title={TEXT.CHECK_IN} description={[a.patientName, a.patientCode].filter(Boolean).join(" · ")} onClose={onClose}>
            <form
                className="space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit({ priority, doctorId: ended ? doctorId : undefined, room: target?.room });
                }}
            >
                <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 rounded-lg bg-surface-tint p-4 text-body-sm">
                    <dt className="text-muted">{TEXT.DIALOG_SLOT}</dt>
                    <dd className="num text-ink">{slotOf(a) || TEXT.WALK_IN_SLOT}</dd>
                    <dt className="text-muted">{TEXT.DIALOG_SERVICES}</dt>
                    <dd className="text-ink">
                        {serviceNames(a).map((name) => (
                            <span key={name} className="block">
                                {name}
                            </span>
                        ))}
                    </dd>
                    {!ended && (
                        <>
                            <dt className="text-muted">{TEXT.DIALOG_DOCTOR}</dt>
                            <dd className="text-ink">{a.doctorName ?? TEXT.NO_DOCTOR}</dd>
                        </>
                    )}
                </dl>
                {a.status === "PENDING" && <p className="alert alert-warning">{TEXT.UNCONFIRMED}</p>}
                {ended && (
                    <>
                        <p className="alert alert-danger">{others.length ? TEXT.ENDED_NOTE(a.doctorName) : TEXT.NO_OTHER_DOCTOR}</p>
                        {others.length > 0 && (
                            <div className="field">
                                <label className="label" htmlFor="ci-doctor-pick">
                                    {TEXT.PICK_DOCTOR}
                                </label>
                                <select id="ci-doctor-pick" className="input" value={doctorId ?? ""} onChange={(e) => setDoctorId(Number(e.target.value))}>
                                    {others.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.room ? `${d.name} · ${d.room}` : d.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </>
                )}
                {target && (
                    <p className="rounded-lg border border-primary/20 bg-primary-softer px-4 py-2.5 text-body-sm text-body">
                        {room && `${room} · `}
                        <b className="text-ink">{count}</b>
                    </p>
                )}
                <div className="field">
                    <span className="label">{TEXT.PRIORITY}</span>
                    <SegmentedControl label={TEXT.PRIORITY} options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} className="w-full" />
                </div>
                <DialogActions onClose={onClose} closeLabel={TEXT.CLOSE} submitLabel={TEXT.CHECK_IN} busy={busy} disabled={ended && !doctorId} />
            </form>
        </Modal>
    );
};

export default CheckInDialog;

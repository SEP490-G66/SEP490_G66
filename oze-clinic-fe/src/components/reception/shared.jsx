import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Modal from "@/components/ui/Modal";
import { PRIORITY, clinicToday, findPatientsByKeyword, getAvailableSlots, getDoctorOptions, getPatient, rescheduleAppointment } from "@/services/receptionService";
import { PRIORITY_LABEL, dmy, hhmm, slotText, useSubmit } from "./receptionUtils";
import { cx } from "@/utils/cx";
import { PATIENT_RECORD_TEXT, RESCHEDULE_TEXT, WALK_IN_TEXT } from "@/utils/messages";
import { genderOf, phoneDisplay, walkInName } from "@/utils/patientRecord";

// Shared pieces of the receptionist pages: formatting, status labels, page and card frames, and the dialogs.

export const Badge = ({ map, value }) => {
    const [label, badge] = map[value] ?? [value, "badge-neutral"];
    return <span className={cx("badge", badge)}>{label}</span>;
};

export const PageHeader = ({ title, description, children }) => (
    <header className="page-header">
        <div>
            <h1 className="page-title">{title}</h1>
            {description && <p className="page-description first-letter:uppercase">{description}</p>}
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
);

// White card with a title row; link = { to, label } opens the full page of that list
export const Card = ({ title, link, actions, children, className }) => (
    <section className={cx("rounded-xl border border-border bg-canvas", className)}>
        {(title || link || actions) && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
                {title && <h2 className="mr-auto font-heading text-title text-ink">{title}</h2>}
                {actions}
                {link && (
                    <Link to={link.to} className="text-label font-semibold text-primary hover:underline">
                        {link.label}
                    </Link>
                )}
            </div>
        )}
        {children}
    </section>
);

export const FilterBar = ({ children }) => <div className="flex flex-wrap items-center gap-3 px-5 py-4">{children}</div>;

export const EmptyState = ({ text }) => <p className="px-6 py-10 text-center text-body-sm text-muted">{text}</p>;

export const ErrorLine = ({ message }) =>
    message ? (
        <p role="alert" className="mb-4 rounded-lg border border-danger-solid/40 bg-danger-soft px-4 py-3 text-body-sm text-danger">
            Không tải được dữ liệu: {message}
        </p>
    ) : null;

export const RescheduleDialog = ({ appointment: a, onClose, onDone }) => {
    const T = RESCHEDULE_TEXT;
    const ids = useId();
    const today = clinicToday();
    const [step, setStep] = useState("edit");
    const [date, setDate] = useState(a.appointmentDate >= today ? a.appointmentDate : today);
    const [doctor, setDoctor] = useState(a.doctorId ? String(a.doctorId) : "any");
    const [doctorList, setDoctorList] = useState([]);
    const [slots, setSlots] = useState({ loading: true, ok: true, items: [] });
    const [slotStart, setSlotStart] = useState("");
    const [reason, setReason] = useState("");
    const [tried, setTried] = useState(false);
    const [busy, setBusy] = useState(false);
    const anyDoctor = doctor === "any";

    useEffect(() => {
        const controller = new AbortController();
        getDoctorOptions({ skipErrorPage: true, signal: controller.signal }).then((result) => {
            if (!result.success || controller.signal.aborted) return;
            const items = Array.isArray(result.data) ? result.data : (result.data?.items ?? []);
            setDoctorList(items.map((d) => ({ id: String(d.id), name: d.fullName })));
        });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        let active = true;
        getAvailableSlots(
            {
                date,
                doctorId: anyDoctor ? null : Number(doctor),
                serviceIds: (a.services ?? []).map((s) => s.serviceId),
                variantIds: (a.services ?? []).flatMap((s) => (s.variantId ? [s.variantId] : [])),
            },
            { skipErrorPage: true },
        ).then((result) => active && setSlots({ loading: false, ok: result.success, items: result.success && Array.isArray(result.data) ? result.data : [] }));
        return () => {
            active = false;
        };
    }, [date, doctor, anyDoctor, a]);

    const doctorOptions = [...doctorList];
    if (a.doctorId && !doctorOptions.some((d) => d.id === String(a.doctorId))) doctorOptions.unshift({ id: String(a.doctorId), name: a.doctorName ?? "" });
    const times = [...new Map(slots.items.map((s) => [s.slotStart, slots.items.filter((x) => x.slotStart === s.slotStart).length])).entries()];
    const doctorName = anyDoctor ? null : (doctorOptions.find((d) => d.id === doctor)?.name ?? slots.items[0]?.doctorName ?? null);
    const slotMissing = !slotStart;
    const reasonMissing = !reason.trim();

    const resetSlot = () => {
        setSlotStart("");
        setSlots({ loading: true, ok: true, items: [] });
    };

    const review = (event) => {
        event.preventDefault();
        setTried(true);
        if (slotMissing || reasonMissing) return;
        setStep("confirm");
    };

    const save = async () => {
        if (busy) return;
        setBusy(true);
        const result = await rescheduleAppointment(a.id, { date, slotStart, doctorId: anyDoctor ? null : Number(doctor), reason: reason.trim() });
        setBusy(false);
        if (!result.success) {
            toast.error(result.message || T.SUBMIT);
            setStep("edit");
            return;
        }
        const saved = result.data ?? {};
        toast.success(T.DONE(a.patientName, hhmm(saved.timeSlotStart ?? slotStart), dmy(saved.appointmentDate ?? date), saved.doctorName ?? doctorName), { role: "status" });
        onDone?.(saved);
    };

    if (step === "confirm") {
        return (
            <Modal title={T.CONFIRM_TITLE} description={T.CONFIRM_DESCRIPTION} size="sm" onClose={() => !busy && setStep("edit")} closeDisabled={busy}>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 rounded-lg bg-surface-muted px-3 py-2 text-body-sm">
                    <dt className="text-muted">{T.PATIENT}</dt>
                    <dd className="text-ink">{a.patientName}</dd>
                    <dt className="text-muted">{T.OLD}</dt>
                    <dd className="text-ink">{T.LINE(slotText(a), dmy(a.appointmentDate), a.doctorName)}</dd>
                    <dt className="text-muted">{T.NEW}</dt>
                    <dd className="font-semibold text-ink">{T.LINE(hhmm(slotStart), dmy(date), doctorName ?? T.AUTO_DOCTOR)}</dd>
                </dl>
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn btn-secondary" onClick={() => setStep("edit")} disabled={busy}>
                        {T.BACK}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
                        {busy && <span className="btn-spinner" aria-hidden />}
                        {T.AGREE}
                    </button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal title={T.TITLE} description={[a.patientName, T.CURRENT(slotText(a), dmy(a.appointmentDate), a.doctorName)].join(" · ")} onClose={onClose}>
            <form noValidate onSubmit={review} className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="field">
                        <label className="label label-required" htmlFor={`${ids}-date`}>
                            {T.DATE}
                        </label>
                        <input
                            id={`${ids}-date`}
                            type="date"
                            className="input"
                            min={today}
                            value={date}
                            onChange={(e) => {
                                setDate(e.target.value);
                                resetSlot();
                            }}
                        />
                    </div>
                    <div className="field">
                        <label className="label label-required" htmlFor={`${ids}-doctor`}>
                            {T.DOCTOR}
                        </label>
                        <select
                            id={`${ids}-doctor`}
                            className="input"
                            value={doctor}
                            onChange={(e) => {
                                setDoctor(e.target.value);
                                resetSlot();
                            }}
                        >
                            <option value="any">{T.ANY_DOCTOR}</option>
                            {doctorOptions.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.id === String(a.doctorId) ? T.CURRENT_DOCTOR(d.name) : d.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <fieldset className="field" aria-describedby={`${ids}-slot-help`}>
                    <legend className="label label-required">{T.SLOTS}</legend>
                    {slots.loading ? (
                        <p className="text-body-sm text-muted">{T.SLOTS_LOADING}</p>
                    ) : !slots.ok ? (
                        <p className="text-body-sm text-danger">{T.SLOTS_ERROR}</p>
                    ) : times.length === 0 ? (
                        <p className="text-body-sm text-muted">{T.SLOTS_EMPTY}</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {times.map(([start, count]) => (
                                <button
                                    key={start}
                                    type="button"
                                    aria-pressed={slotStart === start}
                                    onClick={() => setSlotStart(start)}
                                    className={cx(
                                        "num rounded-full border px-3 py-1 text-body-sm",
                                        slotStart === start ? "border-primary bg-primary-soft text-primary" : "border-border-strong text-body",
                                    )}
                                >
                                    {anyDoctor ? T.SLOT_DOCTORS(hhmm(start), count) : hhmm(start)}
                                </button>
                            ))}
                        </div>
                    )}
                    <p id={`${ids}-slot-help`} className={cx("help-text", tried && slotMissing && "text-danger")}>
                        {tried && slotMissing ? T.ERR_SLOT : anyDoctor ? T.SLOT_HELP_ANY : T.SLOT_HELP_ONE}
                    </p>
                </fieldset>
                <div className="field">
                    <label className="label label-required" htmlFor={`${ids}-reason`}>
                        {T.REASON}
                    </label>
                    <textarea
                        id={`${ids}-reason`}
                        className="input h-20 py-2"
                        maxLength={500}
                        value={reason}
                        placeholder={T.REASON_PLACEHOLDER}
                        aria-invalid={tried && reasonMissing ? "true" : undefined}
                        aria-describedby={`${ids}-reason-help`}
                        onChange={(e) => setReason(e.target.value)}
                    />
                    <p id={`${ids}-reason-help`} className={cx("help-text", tried && reasonMissing && "text-danger")}>
                        {tried && reasonMissing ? T.ERR_REASON : T.REASON_HELP}
                    </p>
                </div>
                <DialogActions onClose={onClose} closeLabel={T.CLOSE} submitLabel={T.SUBMIT} />
            </form>
        </Modal>
    );
};

// submitRef: a ref on the submit button (e.g. to focus it on open); extra: more buttons between Close and submit
export const DialogActions = ({ onClose, submitLabel, disabled, danger, busy, closeDisabled, closeLabel, submitRef, extra }) => (
    <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={closeDisabled}>
            {closeLabel ?? "Đóng"}
        </button>
        {extra}
        <button ref={submitRef} type="submit" className={cx("btn", danger ? "btn-danger" : "btn-primary")} disabled={disabled || busy}>
            {busy && <span className="btn-spinner" aria-hidden />}
            {submitLabel}
        </button>
    </div>
);

// Priority groups of the Law on Medical Examination and Treatment 2023 (art. 3.2); anything else is typed.
// The reason is shown to staff only (receptionist, examining doctor), never to the patient.
const PRIORITY_REASONS = ["Cấp cứu", "Trẻ em dưới 6 tuổi", "Phụ nữ có thai", "Người khuyết tật nặng", "Người từ 75 tuổi", "Người có công với cách mạng"];

export const PriorityFields = ({ priority, setPriority, reason, setReason, idPrefix, checkedRef }) => (
    <>
        <fieldset className="field">
            <legend className="label">Mức ưu tiên</legend>
            <div className="flex flex-wrap gap-4 pt-1">
                {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-body-sm">
                        <input
                            ref={priority === Number(value) ? checkedRef : undefined}
                            type="radio"
                            name={`${idPrefix}-priority`}
                            checked={priority === Number(value)}
                            onChange={() => setPriority(Number(value))}
                        />
                        {label}
                    </label>
                ))}
            </div>
        </fieldset>
        {priority > PRIORITY.NORMAL && (
            <div className="field">
                <label className="label label-required" htmlFor={`${idPrefix}-reason`}>
                    Lý do ưu tiên
                </label>
                {/* The usual reasons in one tap; anything else is typed */}
                <div className="flex flex-wrap gap-1.5">
                    {PRIORITY_REASONS.map((r) => (
                        <button
                            key={r}
                            type="button"
                            aria-pressed={reason === r}
                            onClick={() => setReason(r)}
                            className={cx(
                                "rounded-full border px-3 py-1 text-caption",
                                reason === r ? "border-primary bg-primary-soft text-primary" : "border-border-strong text-body hover:text-ink",
                            )}
                        >
                            {r}
                        </button>
                    ))}
                </div>
                <input
                    id={`${idPrefix}-reason`}
                    className="input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Hoặc ghi lý do khác"
                />
                <p className="text-caption text-muted">Lý do chỉ lễ tân và bác sĩ thấy, không hiện cho bệnh nhân.</p>
            </div>
        )}
    </>
);

export const CancelDialog = ({ appointment, onClose, onSubmit }) => {
    const [reason, setReason] = useState("");
    const [busy, submit] = useSubmit(onSubmit);
    return (
        <Modal
            title={`Hủy lịch của ${appointment.patientName}`}
            description="Khung giờ được trả lại cho người khác đặt. Không hoàn tác được."
            onClose={onClose}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    submit(reason.trim());
                }}
            >
                <div className="field">
                    <label className="label label-required" htmlFor="cancel-reason">
                        Lý do hủy
                    </label>
                    <textarea
                        id="cancel-reason"
                        className="input h-24 py-2"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ví dụ: khách gọi báo bận việc"
                    />
                </div>
                <DialogActions onClose={onClose} submitLabel="Hủy lịch" disabled={!reason.trim()} danger busy={busy} />
            </form>
        </Modal>
    );
};

const PatientWalkInDialog = ({ doctors, onClose, onSubmit, patient, doctorsStatus, onRetryDoctors }) => {
    const [doctorId, setDoctorId] = useState("");
    const [priority, setPriorityValue] = useState(PRIORITY.NORMAL);
    const [reason, setReason] = useState("");
    const [sending, setSending] = useState(false);
    const [alert, setAlert] = useState(null);
    const [doctorError, setDoctorError] = useState(false);
    const priorityRef = useRef(null);
    const doctorRef = useRef(null);
    const alertRef = useRef(null);
    const formRef = useRef(null);

    useEffect(() => {
        if (patient) onRetryDoctors?.();
    }, [patient, onRetryDoctors]);

    useEffect(() => {
        if (alert) alertRef.current?.focus();
    }, [alert]);

    const needsReason = priority > PRIORITY.NORMAL && !reason.trim();
    const chosenDoctor = !doctors.some((d) => String(d.id) === String(doctorId)) ? "" : doctorId;
    const doctorsReady = doctorsStatus === "ready";

    const sendForPatient = async () => {
        if (!chosenDoctor) {
            setDoctorError(true);
            doctorRef.current?.focus();
            return;
        }
        setSending(true);
        setAlert(null);
        formRef.current?.closest(".modal")?.focus();
        try {
            const outcome = await onSubmit({
                fullName: walkInName(patient.fullName),
                phoneNumber: patient.phoneNumber,
                dateOfBirth: null,
                gender: null,
                email: null,
                doctorId: Number(chosenDoctor),
                serviceId: [],
                variantId: [],
                priority,
                reason: reason.trim() || null,
            });
            if (outcome?.alert) setAlert(outcome.alert);
        } finally {
            setSending(false);
        }
    };

    const genderLabel = genderOf(patient.gender).label;
    return (
        <Modal
            title={PATIENT_RECORD_TEXT.WALK_IN_TITLE}
            description={PATIENT_RECORD_TEXT.WALK_IN_DESCRIPTION}
            onClose={onClose}
            initialFocusRef={priorityRef}
            closeDisabled={sending}
        >
            <form
                ref={formRef}
                noValidate
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!sending) sendForPatient();
                }}
                className="space-y-4"
            >
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg bg-surface-muted px-3 py-2 text-body-sm">
                    {[
                        [PATIENT_RECORD_TEXT.FIELDS.FULL_NAME, patient.fullName],
                        [PATIENT_RECORD_TEXT.FIELDS.PHONE, phoneDisplay(patient.phoneNumber)],
                        [PATIENT_RECORD_TEXT.FIELDS.DOB, patient.dateOfBirth ? dmy(String(patient.dateOfBirth).slice(0, 10)) : PATIENT_RECORD_TEXT.DASH],
                        [PATIENT_RECORD_TEXT.FIELDS.GENDER, genderLabel],
                    ].map(([label, value]) => (
                        <div key={label} className="contents">
                            <dt className="text-muted">{label}</dt>
                            <dd className="m-0 text-ink">{value}</dd>
                        </div>
                    ))}
                </dl>
                <div className="field">
                    <label className="label label-required" htmlFor="wi-doctor">
                        {PATIENT_RECORD_TEXT.DOCTOR_LABEL}
                    </label>
                    <select
                        ref={doctorRef}
                        id="wi-doctor"
                        className="input"
                        value={chosenDoctor}
                        disabled={!doctorsReady || sending}
                        aria-invalid={doctorError ? "true" : undefined}
                        aria-describedby={doctorError ? "wi-doctor-error" : undefined}
                        onChange={(e) => {
                            setDoctorId(e.target.value);
                            setDoctorError(false);
                        }}
                    >
                        <option value="">{PATIENT_RECORD_TEXT.CHOOSE_DOCTOR}</option>
                        {doctors.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                                {d.room ? ` · ${d.room}` : ""}
                            </option>
                        ))}
                    </select>
                    {doctorsStatus === "loading" && <p className="help-text">{PATIENT_RECORD_TEXT.REASON_DOCTORS_LOADING}</p>}
                    {doctorsReady && doctors.length === 0 && <p className="help-text">{PATIENT_RECORD_TEXT.REASON_NO_DOCTORS}</p>}
                    {doctorError && (
                        <p id="wi-doctor-error" className="error-text">
                            {PATIENT_RECORD_TEXT.DOCTOR_REQUIRED}
                        </p>
                    )}
                </div>
                {doctorsStatus === "error" && (
                    <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                        <span className="flex-1">{PATIENT_RECORD_TEXT.REASON_DOCTORS_ERROR}</span>
                        <button type="button" className="btn btn-secondary h-9" onClick={() => onRetryDoctors?.()}>
                            {PATIENT_RECORD_TEXT.RETRY}
                        </button>
                    </div>
                )}
                <PriorityFields priority={priority} setPriority={setPriorityValue} reason={reason} setReason={setReason} idPrefix="wi" checkedRef={priorityRef} />
                {alert && (
                    <p ref={alertRef} role="alert" tabIndex={-1} className="alert alert-danger">
                        {alert}
                    </p>
                )}
                <DialogActions
                    onClose={onClose}
                    submitLabel={PATIENT_RECORD_TEXT.WALK_IN_SUBMIT}
                    busy={sending}
                    disabled={!doctorsReady || doctors.length === 0 || needsReason}
                    closeDisabled={sending}
                    closeLabel={PATIENT_RECORD_TEXT.CANCEL}
                />
            </form>
        </Modal>
    );
};

const HistoryGroup = ({ title, tone, options, value, onChange, other, onOther, otherPlaceholder, otherError }) => {
    const ids = useId();
    const otherRef = useRef(null);
    const count = value.length + (other.on && other.text.trim() ? 1 : 0);
    const toggle = (item) => onChange(value.includes(item) ? value.filter((x) => x !== item) : [...value, item]);
    return (
        <fieldset className="border-t border-border pt-3 first-of-type:border-t-0 first-of-type:pt-0">
            <legend className="flex w-full items-center justify-between">
                <span className={cx("font-semibold", tone)}>{title}</span>
                <span className="text-caption text-muted">{WALK_IN_TEXT.SELECTED(count)}</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
                {options.map((item) => {
                    const on = value.includes(item);
                    return (
                        <label
                            key={item}
                            className={cx(
                                "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-body-sm",
                                on ? "border-primary bg-primary-soft text-primary" : "border-border-strong text-body",
                            )}
                        >
                            <input type="checkbox" checked={on} onChange={() => toggle(item)} />
                            {item}
                        </label>
                    );
                })}
            </div>
            <div className="mt-2 flex items-center gap-2">
                <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-body-sm">
                    <input
                        type="checkbox"
                        checked={other.on}
                        onChange={(e) => {
                            const on = e.target.checked;
                            onOther({ on, text: on ? other.text : "" });
                            if (on) setTimeout(() => otherRef.current?.focus(), 0);
                        }}
                    />
                    {WALK_IN_TEXT.OTHER}
                </label>
                <input
                    ref={otherRef}
                    className="input h-9 min-w-0 flex-1 disabled:bg-surface-muted"
                    disabled={!other.on}
                    maxLength={200}
                    aria-label={otherPlaceholder}
                    placeholder={otherPlaceholder}
                    value={other.text}
                    aria-invalid={otherError ? "true" : undefined}
                    aria-describedby={otherError ? `${ids}-error` : undefined}
                    onChange={(e) => onOther({ on: true, text: e.target.value })}
                />
            </div>
            {otherError && (
                <p id={`${ids}-error`} className="error-text">
                    {WALK_IN_TEXT.ERR_OTHER}
                </p>
            )}
        </fieldset>
    );
};

const Section = ({ title, note, children }) => (
    <section className="rounded-lg border border-border p-4">
        <h3 className="mb-3 flex flex-wrap items-baseline gap-2 font-heading text-heading-3 text-ink">
            {title}
            {note && <small className="text-caption font-normal text-muted">{note}</small>}
        </h3>
        {children}
    </section>
);

const NO_OTHER = { on: false, text: "" };

const NewWalkInDialog = ({ doctors, waiting, onClose, onSubmit }) => {
    const T = WALK_IN_TEXT;
    const ids = useId();
    const [phone, setPhone] = useState("");
    const [found, setFound] = useState(null);
    const [record, setRecord] = useState(null);
    const [fullName, setFullName] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [gender, setGender] = useState("");
    const [guardianName, setGuardianName] = useState("");
    const [guardianPhone, setGuardianPhone] = useState("");
    const [visit, setVisit] = useState("");
    const [allergies, setAllergies] = useState([]);
    const [allergyOther, setAllergyOther] = useState(NO_OTHER);
    const [conditions, setConditions] = useState([]);
    const [conditionOther, setConditionOther] = useState(NO_OTHER);
    const [doctorId, setDoctorId] = useState("");
    const [priority, setPriority] = useState(PRIORITY.NORMAL);
    const [reasonPick, setReasonPick] = useState("");
    const [reasonOther, setReasonOther] = useState("");
    const [tried, setTried] = useState(false);
    const [busy, submit] = useSubmit(onSubmit);
    const lookupRef = useRef(0);

    const female = gender === "Female";
    const conditionOptions = female ? [...T.CONDITION_OPTIONS(), ...T.FEMALE_OPTIONS()] : T.CONDITION_OPTIONS();
    const counted = Array.isArray(waiting);
    const waitingOf = (id) => (counted ? waiting.filter((w) => w.doctorId === id).length : null);

    const lookUp = async () => {
        const digits = phone.replace(/\s/g, "");
        if (digits.length < 10) return;
        const ticket = ++lookupRef.current;
        const result = await findPatientsByKeyword(digits);
        if (ticket !== lookupRef.current) return;
        const patient = result.success ? (result.data?.items?.[0] ?? null) : null;
        setFound(patient ?? false);
        setRecord(patient ? { loading: true } : null);
        if (!patient) return;
        const detail = await getPatient(patient.id, { skipErrorPage: true });
        if (ticket !== lookupRef.current) return;
        setRecord(detail.success ? detail.data : { failed: true });
    };

    const errors = {
        phone: !phone.trim(),
        name: !found && !fullName.trim(),
        doctor: !doctorId,
        priority: priority > PRIORITY.NORMAL && (!reasonPick || (reasonPick === T.PRIORITY_OTHER && !reasonOther.trim())),
        allergyOther: !found && allergyOther.on && !allergyOther.text.trim(),
        conditionOther: !found && conditionOther.on && !conditionOther.text.trim(),
    };
    const show = (key) => tried && errors[key];

    const history = () => {
        if (found) return [];
        const items = [
            ...allergies.map((title) => ({ recordType: "Allergy", title })),
            ...(allergyOther.on && allergyOther.text.trim() ? [{ recordType: "Allergy", title: allergyOther.text.trim() }] : []),
            ...conditions.filter((title) => conditionOptions.includes(title)).map((title) => ({ recordType: "Condition", title })),
            ...(conditionOther.on && conditionOther.text.trim() ? [{ recordType: "Condition", title: conditionOther.text.trim() }] : []),
        ];
        return items;
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        setTried(true);
        if (Object.values(errors).some(Boolean)) return;
        submit({
            fullName: found ? found.fullName : fullName.trim(),
            phoneNumber: phone.replace(/\s/g, ""),
            dateOfBirth: found ? null : dateOfBirth || null,
            gender: found ? null : gender || null,
            email: null,
            doctorId: Number(doctorId),
            serviceId: [],
            variantId: [],
            priority,
            reason: priority > PRIORITY.NORMAL ? (reasonPick === T.PRIORITY_OTHER ? reasonOther.trim() : reasonPick) : null,
            note: visit.trim() || null,
            emergencyContactName: found ? null : guardianName.trim() || null,
            emergencyContactPhone: found ? null : guardianPhone.replace(/\s/g, "") || null,
            medicalHistory: history(),
        });
    };

    const saved = record?.medicalProfiles ?? [];

    return (
        <Modal title={T.TITLE} size="xl" onClose={onClose} closeDisabled={busy}>
            <form noValidate onSubmit={handleSubmit} className="mt-4">
                <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                    <div className="space-y-4">
                        <Section title={T.SEC_ADMIN}>
                            <div className="space-y-3">
                                <div className="field">
                                    <label className="label label-required" htmlFor={`${ids}-phone`}>
                                        {T.PHONE}
                                    </label>
                                    <input
                                        id={`${ids}-phone`}
                                        className="input"
                                        inputMode="tel"
                                        value={phone}
                                        aria-invalid={show("phone") ? "true" : undefined}
                                        aria-describedby={`${ids}-phone-help`}
                                        onChange={(e) => {
                                            lookupRef.current += 1;
                                            setPhone(e.target.value);
                                            setFound(null);
                                            setRecord(null);
                                        }}
                                        onBlur={lookUp}
                                    />
                                    <p id={`${ids}-phone-help`} className={cx("help-text", found && "text-success", show("phone") && "text-danger")}>
                                        {show("phone") ? T.ERR_PHONE : found ? T.PHONE_FOUND(found.fullName, found.patientCode) : found === false ? T.PHONE_NEW : T.PHONE_HINT}
                                    </p>
                                </div>
                                {found ? (
                                    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 rounded-lg bg-surface-muted px-3 py-2 text-body-sm">
                                        <dt className="text-muted">{T.FULL_NAME}</dt>
                                        <dd className="text-ink">{[found.fullName, found.patientCode].filter(Boolean).join(" · ")}</dd>
                                        <dt className="text-muted">{T.DOB}</dt>
                                        <dd className="text-ink">{found.dateOfBirth ? dmy(String(found.dateOfBirth).slice(0, 10)) : PATIENT_RECORD_TEXT.DASH}</dd>
                                        <dt className="text-muted">{T.GENDER}</dt>
                                        <dd className="text-ink">{genderOf(found.gender).label}</dd>
                                        <dt className="text-muted">{T.SEC_GUARDIAN}</dt>
                                        <dd className="text-ink">
                                            {T.GUARDIAN_LINE(record?.emergencyContactName, record?.emergencyContactPhone && phoneDisplay(record.emergencyContactPhone)) || PATIENT_RECORD_TEXT.DASH}
                                        </dd>
                                    </dl>
                                ) : (
                                    <>
                                        <div className="field">
                                            <label className="label label-required" htmlFor={`${ids}-name`}>
                                                {T.FULL_NAME}
                                            </label>
                                            <input
                                                id={`${ids}-name`}
                                                className="input"
                                                maxLength={100}
                                                placeholder={T.NAME_PLACEHOLDER}
                                                value={fullName}
                                                aria-invalid={show("name") ? "true" : undefined}
                                                aria-describedby={show("name") ? `${ids}-name-error` : undefined}
                                                onChange={(e) => setFullName(e.target.value)}
                                            />
                                            {show("name") && (
                                                <p id={`${ids}-name-error`} className="error-text">
                                                    {T.ERR_NAME}
                                                </p>
                                            )}
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="field">
                                                <label className="label" htmlFor={`${ids}-dob`}>
                                                    {T.DOB}
                                                </label>
                                                <input id={`${ids}-dob`} className="input" type="date" value={dateOfBirth} max={clinicToday()} onChange={(e) => setDateOfBirth(e.target.value)} />
                                            </div>
                                            <fieldset className="field">
                                                <legend className="label">{T.GENDER}</legend>
                                                <div className="flex gap-4 pt-2">
                                                    {T.GENDERS().map(([value, label]) => (
                                                        <label key={value} className="flex items-center gap-2 text-body-sm">
                                                            <input type="radio" name={`${ids}-gender`} checked={gender === value} onChange={() => setGender(value)} />
                                                            {label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </fieldset>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Section>
                        {!found && (
                            <Section title={T.SEC_GUARDIAN}>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="field">
                                        <label className="label" htmlFor={`${ids}-g-name`}>
                                            {T.GUARDIAN_NAME}
                                        </label>
                                        <input id={`${ids}-g-name`} className="input" maxLength={100} value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
                                    </div>
                                    <div className="field">
                                        <label className="label" htmlFor={`${ids}-g-phone`}>
                                            {T.GUARDIAN_PHONE}
                                        </label>
                                        <input id={`${ids}-g-phone`} className="input" inputMode="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
                                    </div>
                                </div>
                            </Section>
                        )}
                        <Section title={T.SEC_VISIT}>
                            <textarea
                                className="input h-20 py-2"
                                aria-label={T.SEC_VISIT}
                                maxLength={500}
                                placeholder={T.VISIT_PLACEHOLDER}
                                value={visit}
                                onChange={(e) => setVisit(e.target.value)}
                            />
                        </Section>
                    </div>
                    <div className="space-y-4">
                        {found ? (
                            <Section title={T.SAVED_HISTORY}>
                                {record?.loading ? (
                                    <p className="text-body-sm text-muted">{T.HISTORY_LOADING}</p>
                                ) : saved.length === 0 ? (
                                    <p className="text-body-sm text-muted">{T.NO_SAVED_HISTORY}</p>
                                ) : (
                                    <ul className="space-y-1.5">
                                        {saved.map((p) => {
                                            const [label, badge] = T.SAVED_TYPE[p.recordType] ?? [p.recordType, "badge-neutral"];
                                            return (
                                                <li key={p.id} className="flex flex-wrap items-center gap-2 text-body-sm text-ink">
                                                    <span className={cx("badge", badge)}>{label}</span>
                                                    {p.title}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                <p className="alert alert-info mt-3">{T.EDIT_IN_RECORD}</p>
                            </Section>
                        ) : (
                            <Section title={T.SEC_HISTORY} note={T.HISTORY_HINT}>
                                <div className="space-y-3">
                                    <HistoryGroup
                                        title={T.ALLERGY}
                                        tone="text-danger"
                                        options={T.ALLERGY_OPTIONS()}
                                        value={allergies}
                                        onChange={setAllergies}
                                        other={allergyOther}
                                        onOther={setAllergyOther}
                                        otherPlaceholder={T.OTHER_ALLERGY}
                                        otherError={show("allergyOther")}
                                    />
                                    <HistoryGroup
                                        title={T.CONDITION}
                                        tone="text-warning"
                                        options={conditionOptions}
                                        value={conditions.filter((c) => conditionOptions.includes(c))}
                                        onChange={setConditions}
                                        other={conditionOther}
                                        onOther={setConditionOther}
                                        otherPlaceholder={T.OTHER_CONDITION}
                                        otherError={show("conditionOther")}
                                    />
                                </div>
                            </Section>
                        )}
                        <Section title={T.SEC_EXAM}>
                            <div className="space-y-3">
                                <div className="field">
                                    <label className="label label-required" htmlFor={`${ids}-doctor`}>
                                        {T.DOCTOR}
                                    </label>
                                    <select
                                        id={`${ids}-doctor`}
                                        className="input"
                                        value={doctorId}
                                        disabled={doctors.length === 0}
                                        aria-invalid={show("doctor") ? "true" : undefined}
                                        aria-describedby={`${ids}-doctor-help`}
                                        onChange={(e) => setDoctorId(e.target.value)}
                                    >
                                        <option value="">{T.DOCTOR_PICK}</option>
                                        {doctors.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {T.DOCTOR_OPTION(d.name, d.room, waitingOf(d.id))}
                                            </option>
                                        ))}
                                    </select>
                                    <p id={`${ids}-doctor-help`} className={cx("help-text", show("doctor") && "text-danger")}>
                                        {doctors.length === 0 ? T.NO_DOCTORS : show("doctor") ? T.ERR_DOCTOR : T.DOCTOR_HELP}
                                    </p>
                                </div>
                                <fieldset className="field">
                                    <legend className="label">{T.PRIORITY}</legend>
                                    <div className="flex flex-wrap gap-4 pt-1">
                                        {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                                            <label key={value} className="flex items-center gap-2 text-body-sm">
                                                <input type="radio" name={`${ids}-priority`} checked={priority === Number(value)} onChange={() => setPriority(Number(value))} />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                                {priority > PRIORITY.NORMAL && (
                                    <div className="field">
                                        <label className="label label-required" htmlFor={`${ids}-reason`}>
                                            {T.PRIORITY_REASON}
                                        </label>
                                        <select
                                            id={`${ids}-reason`}
                                            className="input"
                                            value={reasonPick}
                                            aria-invalid={show("priority") && !reasonPick ? "true" : undefined}
                                            onChange={(e) => setReasonPick(e.target.value)}
                                        >
                                            <option value="">{T.PRIORITY_PICK}</option>
                                            {[...T.PRIORITY_REASONS(), T.PRIORITY_OTHER].map((r) => (
                                                <option key={r} value={r}>
                                                    {r}
                                                </option>
                                            ))}
                                        </select>
                                        {reasonPick === T.PRIORITY_OTHER && (
                                            <input
                                                className="input mt-2"
                                                aria-label={T.PRIORITY_OTHER_INPUT}
                                                placeholder={T.PRIORITY_OTHER_INPUT}
                                                maxLength={500}
                                                value={reasonOther}
                                                aria-invalid={show("priority") ? "true" : undefined}
                                                onChange={(e) => setReasonOther(e.target.value)}
                                            />
                                        )}
                                        <p className={cx("help-text", show("priority") && "text-danger")}>{show("priority") ? T.ERR_PRIORITY_REASON : T.PRIORITY_HELP}</p>
                                    </div>
                                )}
                            </div>
                        </Section>
                    </div>
                </div>
                <DialogActions onClose={onClose} closeLabel={T.CANCEL} submitLabel={T.SUBMIT} busy={busy} closeDisabled={busy} disabled={doctors.length === 0} />
            </form>
        </Modal>
    );
};

export const WalkInDialog = ({ patient, ...props }) => (patient ? <PatientWalkInDialog patient={patient} {...props} /> : <NewWalkInDialog {...props} />);

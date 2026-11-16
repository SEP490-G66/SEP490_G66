import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "@/components/ui/Modal";
import { PRIORITY, clinicToday, findPatientsByKeyword, getAvailableSlots } from "@/services/receptionService";
import { PRIORITY_LABEL, dmy, hhmm, slotText, useSubmit } from "./receptionUtils";
import { cx } from "@/utils/cx";
import { PATIENT_RECORD_TEXT } from "@/utils/messages";
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

// Pick a new day and free slot of the same doctor; services stay the same (backend rule)
export const RescheduleDialog = ({ appointment, onClose, onSubmit }) => {
    const [date, setDate] = useState(appointment.appointmentDate >= clinicToday() ? appointment.appointmentDate : clinicToday());
    const [slots, setSlots] = useState({ loading: true, items: [] });
    const [slotStart, setSlotStart] = useState("");
    const [busy, submit] = useSubmit(onSubmit);

    useEffect(() => {
        let active = true;
        getAvailableSlots({
            date,
            doctorId: appointment.doctorId,
            serviceIds: (appointment.services ?? []).map((s) => s.serviceId),
            variantIds: (appointment.services ?? []).flatMap((s) => (s.variantId ? [s.variantId] : [])),
        }).then((result) => active && setSlots({ loading: false, items: result.success ? result.data : [] }));
        return () => {
            active = false;
        };
    }, [date, appointment]);

    return (
        <Modal
            title={`Đổi lịch của ${appointment.patientName}`}
            description={`Đang hẹn ${slotText(appointment)} ngày ${dmy(appointment.appointmentDate)} với ${appointment.doctorName ?? "bác sĩ"}.`}
            onClose={onClose}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    submit({ date, slotStart, doctorId: appointment.doctorId });
                }}
                className="space-y-4"
            >
                <div className="field">
                    <label className="label label-required" htmlFor="rs-date">
                        Ngày mới
                    </label>
                    <input
                        id="rs-date"
                        type="date"
                        className="input"
                        min={clinicToday()}
                        value={date}
                        onChange={(e) => {
                            setDate(e.target.value);
                            setSlotStart("");
                            setSlots({ loading: true, items: [] });
                        }}
                    />
                </div>
                <fieldset className="field">
                    <legend className="label label-required">Giờ còn trống</legend>
                    {slots.loading ? (
                        <p className="text-body-sm text-muted">Đang tìm giờ trống…</p>
                    ) : slots.items.length === 0 ? (
                        <p className="text-body-sm text-muted">Bác sĩ không còn giờ trống ngày này. Chọn ngày khác.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {slots.items.map((s) => (
                                <button
                                    key={s.slotStart}
                                    type="button"
                                    aria-pressed={slotStart === s.slotStart}
                                    onClick={() => setSlotStart(s.slotStart)}
                                    className={cx(
                                        "num rounded-full border px-3 py-1 text-body-sm",
                                        slotStart === s.slotStart ? "border-primary bg-primary-soft text-primary" : "border-border-strong text-body",
                                    )}
                                >
                                    {hhmm(s.slotStart)}
                                </button>
                            ))}
                        </div>
                    )}
                </fieldset>
                <p className="text-caption text-muted">Lễ tân đổi lịch thì lịch được xác nhận luôn và bệnh nhân nhận tin báo giờ mới.</p>
                <DialogActions onClose={onClose} submitLabel="Đổi lịch" busy={busy} disabled={!slotStart} />
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

export const WalkInDialog = ({ doctors, onClose, onSubmit, patient, doctorsStatus, onRetryDoctors }) => {
    const [phone, setPhone] = useState("");
    const [fullName, setFullName] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [gender, setGender] = useState("");
    const [doctorId, setDoctorId] = useState(patient ? "" : (doctors[0]?.id ?? ""));
    const [priority, setPriorityValue] = useState(PRIORITY.NORMAL);
    const [reason, setReason] = useState("");
    const [found, setFound] = useState(null);
    const [busy, submit] = useSubmit(onSubmit);
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

    // Look the phone number up so an existing patient is not created twice
    const lookUp = async () => {
        const digits = phone.replace(/\s/g, "");
        if (digits.length < 10) return;
        const result = await findPatientsByKeyword(digits);
        const patient = result.success ? result.data?.items?.[0] : null;
        setFound(patient ?? false);
        if (patient) {
            setFullName(patient.fullName);
            setDateOfBirth(patient.dateOfBirth ?? "");
            setGender(patient.gender ?? "");
        }
    };

    const needsReason = priority > PRIORITY.NORMAL && !reason.trim();
    const chosenDoctor = patient && !doctors.some((d) => String(d.id) === String(doctorId)) ? "" : doctorId;
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

    if (patient) {
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
    }

    return (
        <Modal title="Tiếp nhận khách vãng lai" description="Khách đến không hẹn trước được check-in ngay và vào nhóm vãng lai của hàng chờ." onClose={onClose}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    submit({
                        fullName: fullName.trim(),
                        phoneNumber: phone.replace(/\s/g, ""),
                        dateOfBirth: dateOfBirth || null,
                        gender: gender || null,
                        doctorId: Number(doctorId),
                        serviceId: [],
                        variantId: [],
                        priority,
                        reason: reason.trim() || null,
                    });
                }}
                className="space-y-4"
            >
                <div className="field">
                    <label className="label label-required" htmlFor="wi-phone">
                        Số điện thoại
                    </label>
                    <input
                        id="wi-phone"
                        className="input"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => {
                            setPhone(e.target.value);
                            setFound(null);
                        }}
                        onBlur={lookUp}
                    />
                    {found ? (
                        <p className="help-text text-success">
                            Đã có hồ sơ: {found.fullName} · {found.patientCode}
                        </p>
                    ) : found === false ? (
                        <p className="help-text">Chưa có hồ sơ với số này, hệ thống sẽ tạo hồ sơ mới.</p>
                    ) : (
                        <p className="help-text">Nhập số rồi rời ô để tìm hồ sơ có sẵn.</p>
                    )}
                </div>
                <div className="field">
                    <label className="label label-required" htmlFor="wi-name">
                        Họ tên
                    </label>
                    <input id="wi-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="field">
                        <label className="label" htmlFor="wi-dob">
                            Ngày sinh
                        </label>
                        <input
                            id="wi-dob"
                            className="input"
                            type="date"
                            value={dateOfBirth}
                            max={clinicToday()}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                        />
                    </div>
                    <div className="field">
                        <label className="label" htmlFor="wi-gender">
                            Giới tính
                        </label>
                        <select id="wi-gender" className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                            <option value="">Không ghi</option>
                            <option value="Male">Nam</option>
                            <option value="Female">Nữ</option>
                        </select>
                    </div>
                </div>
                <div className="field">
                    <label className="label label-required" htmlFor="wi-doctor">
                        Bác sĩ khám
                    </label>
                    <select id="wi-doctor" className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                        {doctors.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                                {d.room ? ` · ${d.room}` : ""}
                            </option>
                        ))}
                    </select>
                    <p className="help-text">Bác sĩ phải đang trong ca hôm nay; nếu không, hệ thống sẽ báo lỗi.</p>
                </div>
                <PriorityFields priority={priority} setPriority={setPriorityValue} reason={reason} setReason={setReason} idPrefix="wi" />
                <DialogActions
                    onClose={onClose}
                    submitLabel="Tiếp nhận và check-in"
                    busy={busy}
                    disabled={!phone.trim() || !fullName.trim() || !doctorId || needsReason}
                />
            </form>
        </Modal>
    );
};

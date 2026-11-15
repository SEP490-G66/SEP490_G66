import { Link } from "react-router-dom";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";
import { BLOOD_TYPES, GENDER_OPTIONS } from "@/utils/patientRecord";
import { BLOOD_UNKNOWN, FORM_LIMITS, needsPhoneFix, showBloodType } from "@/utils/patientRecordForm";
import { getReceptionPatientRoute } from "@/utils/routes";
import { cx } from "@/utils/cx";

const F = TEXT.FIELDS;

const ids = (field) => ({ id: `pf-${field}`, errorId: `pf-${field}-error`, noteId: `pf-${field}-note` });

const describedBy = (field, error, note) => [error ? ids(field).errorId : null, note ? ids(field).noteId : null].filter(Boolean).join(" ") || undefined;

const FieldError = ({ field, error }) =>
    error ? (
        <p id={ids(field).errorId} className="error-text">
            {error}
        </p>
    ) : null;

const LOCK_TEXT = {
    account: () => TEXT.PHONE_ACCOUNT_LOCK,
    unknown: () => TEXT.PHONE_DUP_UNKNOWN_LOCK,
    checking: () => TEXT.PHONE_DUP_CHECKING,
    duplicate: (lock) => TEXT.PHONE_DUP_LOCK(lock.match.patientCode),
};

const PatientAdminFields = ({ values, errors, onChange, onBlur, mode, patient, today, lock, dup, onRetryDup, linkState, forceBloodType }) => {
    const editing = mode === "edit";
    const account = Boolean(patient?.userId);
    const disabled = Boolean(lock);
    const input = (field, extra = {}) => ({
        id: ids(field).id,
        value: values[field],
        disabled,
        "aria-invalid": errors[field] ? "true" : undefined,
        onChange: (event) => onChange(field, event.target.value),
        onBlur: () => onBlur(field),
        ...extra,
    });

    const phoneNote = lock
        ? LOCK_TEXT[lock.reason](lock)
        : account
          ? patient.phoneNumber
              ? TEXT.ACCOUNT_HELP
              : TEXT.ACCOUNT_NO_PHONE
          : editing && needsPhoneFix(patient)
            ? TEXT.PHONE_FIX
            : null;
    const dobNote = editing && patient?.dateOfBirth && String(patient.dateOfBirth).slice(0, 10) > today ? TEXT.DOB_FUTURE_NOTE : null;
    const emailNote = account ? TEXT.ACCOUNT_HELP : null;
    const bloodNote = showBloodType(patient) ? TEXT.BLOOD_INVALID_NOTE(String(patient.bloodType).trim()) : null;

    return (
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="field">
                <label className="label label-required" htmlFor={ids("fullName").id}>
                    {F.FULL_NAME}
                </label>
                <input className="input" maxLength={FORM_LIMITS.fullName} autoComplete="off" aria-describedby={describedBy("fullName", errors.fullName)} {...input("fullName")} />
                <FieldError field="fullName" error={errors.fullName} />
            </div>
            <div className="field">
                <label className={cx("label", (!editing || patient?.dateOfBirth) && "label-required")} htmlFor={ids("dateOfBirth").id}>
                    {F.DOB}
                </label>
                <input type="date" className="input" max={today} aria-describedby={describedBy("dateOfBirth", errors.dateOfBirth, dobNote)} {...input("dateOfBirth")} />
                {dobNote && (
                    <p id={ids("dateOfBirth").noteId} className="help-text">
                        {dobNote}
                    </p>
                )}
                <FieldError field="dateOfBirth" error={errors.dateOfBirth} />
            </div>
            <fieldset className="field" aria-describedby={describedBy("gender", errors.gender)}>
                <legend className={cx("label", (!editing || patient?.gender) && "label-required")}>{F.GENDER}</legend>
                <div className="flex h-10 w-full items-center gap-1 rounded-lg bg-surface-muted p-1">
                    {GENDER_OPTIONS.map((code, index) => (
                        <label
                            key={code}
                            className={cx(
                                "flex h-full cursor-pointer items-center rounded-md px-3 text-body-sm has-[:focus-visible]:shadow-focus",
                                values.gender === code ? "bg-canvas font-semibold text-ink shadow-sm" : "font-medium text-muted hover:text-ink",
                                disabled && "cursor-not-allowed opacity-60",
                            )}
                        >
                            <input
                                id={index === 0 ? ids("gender").id : undefined}
                                type="radio"
                                name="pf-gender"
                                className="sr-only"
                                checked={values.gender === code}
                                disabled={disabled}
                                aria-invalid={errors.gender ? "true" : undefined}
                                onChange={() => onChange("gender", code)}
                                onBlur={() => onBlur("gender")}
                            />
                            {TEXT.GENDER_LABELS[code]}
                        </label>
                    ))}
                </div>
                <FieldError field="gender" error={errors.gender} />
            </fieldset>
            <div className="field">
                <label className={cx("label", (!editing || patient?.phoneNumber) && !account && "label-required")} htmlFor={ids("phoneNumber").id}>
                    {F.PHONE}
                </label>
                <input
                    type="tel"
                    inputMode="tel"
                    className={cx("input", account && "input-readonly")}
                    readOnly={account}
                    aria-describedby={describedBy("phoneNumber", errors.phoneNumber, phoneNote)}
                    {...input("phoneNumber")}
                />
                {phoneNote && (
                    <p id={ids("phoneNumber").noteId} className="help-text">
                        {phoneNote}
                        {lock?.reason === "duplicate" && (
                            <>
                                {" "}
                                <Link to={getReceptionPatientRoute(lock.match.id)} state={linkState} className="font-semibold text-primary hover:underline">
                                    {TEXT.OPEN_RECORD_CODE(lock.match.patientCode)}
                                </Link>
                            </>
                        )}
                    </p>
                )}
                <FieldError field="phoneNumber" error={errors.phoneNumber} />
                {!lock && dup?.match && (
                    <div role="alert" className="alert alert-warning mt-2 flex-wrap">
                        <span className="flex-1">{TEXT.DUP_PHONE(dup.match.fullName, dup.match.patientCode)}</span>
                        <Link to={getReceptionPatientRoute(dup.match.id)} state={linkState} className="font-semibold text-primary hover:underline">
                            {TEXT.DUP_OPEN}
                        </Link>
                    </div>
                )}
                {!lock && dup?.status === "error" && (
                    <p className="help-text mt-1 flex flex-wrap items-center gap-2">
                        <span>{TEXT.DUP_CHECK_ERROR}</span>
                        <button type="button" className="btn btn-link h-auto p-0 text-caption" onClick={onRetryDup}>
                            {TEXT.RETRY}
                        </button>
                    </p>
                )}
            </div>
            <div className="field">
                <label className="label" htmlFor={ids("emergencyContactPhone").id}>
                    {F.EMERGENCY_PHONE}
                </label>
                <input
                    type="tel"
                    inputMode="tel"
                    className="input"
                    maxLength={FORM_LIMITS.emergencyContactPhone}
                    aria-describedby={describedBy("emergencyContactPhone", errors.emergencyContactPhone)}
                    {...input("emergencyContactPhone")}
                />
                <FieldError field="emergencyContactPhone" error={errors.emergencyContactPhone} />
            </div>
            <div className="field">
                <label className="label" htmlFor={ids("email").id}>
                    {F.EMAIL}
                </label>
                <input
                    type="email"
                    className={cx("input", account && "input-readonly")}
                    readOnly={account}
                    maxLength={FORM_LIMITS.email}
                    aria-describedby={describedBy("email", errors.email, emailNote)}
                    {...input("email")}
                />
                {emailNote && (
                    <p id={ids("email").noteId} className="help-text">
                        {emailNote}
                    </p>
                )}
                <FieldError field="email" error={errors.email} />
            </div>
            <div className="field sm:col-span-2 lg:col-span-3">
                <label className="label" htmlFor={ids("address").id}>
                    {F.ADDRESS}
                </label>
                <input className="input" maxLength={FORM_LIMITS.address} aria-describedby={describedBy("address", errors.address)} {...input("address")} />
                <FieldError field="address" error={errors.address} />
            </div>
            {editing && (showBloodType(patient) || forceBloodType) && (
                <div className="field">
                    <label className="label label-required" htmlFor={ids("bloodType").id}>
                        {F.BLOOD_TYPE}
                    </label>
                    <select className="input" aria-describedby={describedBy("bloodType", errors.bloodType, bloodNote)} {...input("bloodType")}>
                        <option value="">{TEXT.BLOOD_PLACEHOLDER}</option>
                        {BLOOD_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {type.replace("-", "−")}
                            </option>
                        ))}
                        <option value={BLOOD_UNKNOWN}>{TEXT.BLOOD_UNKNOWN}</option>
                    </select>
                    {bloodNote && (
                        <p id={ids("bloodType").noteId} className="help-text">
                            {bloodNote}
                        </p>
                    )}
                    <FieldError field="bloodType" error={errors.bloodType} />
                </div>
            )}
        </div>
    );
};

export default PatientAdminFields;

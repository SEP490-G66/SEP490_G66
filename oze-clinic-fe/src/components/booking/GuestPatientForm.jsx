import { Link } from "react-router-dom";
import { BOOKING_IDS } from "@/utils/booking";
import { GUEST_FIELD_IDS } from "@/utils/guestBooking";
import { BOOKING_NOTE_MAX_LENGTH, BOOKING_TEXT, GUEST_BOOKING_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import { cx } from "@/utils/cx";

const NOTE_COUNT_ID = "booking-note-count";
const errorId = (id) => `${id}-error`;

const Field = ({ id, label, required, optional, error, className, children }) => (
    <div className={cx("field", className)}>
        <label htmlFor={id} className={cx("label", required && "label-required")}>
            {label} {optional && <span className="text-body-sm font-normal text-muted">{TEXT.OPTIONAL}</span>}
        </label>
        {children}
        {error && (
            <p id={errorId(id)} className="error-text">
                {error}
            </p>
        )}
    </div>
);

const inputProps = (id, error) => ({
    id,
    className: "input",
    "aria-invalid": Boolean(error) || undefined,
    "aria-describedby": error ? errorId(id) : undefined,
});

const GuestPatientForm = ({ values, errors, onChange, note, onNoteChange, today }) => {
    const set = (key) => (event) => onChange(key, event.target.value);

    return (
        <div className="flex flex-col gap-5">
            <p className="text-body-md text-body">
                {TEXT.HAS_ACCOUNT}{" "}
                <Link to={ROUTES.SIGN_IN} state={{ from: ROUTES.BOOK_APPOINTMENT }} className="font-semibold text-primary hover:underline">
                    {TEXT.SIGN_IN}
                </Link>{" "}
                {TEXT.HAS_ACCOUNT_END}
            </p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field id={GUEST_FIELD_IDS.FULL_NAME} label={TEXT.FULL_NAME} required error={errors.fullName}>
                    <input
                        {...inputProps(GUEST_FIELD_IDS.FULL_NAME, errors.fullName)}
                        autoComplete="name"
                        maxLength={100}
                        placeholder={TEXT.FULL_NAME_PLACEHOLDER}
                        value={values.fullName}
                        onChange={set("fullName")}
                    />
                </Field>
                <fieldset className="field" aria-describedby={errors.gender ? errorId(GUEST_FIELD_IDS.GENDER) : undefined}>
                    <legend className="label label-required">{TEXT.GENDER}</legend>
                    <div className="flex min-h-control items-center gap-6">
                        {[
                            ["Male", TEXT.MALE, GUEST_FIELD_IDS.GENDER],
                            ["Female", TEXT.FEMALE, "guest-gender-female"],
                        ].map(([value, label, id]) => (
                            <label key={value} htmlFor={id} className="flex items-center gap-2 text-body-md text-ink">
                                <input
                                    id={id}
                                    type="radio"
                                    name="guest-gender"
                                    value={value}
                                    checked={values.gender === value}
                                    aria-invalid={Boolean(errors.gender) || undefined}
                                    onChange={set("gender")}
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                    {errors.gender && (
                        <p id={errorId(GUEST_FIELD_IDS.GENDER)} className="error-text">
                            {errors.gender}
                        </p>
                    )}
                </fieldset>
                <Field id={GUEST_FIELD_IDS.BIRTHDATE} label={TEXT.BIRTHDATE} required error={errors.birthdate}>
                    <input {...inputProps(GUEST_FIELD_IDS.BIRTHDATE, errors.birthdate)} type="date" max={today} value={values.birthdate} onChange={set("birthdate")} />
                </Field>
                <Field id={GUEST_FIELD_IDS.PHONE} label={TEXT.PHONE} required error={errors.phone}>
                    <input
                        {...inputProps(GUEST_FIELD_IDS.PHONE, errors.phone)}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder={TEXT.PHONE_PLACEHOLDER}
                        value={values.phone}
                        onChange={set("phone")}
                    />
                </Field>
                <Field id={GUEST_FIELD_IDS.ADDRESS} label={TEXT.ADDRESS} optional className="md:col-span-2">
                    <input
                        {...inputProps(GUEST_FIELD_IDS.ADDRESS)}
                        autoComplete="street-address"
                        maxLength={255}
                        placeholder={TEXT.ADDRESS_PLACEHOLDER}
                        value={values.address}
                        onChange={set("address")}
                    />
                </Field>
                <Field id={GUEST_FIELD_IDS.EMAIL} label={TEXT.EMAIL} optional error={errors.email} className="md:col-span-2">
                    <input
                        {...inputProps(GUEST_FIELD_IDS.EMAIL, errors.email)}
                        type="email"
                        autoComplete="email"
                        placeholder={TEXT.EMAIL_PLACEHOLDER}
                        value={values.email}
                        onChange={set("email")}
                    />
                </Field>
                <Field id={BOOKING_IDS.NOTE} label={BOOKING_TEXT.NOTE} optional className="md:col-span-2">
                    <textarea
                        id={BOOKING_IDS.NOTE}
                        className="input placeholder:text-muted"
                        value={note}
                        maxLength={BOOKING_NOTE_MAX_LENGTH}
                        placeholder={BOOKING_TEXT.NOTE_PLACEHOLDER}
                        aria-describedby={NOTE_COUNT_ID}
                        onChange={(event) => onNoteChange(event.target.value)}
                    />
                    <p id={NOTE_COUNT_ID} className="text-right text-caption text-muted">
                        {note.length}/{BOOKING_NOTE_MAX_LENGTH}
                    </p>
                </Field>
            </div>
        </div>
    );
};

export default GuestPatientForm;

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import BookingSchedule from "@/components/booking/BookingSchedule";
import { GuestPatientFields } from "@/components/booking/GuestPatientForm";
import useBookingForm from "@/hooks/useBookingForm";
import { RECEPTION_BOOKING_API } from "@/services/bookingService";
import { findPatientsByPhone } from "@/services/receptionService";
import { BOOKING_IDS, avatarLetter } from "@/utils/booking";
import { formatDate, getClinicToday } from "@/utils/format";
import { EMPTY_GUEST, firstGuestError, guestPayload, validateGuest } from "@/utils/guestBooking";
import { BOOKING_NOTE_MAX_LENGTH, BOOKING_TEXT, RECEPTION_BOOKING_TEXT as TEXT } from "@/utils/messages";
import { isValidPhone, phoneDisplay, subscriberDigits } from "@/utils/patientRecord";

// "Đặt lịch hộ" (F-APT-09): the receptionist books for a patient on the phone or at the counter.
// The same service / doctor / day / slot picker as the booking page; the booking is CONFIRMED at once.
//
// patient: an existing record to book for (the patient's own page)
// initial: { phoneNumber, fullName } to start the lookup from (a consultation request),
//          { date, slotStart, doctorId } from a free cell of the week grid. Without a slot the form opens on the earliest free slot.
// onBooked: gets the appointment as the API returns it

const PHONE_ID = "reception-booking-phone";
const NOTE_COUNT_ID = "reception-booking-note-count";
const GENDER_LABEL = { Male: BOOKING_TEXT.GENDER.male, Female: BOOKING_TEXT.GENDER.female };

// Smaller than the booking page's headings: the dialog title sits above them
const SectionHeading = ({ number, title }) => (
    <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-caption font-semibold text-primary" aria-hidden="true">
            {number}
        </span>
        <h3 className="font-heading text-heading-3 text-ink">{title}</h3>
    </div>
);

const ReceptionPatientCard = ({ patient }) => (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-tint p-4">
        <span className="avatar avatar-lg avatar-soft" aria-hidden="true">
            {avatarLetter(patient.fullName)}
        </span>
        <div className="min-w-50 flex-1">
            <p className="font-heading text-heading-3 text-ink">{patient.fullName}</p>
            <p className="text-body-sm text-body">
                {[patient.patientCode && `${TEXT.CODE} ${patient.patientCode}`, GENDER_LABEL[patient.gender], formatDate(patient.dateOfBirth), phoneDisplay(patient.phoneNumber)]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
        </div>
    </div>
);

// Only records whose phone really is this number: the API also matches names, codes and emails
const samePhone = (patient, subscriber) => subscriberDigits(patient.phoneNumber) === subscriber;

const BookingDialog = ({ patient: givenPatient = null, initial = {}, onClose, onBooked, onPatientGone }) => {
    const [phone, setPhone] = useState(initial.phoneNumber ? phoneDisplay(initial.phoneNumber) : "");
    // idle | searching | found | new | many | error. A consultation request comes with a phone: it is looked up at once
    const [lookup, setLookup] = useState(() => {
        if (givenPatient) return { status: "found", patient: givenPatient, subscriber: null };
        const start = isValidPhone(initial.phoneNumber ?? "") ? subscriberDigits(initial.phoneNumber) : null;
        return { status: start ? "searching" : "idle", patient: null, subscriber: start };
    });
    const [phoneError, setPhoneError] = useState(null);
    const [values, setValues] = useState({ ...EMPTY_GUEST, fullName: initial.fullName ?? "" });
    const [errors, setErrors] = useState({});
    const [checked, setChecked] = useState(false);
    const latest = useRef(null);

    const preset = initial.date && initial.slotStart ? { day: initial.date, slot: initial.slotStart, doctorId: initial.doctorId ?? null } : null;

    const subscriber = subscriberDigits(phone);
    const searchedPhone = subscriber ? `0${subscriber}` : "";

    const runLookup = async () => {
        if (givenPatient) return;
        if (!isValidPhone(phone)) {
            setLookup({ status: "idle", patient: null, subscriber: null });
            setPhoneError(phone.trim() ? TEXT.ERROR_PHONE : null);
            return;
        }
        if (lookup.subscriber === subscriber && lookup.status !== "error") return;
        setPhoneError(null);
        setLookup({ status: "searching", patient: null, subscriber });
        search(subscriber);
    };

    const search = async (target) => {
        latest.current = target;
        const result = await findPatientsByPhone(target, { skipErrorPage: true });
        // The number was changed while this search ran
        if (latest.current !== target) return;
        if (!result.success) {
            setLookup({ status: "error", patient: null, subscriber: target });
            return;
        }
        const items = Array.isArray(result.data) ? result.data : (result.data?.items ?? []);
        const matches = items.filter((p) => samePhone(p, target));
        if (matches.length === 1) setLookup({ status: "found", patient: matches[0], subscriber: target });
        else setLookup({ status: matches.length ? "many" : "new", patient: null, subscriber: target });
    };

    useEffect(() => {
        if (lookup.status === "searching") search(lookup.subscriber);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const changePhone = (value) => {
        setPhone(value);
        setPhoneError(null);
        latest.current = null;
        if (lookup.status !== "idle") setLookup({ status: "idle", patient: null, subscriber: null });
    };

    const guestValues = { ...values, phone: searchedPhone };

    const form = useBookingForm({
        api: RECEPTION_BOOKING_API,
        initial: preset,
        embedded: { onBooked, onPatientGone },
        guest: {
            validate: () => {
                if (lookup.status === "found") return null;
                if (lookup.status !== "new") {
                    if (lookup.status === "idle") setPhoneError(isValidPhone(phone) ? TEXT.PHONE_HELP : TEXT.PHONE_REQUIRED);
                    return PHONE_ID;
                }
                const found = validateGuest(guestValues, getClinicToday());
                setErrors(found);
                setChecked(true);
                if (found.phone) {
                    setPhoneError(found.phone);
                    return PHONE_ID;
                }
                return firstGuestError(found);
            },
            payload: () => (lookup.status === "found" ? { PatientId: lookup.patient.id } : guestPayload(guestValues)),
        },
    });
    const { state, actions } = form;

    const changeValue = (key, value) => {
        const next = { ...values, [key]: value };
        setValues(next);
        if (checked) setErrors(validateGuest({ ...next, phone: searchedPhone }, getClinicToday()));
    };

    const lookupLine = () => {
        switch (lookup.status) {
            case "searching":
                return <p className="help-text">{TEXT.SEARCHING}</p>;
            case "new":
                return <p className="help-text">{TEXT.NEW_PATIENT}</p>;
            case "many":
                return (
                    <p role="alert" className="error-text">
                        {TEXT.MANY_RECORDS}
                    </p>
                );
            case "error":
                return (
                    <p role="alert" className="error-text">
                        {TEXT.LOOKUP_ERROR}{" "}
                        <button type="button" className="font-semibold text-primary underline" onClick={runLookup}>
                            {TEXT.RETRY}
                        </button>
                    </p>
                );
            case "idle":
                return phoneError ? (
                    <p id={`${PHONE_ID}-error`} className="error-text">
                        {phoneError}
                    </p>
                ) : (
                    <p className="help-text">{TEXT.PHONE_HELP}</p>
                );
            default:
                return null;
        }
    };

    return (
        <Modal title={TEXT.TITLE} size="xl" onClose={onClose}>
            <div className="space-y-7">
                <section>
                    <SectionHeading number={1} title={BOOKING_TEXT.PATIENT_SECTION} />
                    <div className="flex flex-col gap-5">
                        {!givenPatient && (
                            <div className="field md:max-w-[calc(50%-0.625rem)]">
                                <label htmlFor={PHONE_ID} className="label label-required">
                                    {TEXT.PHONE}
                                </label>
                                <input
                                    id={PHONE_ID}
                                    className="input"
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="off"
                                    placeholder="0912 345 678"
                                    value={phone}
                                    aria-invalid={Boolean(phoneError) || undefined}
                                    aria-describedby={phoneError ? `${PHONE_ID}-error` : undefined}
                                    onChange={(e) => changePhone(e.target.value)}
                                    onBlur={runLookup}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            runLookup();
                                        }
                                    }}
                                />
                                {lookupLine()}
                            </div>
                        )}
                        {lookup.status === "found" && <ReceptionPatientCard patient={lookup.patient} />}
                        {lookup.status === "new" && (
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <GuestPatientFields values={values} errors={errors} onChange={changeValue} today={getClinicToday()} showPhone={false} />
                            </div>
                        )}
                        <div className="field">
                            <label htmlFor={BOOKING_IDS.NOTE} className="label">
                                {BOOKING_TEXT.NOTE} <span className="text-body-sm font-normal text-muted">{BOOKING_TEXT.OPTIONAL}</span>
                            </label>
                            <textarea
                                id={BOOKING_IDS.NOTE}
                                className="input placeholder:text-muted"
                                rows={2}
                                value={state.note}
                                maxLength={BOOKING_NOTE_MAX_LENGTH}
                                placeholder={BOOKING_TEXT.NOTE_PLACEHOLDER}
                                aria-describedby={NOTE_COUNT_ID}
                                onChange={(e) => actions.changeNote(e.target.value)}
                            />
                            <p id={NOTE_COUNT_ID} className="text-right text-caption text-muted">
                                {state.note.length}/{BOOKING_NOTE_MAX_LENGTH}
                            </p>
                        </div>
                    </div>
                </section>
                <hr className="border-border" />
                <section>
                    <SectionHeading number={2} title={BOOKING_TEXT.SCHEDULE_SECTION} />
                    <BookingSchedule form={form} staff onCancel={onClose} />
                </section>
            </div>
            <p className="sr-only" aria-live="polite">
                {state.live.text}
                {state.live.seq % 2 ? "​" : ""}
            </p>
        </Modal>
    );
};

export default BookingDialog;

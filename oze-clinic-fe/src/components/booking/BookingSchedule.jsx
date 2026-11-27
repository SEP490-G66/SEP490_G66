import { CalendarDays, CircleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import BookingDayStrip from "@/components/booking/BookingDayStrip";
import BookingServicePicker from "@/components/booking/BookingServicePicker";
import BookingSlotGrid from "@/components/booking/BookingSlotGrid";
import BookingSummaryBar from "@/components/booking/BookingSummaryBar";
import BookingStateBox from "@/components/booking/BookingStateBox";
import BookingWeekPicker from "@/components/booking/BookingWeekPicker";
import EarliestSlotBar from "@/components/booking/EarliestSlotBar";
import StatusBadge from "@/components/ui/StatusBadge";
import { BOOKING_IDS, dayText } from "@/utils/booking";
import { formatTime } from "@/utils/format";
import { BOOKING_TEXT, CLINIC_HOTLINE, PATIENT_APPOINTMENT_STATUS, RECEPTION_BOOKING_TEXT } from "@/utils/messages";
import { ROUTES, getAppointmentDetailRoute } from "@/utils/routes";

const GROUP_LABEL = "mt-7 mb-2.5 block font-heading text-heading-3 text-ink";

export const Hotline = () => <a href={`tel:${CLINIC_HOTLINE.TEL}`}>{CLINIC_HOTLINE.DISPLAY}</a>;

export const BookingSectionHeading = ({ number, title }) => (
    <div className="mb-4 flex items-center gap-3">
        <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-title text-primary" aria-hidden="true">
            {number}
        </span>
        <h2 className="section-title">{title}</h2>
    </div>
);

export const LoadErrorBox = ({ headingLevel, onRetry, staff = false }) => (
    <BookingStateBox
        tone="warning"
        icon={CircleAlert}
        title={BOOKING_TEXT.LOAD_ERROR_TITLE}
        headingLevel={headingLevel}
        headingId={BOOKING_IDS.STATE_TITLE}
        action={
            <button type="button" className="btn btn-primary" onClick={onRetry}>
                {BOOKING_TEXT.RETRY}
            </button>
        }
    >
        {staff ? RECEPTION_BOOKING_TEXT.LOAD_ERROR_TEXT : (
            <>
                {BOOKING_TEXT.LOAD_ERROR_TEXT} <Hotline /> {BOOKING_TEXT.LOAD_ERROR_TEXT_END}
            </>
        )}
    </BookingStateBox>
);

const BlockedBox = ({ appointment }) => (
    <BookingStateBox
        tone="warning"
        icon={CalendarDays}
        title={BOOKING_TEXT.BLOCKED_TITLE}
        headingId={BOOKING_IDS.STATE_TITLE}
        action={
            <Link to={appointment?.id ? getAppointmentDetailRoute(appointment.id) : ROUTES.APPOINTMENTS} className="btn btn-primary">
                {BOOKING_TEXT.BLOCKED_ACTION}
            </Link>
        }
    >
        {appointment && (
            <p>
                {BOOKING_TEXT.BLOCKED_APPOINTMENT(dayText(appointment.date, true), formatTime(appointment.slotStart), appointment.code)} ·{" "}
                <StatusBadge status={appointment.status} labels={PATIENT_APPOINTMENT_STATUS} />
            </p>
        )}
        <p>{BOOKING_TEXT.BLOCKED_TEXT}</p>
    </BookingStateBox>
);

// doctorName: the doctor the visitor chose; the message then says it is that doctor who has no long enough gap
const NoSlotsBox = ({ showAllDoctors, onAllDoctors, staff, doctorName }) => (
    <BookingStateBox
        icon={CalendarDays}
        title={doctorName ? BOOKING_TEXT.NO_SLOTS_DOCTOR_TITLE(doctorName) : BOOKING_TEXT.NO_SLOTS_TITLE}
        headingId={BOOKING_IDS.STATE_TITLE}
        action={
            showAllDoctors && (
                <button type="button" className="btn btn-secondary" onClick={onAllDoctors}>
                    {BOOKING_TEXT.ALL_DOCTORS}
                </button>
            )
        }
    >
        {doctorName && <p className="mb-2">{BOOKING_TEXT.NO_SLOTS_DOCTOR_TEXT}</p>}
        {staff ? RECEPTION_BOOKING_TEXT.NO_SLOTS_TEXT : (
            <p>
                {BOOKING_TEXT.NO_SLOTS_TEXT} <Hotline /> {BOOKING_TEXT.NO_SLOTS_TEXT_END}
            </p>
        )}
    </BookingStateBox>
);

export const BookingLoadingCard = ({ card = "card-app" }) => (
    <section className={card} aria-busy="true">
        <div className="skeleton h-11" />
        <div className="skeleton mt-3 h-22" />
        <div className="skeleton mt-3 h-30" />
    </section>
);

// locked: a treatment plan session is booked with the doctor chosen for it in the plan only
const DoctorSelect = ({ doctors, value, onChange, locked = false }) => (
    <>
        <label htmlFor={BOOKING_IDS.DOCTOR} className={GROUP_LABEL}>
            {BOOKING_TEXT.DOCTOR}
        </label>
        <select
            id={BOOKING_IDS.DOCTOR}
            className="input"
            value={value ?? ""}
            disabled={locked}
            aria-describedby={locked ? `${BOOKING_IDS.DOCTOR}-locked` : undefined}
            onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        >
            <option value="">{BOOKING_TEXT.ANY_DOCTOR}</option>
            {doctors.map((doctor) => (
                <option key={doctor.doctorId} value={doctor.doctorId}>
                    {doctor.doctorName}
                </option>
            ))}
        </select>
        {locked && (
            <p id={`${BOOKING_IDS.DOCTOR}-locked`} className="help-text">
                {BOOKING_TEXT.DOCTOR_LOCKED}
            </p>
        )}
    </>
);

// staff: the receptionist's dialog – no hotline lines, a Cancel button beside submit.
// doctorLocked: the doctor cannot be changed (a treatment plan session, booked with its chosen doctor)
const BookingSchedule = ({ form, staff = false, doctorLocked = false, onCancel }) => {
    const { state, actions, services, earliest, unfinished, blocked, bounds, rangeBusy, slotsBusy, busy, slotsKey } = form;
    const { context } = state;
    // The services cannot go in one appointment: a message under the picker, no days or slots to choose
    const servicesError = !rangeBusy && state.range.error ? state.range.servicesError : null;
    const rangeError = state.range.error && !rangeBusy && !servicesError;
    const firstLoadFailed = rangeError && !state.formShown;
    const noSlots = state.formShown && !earliest && !servicesError;
    const slotsReady = slotsKey && state.slots.key === slotsKey;
    const page = state.page;

    const weekPicker = (
        <BookingWeekPicker
            weekStart={state.weekStart}
            bounds={bounds}
            today={state.today}
            calendar={state.calendar}
            onToggle={actions.toggleCalendar}
            onMonth={actions.changeMonth}
            onWeek={actions.pickWeek}
            onClose={actions.closeCalendar}
            onPrev={actions.prevWeek}
            onThisWeek={actions.thisWeek}
            onNext={actions.nextWeek}
        />
    );

        if (page.status === "error" || firstLoadFailed) {
            return <LoadErrorBox headingLevel={3} staff={staff} onRetry={page.status === "error" ? actions.retryContext : actions.retryDays} />;
        }
        if (blocked) return <BlockedBox appointment={state.blockedLoading ? null : unfinished} />;
        if (!state.formShown) {
            return (
                <div aria-busy="true">
                    <div className="skeleton h-11" />
                    <div className="skeleton mt-3 h-22" />
                    <div className="skeleton mt-3 h-30" />
                </div>
            );
        }
        const doctorSelect = <DoctorSelect doctors={context.doctors} value={state.doctorId} onChange={actions.changeDoctor} locked={doctorLocked} />;
        const locked = state.submitting || busy;
        return (
            <>
                {/* Always shown: when no slot fits the chosen services, removing one is the way out */}
                <BookingServicePicker
                    services={services}
                    items={state.items}
                    pickService={state.pickService}
                    pickVariant={state.pickVariant}
                    error={state.serviceError}
                    goneMessages={state.goneMessages}
                    onPickService={actions.pickService}
                    onPickVariant={actions.pickVariant}
                    onAdd={actions.addService}
                    onRemove={actions.removeService}
                />
                {servicesError && (
                    <p role="alert" className="alert alert-warning mt-3 block">
                        {servicesError}
                    </p>
                )}
                {doctorSelect}
                {/* With no slot in the whole range, moving between weeks shows nothing, so only the message stays */}
                {(!noSlots || rangeError) && weekPicker}
                {noSlots && !rangeError && (
                    <NoSlotsBox
                        staff={staff}
                        showAllDoctors={Boolean(state.doctorId) && !doctorLocked}
                        onAllDoctors={actions.allDoctors}
                        doctorName={context.doctors.find((doctor) => doctor.doctorId === state.doctorId)?.doctorName}
                    />
                )}
                {(!noSlots || rangeError) && !servicesError && (
                    <BookingDayStrip
                        weekStart={state.weekStart}
                        today={state.today}
                        days={state.range.days}
                        busy={rangeBusy}
                        error={rangeError}
                        selected={state.day}
                        info={state.dayInfo}
                        onSelect={actions.selectDay}
                        onRetry={actions.retryDays}
                    />
                )}
                {!noSlots && !servicesError && (
                    <>
                        <EarliestSlotBar
                            earliest={earliest}
                            selected={Boolean(earliest) && state.day === earliest.date && state.slot === earliest.slotStart}
                            updatedAt={state.updatedAt}
                            busy={busy}
                            pickBusy={rangeBusy}
                            onPick={actions.pickEarliest}
                            onRefresh={actions.refresh}
                        />
                        <BookingSlotGrid
                            slots={slotsReady ? state.slots.data : null}
                            busy={slotsBusy}
                            error={Boolean(slotsReady && state.slots.error)}
                            selected={state.slot}
                            warning={state.slotWarning}
                            warningLive={state.slotWarningLive}
                            slotError={state.slotError}
                            onSelect={actions.selectSlot}
                            onRetry={actions.retrySlots}
                        />
                        <div id="booking-submit-error" role="alert">
                            {state.submitError && (
                                <p className="alert alert-danger mt-3 block">
                                    {state.submitError}
                                    {!staff && (
                                        <>
                                            {" "}
                                            <Hotline />.
                                        </>
                                    )}
                                </p>
                            )}
                        </div>
                        {staff ? (
                            <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-border pt-5">
                                <button type="button" className="btn btn-secondary max-sm:flex-1" onClick={onCancel}>
                                    {RECEPTION_BOOKING_TEXT.CANCEL}
                                </button>
                                <button
                                    type="button"
                                    id={BOOKING_IDS.SUBMIT}
                                    className="btn btn-primary min-w-32 max-sm:flex-1"
                                    aria-disabled={locked || undefined}
                                    aria-describedby="booking-submit-error"
                                    onClick={actions.submit}
                                >
                                    {state.submitting ? BOOKING_TEXT.SUBMITTING : RECEPTION_BOOKING_TEXT.SUBMIT}
                                </button>
                            </div>
                        ) : (
                            <BookingSummaryBar
                                locked={locked}
                                submitting={state.submitting}
                                describedBy="booking-submit-error"
                                onSubmit={actions.submit}
                            />
                        )}
                    </>
                )}
            </>
        );
};

export default BookingSchedule;

import { CalendarDays, CircleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import BookingDayStrip from "@/components/booking/BookingDayStrip";
import BookingServicePicker from "@/components/booking/BookingServicePicker";
import BookingSlotGrid from "@/components/booking/BookingSlotGrid";
import BookingStateBox from "@/components/booking/BookingStateBox";
import BookingWeekPicker from "@/components/booking/BookingWeekPicker";
import EarliestSlotBar from "@/components/booking/EarliestSlotBar";
import StatusBadge from "@/components/ui/StatusBadge";
import { BOOKING_IDS, dayText } from "@/utils/booking";
import { formatTime } from "@/utils/format";
import { BOOKING_TEXT, CLINIC_HOTLINE, PATIENT_APPOINTMENT_STATUS } from "@/utils/messages";
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

export const LoadErrorBox = ({ headingLevel, onRetry }) => (
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
        {BOOKING_TEXT.LOAD_ERROR_TEXT} <Hotline /> {BOOKING_TEXT.LOAD_ERROR_TEXT_END}
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

const NoSlotsBox = ({ showAllDoctors, onAllDoctors }) => (
    <BookingStateBox
        icon={CalendarDays}
        title={BOOKING_TEXT.NO_SLOTS_TITLE}
        headingId={BOOKING_IDS.STATE_TITLE}
        action={
            showAllDoctors && (
                <button type="button" className="btn btn-secondary" onClick={onAllDoctors}>
                    {BOOKING_TEXT.ALL_DOCTORS}
                </button>
            )
        }
    >
        {BOOKING_TEXT.NO_SLOTS_TEXT} <Hotline /> {BOOKING_TEXT.NO_SLOTS_TEXT_END}
    </BookingStateBox>
);

export const BookingLoadingCard = ({ card = "card-app" }) => (
    <section className={card} aria-busy="true">
        <div className="skeleton h-11" />
        <div className="skeleton mt-3 h-22" />
        <div className="skeleton mt-3 h-30" />
    </section>
);

const DoctorSelect = ({ doctors, value, onChange }) => (
    <>
        <label htmlFor={BOOKING_IDS.DOCTOR} className={GROUP_LABEL}>
            {BOOKING_TEXT.DOCTOR}
        </label>
        <select id={BOOKING_IDS.DOCTOR} className="input" value={value ?? ""} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
            <option value="">{BOOKING_TEXT.ANY_DOCTOR}</option>
            {doctors.map((doctor) => (
                <option key={doctor.doctorId} value={doctor.doctorId}>
                    {doctor.doctorName}
                </option>
            ))}
        </select>
    </>
);

const BookingSchedule = ({ form }) => {
    const { state, actions, services, earliest, unfinished, blocked, bounds, rangeBusy, slotsBusy, busy, slotsKey } = form;
    const { context } = state;
    const rangeError = state.range.error && !rangeBusy;
    const firstLoadFailed = rangeError && !state.formShown;
    const noSlots = state.formShown && !earliest;
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
            return <LoadErrorBox headingLevel={3} onRetry={page.status === "error" ? actions.retryContext : actions.retryDays} />;
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
        const doctorSelect = <DoctorSelect doctors={context.doctors} value={state.doctorId} onChange={actions.changeDoctor} />;
        const locked = state.submitting || busy;
        return (
            <>
                {!noSlots && (
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
                )}
                {doctorSelect}
                {weekPicker}
                {noSlots && !rangeError && <NoSlotsBox showAllDoctors={Boolean(state.doctorId)} onAllDoctors={actions.allDoctors} />}
                {(!noSlots || rangeError) && (
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
                {!noSlots && (
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
                                    {state.submitError} <Hotline />.
                                </p>
                            )}
                        </div>
                        <div className="mt-7 flex justify-end border-t border-border pt-5">
                            <button
                                type="button"
                                id={BOOKING_IDS.SUBMIT}
                                className="btn btn-primary min-w-45 max-sm:w-full max-sm:min-w-0"
                                aria-disabled={locked || undefined}
                                aria-describedby="booking-submit-error"
                                onClick={actions.submit}
                            >
                                {state.submitting ? BOOKING_TEXT.SUBMITTING : BOOKING_TEXT.SUBMIT}
                            </button>
                        </div>
                    </>
                )}
            </>
        );
};

export default BookingSchedule;

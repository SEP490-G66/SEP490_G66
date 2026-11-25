import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import AppointmentSummary from "@/components/appointment/AppointmentSummary";
import BookingDayStrip from "@/components/booking/BookingDayStrip";
import BookingSlotGrid from "@/components/booking/BookingSlotGrid";
import BookingWeekPicker from "@/components/booking/BookingWeekPicker";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import useAsync from "@/hooks/useAsync";
import useRescheduleWeek from "@/hooks/useRescheduleWeek";
import { APPOINTMENT_ACTION_CODE, rescheduleMyAppointment } from "@/services/appointmentService";
import { getBookingDoctors } from "@/services/bookingService";
import { BOOKING_IDS, addDaysToDate } from "@/utils/booking";
import { formatDate, formatTime, getClinicToday } from "@/utils/format";
import { BOOKING_MAX_DAYS_AHEAD, CLINIC_HOTLINE, GENERIC_ERROR_MESSAGE, MESSAGES, VALIDATION_MESSAGES } from "@/utils/messages";
import { invalidMessage, requiredMessage } from "@/utils/validation";

const DOCTOR_ID = "reschedule-doctor";
const DATE_ERROR_ID = "reschedule-date-error";

const NOT_ALLOWED_MESSAGE = MESSAGES.MSG33.replace("[số điện thoại]", CLINIC_HOTLINE.DISPLAY);

// Preferred new date: the day after the current appointment, kept inside the bookable window.
const getPreferredDate = (appointment, today) => {
    const max = addDaysToDate(today, BOOKING_MAX_DAYS_AHEAD);
    const next = appointment.appointmentDate ? addDaysToDate(appointment.appointmentDate, 1) : today;
    if (next < today) return today;
    return next > max ? max : next;
};

const getSuccessMessage = (appointment) =>
    MESSAGES.MSG32.replace("[ngày]", formatDate(appointment.appointmentDate))
        .replace("[giờ]", formatTime(appointment.timeSlotStart))
        .replace("[bác sĩ]", appointment.doctorName);

const focusWeekButton = () => document.getElementById(BOOKING_IDS.WEEK_BUTTON)?.focus();

const focusFirstSlot = () => (document.getElementById(BOOKING_IDS.SLOTS)?.querySelector("input:not([disabled])") ?? document.getElementById(BOOKING_IDS.WEEK_BUTTON))?.focus();

const RescheduleAppointmentModal = ({ appointment, onClose, onRescheduled, onNotFound }) => {
    const focusSlotRef = useRef(false);
    const [today] = useState(getClinicToday);
    const [preferredDate] = useState(() => getPreferredDate(appointment, today));
    const [doctorId, setDoctorId] = useState("");
    const [slot, setSlot] = useState(null);
    const [dateError, setDateError] = useState(null);
    const [slotError, setSlotError] = useState(null);
    const [formAlert, setFormAlert] = useState(null);
    const [sending, setSending] = useState(false);

    const doctorsState = useAsync(() => getBookingDoctors(), []);
    const doctors = doctorsState.value?.success ? doctorsState.value.data : [];

    // The detail page polls and hands a new appointment object each time; keep the one the popup opened with
    // so the week data is not reloaded on every poll.
    const [target] = useState(appointment);
    const week = useRescheduleWeek(target, { today, preferredDate, doctorId });
    const { day } = week;
    // The picked slot only counts while its day is still shown and the slot is still free.
    const selected = slot && slot.date === day && week.slots?.some((item) => item.slotStart === slot.slotStart) ? slot : null;

    useEffect(() => {
        if (!focusSlotRef.current || week.slotsBusy) return;
        focusSlotRef.current = false;
        focusFirstSlot();
    });

    const close = () => onClose({ refetch: Boolean(formAlert?.refetch) });

    const changeDoctor = (event) => {
        setDoctorId(event.target.value);
        setSlotError(null);
    };

    const selectDay = (date) => {
        week.actions.selectDay(date);
        setDateError(null);
        setSlotError(null);
    };

    const chooseSlot = (slotStart) => {
        const item = week.slots?.find((entry) => entry.slotStart === slotStart);
        if (!item) return;
        setSlot({ date: day, slotStart: item.slotStart, slotEnd: item.slotEnd });
        setSlotError(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!day) {
            setDateError(requiredMessage("ngày khám mới"));
            focusWeekButton();
            return;
        }
        if (!selected) {
            setSlotError(VALIDATION_MESSAGES.SLOT_REQUIRED);
            focusFirstSlot();
            return;
        }
        setFormAlert(null);
        setDateError(null);
        setSlotError(null);
        setSending(true);
        const result = await rescheduleMyAppointment(appointment.id, { date: selected.date, slotStart: selected.slotStart, doctorId });
        if (result.success) {
            toast.success(getSuccessMessage(result.data.appointment));
            onRescheduled(result.data);
            return;
        }
        setSending(false);
        switch (result.code) {
            case APPOINTMENT_ACTION_CODE.NOT_FOUND:
                onNotFound();
                return;
            case APPOINTMENT_ACTION_CODE.SLOT_TAKEN:
                setSlot(null);
                setSlotError(MESSAGES.MSG34);
                focusSlotRef.current = true;
                week.actions.reloadSlots();
                return;
            case APPOINTMENT_ACTION_CODE.DATE_INVALID:
                setSlot(null);
                setDateError(invalidMessage("Ngày khám mới"));
                focusWeekButton();
                return;
            case APPOINTMENT_ACTION_CODE.NOT_ALLOWED:
                setFormAlert({ message: NOT_ALLOWED_MESSAGE, refetch: true });
                return;
            default:
                setFormAlert({ message: GENERIC_ERROR_MESSAGE, refetch: false });
        }
    };

    return (
        <Modal title="Đổi lịch hẹn" size="xl" onClose={close} closeDisabled={sending}>
            <form noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col">
                <AppointmentSummary appointment={appointment} next={selected && { appointmentDate: selected.date, timeSlotStart: selected.slotStart, timeSlotEnd: selected.slotEnd }} />
                {formAlert && (
                    <div role="alert" className="alert alert-danger mt-4">
                        {formAlert.message}
                    </div>
                )}
                <div className="mt-4 max-w-sm">
                    <FormField id={DOCTOR_ID} label="Bác sĩ">
                        <select id={DOCTOR_ID} name="doctorId" className="input" value={doctorId} disabled={sending} onChange={changeDoctor}>
                            <option value="">Phòng khám sắp xếp</option>
                            {doctors.map((doctor) => (
                                <option key={doctor.doctorId} value={String(doctor.doctorId)}>
                                    {doctor.doctorName}
                                </option>
                            ))}
                        </select>
                    </FormField>
                </div>
                <BookingWeekPicker
                    weekStart={week.weekStart}
                    bounds={week.bounds}
                    today={today}
                    calendar={week.calendar}
                    label="Ngày khám mới"
                    onToggle={week.actions.toggleCalendar}
                    onMonth={week.actions.changeMonth}
                    onWeek={week.actions.pickWeek}
                    onClose={week.actions.closeCalendar}
                    onPrev={week.actions.prevWeek}
                    onThisWeek={week.actions.thisWeek}
                    onNext={week.actions.nextWeek}
                />
                <BookingDayStrip
                    weekStart={week.weekStart}
                    today={today}
                    days={week.days}
                    busy={week.rangeBusy}
                    error={week.rangeError}
                    selected={day}
                    info={null}
                    onSelect={selectDay}
                    onRetry={week.actions.retryDays}
                />
                {dateError && (
                    <p id={DATE_ERROR_ID} role="alert" className="error-text mt-2">
                        {dateError}
                    </p>
                )}
                {day && (
                    <BookingSlotGrid
                        slots={week.slots}
                        busy={week.slotsBusy}
                        error={week.slotsError}
                        selected={selected?.slotStart ?? null}
                        warning={null}
                        warningLive={false}
                        slotError={slotError}
                        legend="Ca khám mới"
                        onSelect={chooseSlot}
                        onRetry={week.actions.reloadSlots}
                    />
                )}
                <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" disabled={sending} onClick={close}>
                        Hủy bỏ
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={sending}>
                        {sending && <span className="btn-spinner" aria-hidden="true" />}
                        {sending ? "Đang gửi..." : "Xác nhận đổi lịch"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default RescheduleAppointmentModal;

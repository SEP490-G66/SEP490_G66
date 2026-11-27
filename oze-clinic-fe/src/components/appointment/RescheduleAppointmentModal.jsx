import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { ArrowRight, CalendarClock, Stethoscope } from "lucide-react";
import BookingDayStrip from "@/components/booking/BookingDayStrip";
import { BookingSectionHeading } from "@/components/booking/BookingSchedule";
import BookingServicePicker from "@/components/booking/BookingServicePicker";
import BookingSlotGrid from "@/components/booking/BookingSlotGrid";
import BookingWeekPicker from "@/components/booking/BookingWeekPicker";
import Modal from "@/components/ui/Modal";
import useAsync from "@/hooks/useAsync";
import useRescheduleWeek from "@/hooks/useRescheduleWeek";
import { APPOINTMENT_ACTION_CODE, appointmentServiceParams, rescheduleMyAppointment } from "@/services/appointmentService";
import { getBookingDoctors, getBookingServices } from "@/services/bookingService";
import { BOOKING_IDS, addDaysToDate, addItem, findService, getPendingSelection, itemLabel, toServiceParams } from "@/utils/booking";
import { formatDate, formatTime, formatTimeRange, formatWeekday, getClinicToday } from "@/utils/format";
import { BOOKING_MAX_DAYS_AHEAD, BOOKING_TEXT, CLINIC_HOTLINE, GENERIC_ERROR_MESSAGE, MESSAGES, VALIDATION_MESSAGES } from "@/utils/messages";
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

const slotText = (date, start, end) => [formatTimeRange(start, end), [formatWeekday(date), formatDate(date)].filter(Boolean).join(" ")].filter(Boolean).join(", ");

// The lines of the appointment the patient can still pick: a variant that is no longer offered is dropped, unless its
// service now has no variants, then the service itself stays
const initialItems = (appointment, catalog) => {
    const items = [];
    appointment.services.forEach((line) => {
        const service = findService(catalog, line.serviceId);
        if (!service || items.some((item) => item.serviceId === service.id)) return;
        const variantAlive = line.variantId !== null && service.variants.some((variant) => variant.id === line.variantId);
        if (variantAlive) items.push({ serviceId: service.id, variantId: line.variantId });
        else if (!service.variants.length) items.push({ serviceId: service.id, variantId: null });
    });
    return items;
};

const focusWeekButton = () => document.getElementById(BOOKING_IDS.WEEK_BUTTON)?.focus();

const focusFirstSlot = () => (document.getElementById(BOOKING_IDS.SLOTS)?.querySelector("input:not([disabled])") ?? document.getElementById(BOOKING_IDS.WEEK_BUTTON))?.focus();

// Current appointment on the left, what it becomes on the right; the right side fills in as the patient picks
const CompareCard = ({ appointment, servicesText, servicesChanged, next }) => (
    <div className="grid gap-3 rounded-xl border border-border bg-surface-tint p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="min-w-0">
            <p className="text-label text-muted">Lịch hiện tại · {appointment.appointmentCode}</p>
            <p className="mt-1 text-title text-ink">{appointment.serviceName}</p>
            <p className="num mt-1 text-body-sm text-body">{slotText(appointment.appointmentDate, appointment.timeSlotStart, appointment.timeSlotEnd)}</p>
            {appointment.doctorName && <p className="text-body-sm text-muted">{appointment.doctorName}</p>}
        </div>
        <ArrowRight className="hidden size-5 text-muted sm:block" aria-hidden="true" />
        <div className="min-w-0 rounded-lg bg-canvas p-3">
            <p className="text-label text-primary">Lịch mới</p>
            <p className={servicesChanged ? "mt-1 text-title text-primary" : "mt-1 text-title text-ink"}>{servicesText}</p>
            <p className="num mt-1 text-body-sm text-body">{next ? slotText(next.date, next.slotStart, next.slotEnd) : "Chọn ngày và ca bên dưới"}</p>
        </div>
    </div>
);

const RescheduleAppointmentModal = ({ appointment, onClose, onRescheduled, onNotFound }) => {
    const focusSlotRef = useRef(false);
    const [today] = useState(getClinicToday);
    const [preferredDate] = useState(() => getPreferredDate(appointment, today));
    const [doctorId, setDoctorId] = useState("");
    const [slot, setSlot] = useState(null);
    const [dateError, setDateError] = useState(null);
    const [slotError, setSlotError] = useState(null);
    const [serviceError, setServiceError] = useState(null);
    const [formAlert, setFormAlert] = useState(null);
    const [sending, setSending] = useState(false);
    // The patient's edits of the services; null until the first change, so the appointment's own lines are shown
    const [editedItems, setEditedItems] = useState(null);
    const [pick, setPick] = useState({ service: null, variant: null });

    const doctorsState = useAsync(() => getBookingDoctors(), []);
    const doctors = doctorsState.value?.success ? doctorsState.value.data : [];
    const catalogState = useAsync(() => getBookingServices(), []);
    const catalog = catalogState.value ?? null;
    const catalogFailed = !catalogState.loading && !catalog;

    // The detail page polls and hands a new appointment object each time; keep the one the popup opened with
    const [target] = useState(appointment);
    const startItems = catalog ? initialItems(target, catalog) : [];
    const items = editedItems ?? startItems;
    const startParams = catalog ? toServiceParams(startItems, catalog) : null;
    const params = catalog ? toServiceParams(items, catalog) : null;
    const servicesChanged = Boolean(catalog) && JSON.stringify(params) !== JSON.stringify(startParams);
    // Without the catalog the services cannot be changed: the week is searched with the appointment's own services
    const searchParams = catalog ? params : catalogFailed ? appointmentServiceParams(target) : null;

    const week = useRescheduleWeek(searchParams, { today, preferredDate, doctorId });
    const { day } = week;
    // The picked slot only counts while its day is still shown and the slot is still free.
    const selected = slot && slot.date === day && week.slots?.some((item) => item.slotStart === slot.slotStart) ? slot : null;

    const servicesText = catalog && servicesChanged
        ? items.map((item) => itemLabel(catalog, item)).join(", ") || BOOKING_TEXT.GENERAL_EXAM_ONLY
        : target.serviceName;

    useEffect(() => {
        if (!focusSlotRef.current || week.slotsBusy) return;
        focusSlotRef.current = false;
        focusFirstSlot();
    });

    const close = () => onClose({ refetch: Boolean(formAlert?.refetch) });

    const changeItems = (next) => {
        setEditedItems(next);
        setSlot(null);
        setServiceError(null);
    };

    const pickService = (serviceId) => {
        setPick({ service: serviceId, variant: null });
        setServiceError(null);
    };

    const addService = () => {
        if (!catalog || pick.service === null) return;
        changeItems(addItem(items, catalog, pick.service, pick.variant).items);
        setPick({ service: null, variant: null });
    };

    const removeService = (removed) => changeItems(items.filter((item) => item !== removed));

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
        const pending = catalog ? getPendingSelection(catalog, items, pick.service, pick.variant) : null;
        if (pending) {
            setServiceError(BOOKING_TEXT.SERVICE_PENDING(pending));
            document.getElementById(BOOKING_IDS.ADD_SERVICE)?.focus();
            return;
        }
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
        const result = await rescheduleMyAppointment(appointment.id, {
            date: selected.date,
            slotStart: selected.slotStart,
            doctorId,
            services: servicesChanged ? params : undefined,
        });
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
            case APPOINTMENT_ACTION_CODE.ACTIVE_PLAN:
                setFormAlert({ message: `${BOOKING_TEXT.ERROR_ACTIVE_PLAN} ${CLINIC_HOTLINE.DISPLAY}.`, refetch: false });
                return;
            default:
                setFormAlert({ message: GENERIC_ERROR_MESSAGE, refetch: false });
        }
    };

    return (
        <Modal title="Đổi lịch hẹn" size="xl" onClose={close} closeDisabled={sending}>
            <form noValidate onSubmit={handleSubmit} className="mt-5 flex flex-col">
                <CompareCard appointment={target} servicesText={servicesText} servicesChanged={servicesChanged} next={selected} />
                {formAlert && (
                    <div role="alert" className="alert alert-danger mt-4">
                        {formAlert.message}
                    </div>
                )}

                <section className="mt-6">
                    <BookingSectionHeading number={1} title="Dịch vụ" />
                    {catalog ? (
                        <BookingServicePicker
                            services={catalog}
                            items={items}
                            pickService={pick.service}
                            pickVariant={pick.variant}
                            error={serviceError}
                            goneMessages={[]}
                            onPickService={pickService}
                            onPickVariant={(variant) => setPick((current) => ({ ...current, variant }))}
                            onAdd={addService}
                            onRemove={removeService}
                            showTitle={false}
                        />
                    ) : (
                        <p className="text-body-sm text-muted">{catalogFailed ? "Không tải được danh sách dịch vụ; lịch mới giữ nguyên các dịch vụ hiện tại." : "Đang tải danh sách dịch vụ..."}</p>
                    )}
                    {week.servicesError && (
                        <p role="alert" className="alert alert-warning mt-3 block">
                            {week.servicesError}
                        </p>
                    )}
                </section>

                <hr className="my-6 border-border" />

                <section>
                    <BookingSectionHeading number={2} title="Bác sĩ và ngày khám" />
                    <label htmlFor={DOCTOR_ID} className="mb-2 flex items-center gap-2 text-label text-ink">
                        <Stethoscope className="size-4 text-muted" aria-hidden="true" />
                        Bác sĩ
                    </label>
                    <select id={DOCTOR_ID} name="doctorId" className="input sm:max-w-sm" value={doctorId} disabled={sending} onChange={changeDoctor}>
                        <option value="">Phòng khám sắp xếp</option>
                        {doctors.map((doctor) => (
                            <option key={doctor.doctorId} value={String(doctor.doctorId)}>
                                {doctor.doctorName}
                            </option>
                        ))}
                    </select>
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
                    {!week.servicesError && (
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
                    )}
                    {dateError && (
                        <p id={DATE_ERROR_ID} role="alert" className="error-text mt-2">
                            {dateError}
                        </p>
                    )}
                </section>

                {day && (
                    <>
                        <hr className="my-6 border-border" />
                        <section>
                            <BookingSectionHeading number={3} title="Ca khám" />
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
                        </section>
                    </>
                )}

                <div className="modal-actions">
                    <p className="mr-auto hidden items-center gap-2 text-body-sm text-muted sm:flex">
                        <CalendarClock className="size-4" aria-hidden="true" />
                        Lịch đổi sẽ chờ phòng khám xác nhận lại.
                    </p>
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

import { hhmm } from "@/utils/calendar";
import { serviceNames } from "@/utils/checkIn";
import { SCHEDULE_TEXT as TEXT } from "@/utils/messages";
import { ALERT_STATES, DIM_STATES, STATE_BAR, STATE_TEXT } from "@/utils/roomSchedule";
import { cx } from "@/utils/cx";

// One appointment in the grid: name, "start–end · status", and the service when the card is two rows or taller
const AppointmentCard = ({ appointment: a, state, tall, flash, onOpen }) => {
    const time = `${hhmm(a.timeSlotStart)}–${hhmm(a.timeSlotEnd)}`;
    const label = TEXT.STATUS[state];
    return (
        <button
            type="button"
            data-appointment={a.id}
            aria-haspopup="dialog"
            aria-label={TEXT.APPOINTMENT_LABEL(a.patientName, time, label)}
            onClick={(e) => onOpen(a, e.currentTarget)}
            className={cx(
                "flex h-full min-h-9 w-full flex-col gap-px overflow-hidden rounded-lg border border-l-4 px-2.5 py-1 text-left shadow-xs transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                STATE_BAR[state],
                ALERT_STATES.includes(state) ? "border-danger-soft bg-danger-soft" : "border-border bg-canvas",
                DIM_STATES.includes(state) && "opacity-60",
                flash && "ring-3 ring-warning-solid",
            )}
        >
            <span className="truncate text-body-sm font-semibold text-ink">{a.patientName}</span>
            <span className="num truncate text-caption text-muted">
                {time} · <b className={cx("font-semibold", STATE_TEXT[state])}>{label}</b>
            </span>
            {tall && <span className="truncate text-caption text-muted">{serviceNames(a).join(", ")}</span>}
        </button>
    );
};

export default AppointmentCard;

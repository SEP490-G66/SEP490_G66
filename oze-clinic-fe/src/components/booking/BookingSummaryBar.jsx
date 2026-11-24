import { BOOKING_IDS, dayText, slotRange } from "@/utils/booking";
import { BOOKING_TEXT } from "@/utils/messages";

// Footer of the booking form (Figma): "Thứ Tư, 28/10/2026 · 08:00 – 08:30 · 1 dịch vụ" + the submit button.
// Parts not picked yet are left out. The button stays focusable while locked (aria-disabled) like before.
const BookingSummaryBar = ({ date, slotStart, slotEnd, serviceCount = 0, locked = false, submitting = false, describedBy, onSubmit }) => {
    const summary = [date && dayText(date, true), slotStart && slotRange(slotStart, slotEnd), serviceCount > 0 && `${serviceCount} dịch vụ`].filter(Boolean).join(" · ");

    return (
        <div className="mt-7 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
            {summary && <p className="num text-body-sm text-muted">{summary}</p>}
            <button
                type="button"
                id={BOOKING_IDS.SUBMIT}
                className="btn btn-primary min-w-45 max-sm:w-full max-sm:min-w-0"
                aria-disabled={locked || undefined}
                aria-describedby={describedBy}
                onClick={onSubmit}
            >
                {submitting ? BOOKING_TEXT.SUBMITTING : BOOKING_TEXT.SUBMIT}
            </button>
        </div>
    );
};

export default BookingSummaryBar;

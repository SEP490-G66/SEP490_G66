import { BOOKING_IDS, dayText, slotRange } from "@/utils/booking";

// Footer of the booking form: "Thứ Tư, 28/10/2026 · 08:00 – 08:30 · 1 dịch vụ" + submit button.
// Parts that are not picked yet are left out of the line.
const BookingSummaryBar = ({ date, slotStart, slotEnd, serviceCount = 0, submitting = false, label = "Đặt lịch khám" }) => {
    const summary = [date && dayText(date, true), slotStart && slotRange(slotStart, slotEnd), serviceCount > 0 && `${serviceCount} dịch vụ`].filter(Boolean).join(" · ");

    return (
        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
            {summary && (
                <p className="num text-body-sm text-muted" aria-live="polite">
                    {summary}
                </p>
            )}
            <button type="submit" id={BOOKING_IDS.SUBMIT} className="btn btn-primary btn-lg min-h-11 max-sm:w-full" disabled={submitting}>
                {submitting && <span className="btn-spinner" aria-hidden="true" />}
                {submitting ? "Đang đặt lịch..." : label}
            </button>
        </div>
    );
};

export default BookingSummaryBar;

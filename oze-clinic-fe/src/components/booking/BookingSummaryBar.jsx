import { BOOKING_IDS } from "@/utils/booking";
import { BOOKING_TEXT } from "@/utils/messages";

// Footer of the booking form: the submit button. It stays focusable while locked (aria-disabled) like before.
const BookingSummaryBar = ({ locked = false, submitting = false, describedBy, onSubmit }) => {
    return (
        <div className="mt-7 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
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

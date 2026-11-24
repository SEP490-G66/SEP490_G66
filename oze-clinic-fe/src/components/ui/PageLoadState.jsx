import { CircleAlert } from "lucide-react";
import { Hotline } from "@/components/booking/BookingSchedule";
import BookingStateBox from "@/components/booking/BookingStateBox";
import { BOOKING_TEXT, GENERIC_ERROR_MESSAGE } from "@/utils/messages";

// Shared non-content states of the patient pages: loading skeleton, load error with retry,
// and an account not linked to a patient profile yet. Renders nothing for "ready".
const PageLoadState = ({ status, onRetry, skeleton = "h-96" }) => {
    if (status === "loading") return <div aria-busy="true" className={`skeleton ${skeleton}`} />;
    if (status === "unlinked") {
        return (
            <section className="card-app">
                <BookingStateBox tone="warning" icon={CircleAlert} title={BOOKING_TEXT.UNLINKED_TITLE} headingLevel={2}>
                    Vui lòng gọi <Hotline /> để lễ tân gắn hồ sơ.
                </BookingStateBox>
            </section>
        );
    }
    if (status === "failed") {
        return (
            <div role="alert" className="alert alert-danger flex-wrap items-center justify-between">
                <span>{GENERIC_ERROR_MESSAGE}</span>
                {onRetry && (
                    <button type="button" className="btn btn-secondary" onClick={onRetry}>
                        Thử lại
                    </button>
                )}
            </div>
        );
    }
    return null;
};

export default PageLoadState;

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CircleAlert } from "lucide-react";
import BookingPatientCard from "@/components/booking/BookingPatientCard";
import BookingSchedule, { BookingLoadingCard, BookingSectionHeading, Hotline, LoadErrorBox } from "@/components/booking/BookingSchedule";
import BookingStateBox from "@/components/booking/BookingStateBox";
import BookingSuccess from "@/components/booking/BookingSuccess";
import useBookingForm from "@/hooks/useBookingForm";
import { PATIENT_BOOKING_API } from "@/services/bookingService";
import { BOOKING_IDS } from "@/utils/booking";
import { BOOKING_TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";

const BookAppointment = () => {
    const form = useBookingForm({ api: PATIENT_BOOKING_API });
    const { state, actions, earliest, blocked } = form;
    const { page, context, done } = state;

    useEffect(() => {
        const previous = document.title;
        return () => {
            document.title = previous;
        };
    }, []);

    useEffect(() => {
        document.title = done ? BOOKING_TEXT.SUCCESS_DOCUMENT_TITLE : BOOKING_TEXT.TITLE;
    }, [done]);

    const noSlots = state.formShown && !earliest;
    const isForm = page.status === "ready" && !blocked && state.formShown && !noSlots && !done;

    const renderCard = () => {
        if (done) {
            return (
                <section className="card-app">
                    <BookingSuccess result={done} />
                </section>
            );
        }
        if (page.status === "loading") return <BookingLoadingCard />;
        if (page.status === "unlinked") {
            return (
                <section className="card-app">
                    <BookingStateBox tone="warning" icon={CircleAlert} title={BOOKING_TEXT.UNLINKED_TITLE} headingLevel={2} headingId={BOOKING_IDS.STATE_TITLE}>
                        {BOOKING_TEXT.UNLINKED_TEXT} <Hotline /> {BOOKING_TEXT.UNLINKED_TEXT_END}
                    </BookingStateBox>
                </section>
            );
        }
        if (page.status === "phone-unverified") {
            return (
                <section className="card-app">
                    <BookingStateBox
                        tone="warning"
                        icon={CircleAlert}
                        title={BOOKING_TEXT.PHONE_UNVERIFIED_TITLE}
                        headingLevel={2}
                        headingId={BOOKING_IDS.STATE_TITLE}
                        action={
                            <Link to={ROUTES.PROFILE} className="btn btn-primary min-h-11 md:min-h-0">
                                {BOOKING_TEXT.PHONE_UNVERIFIED_ACTION}
                            </Link>
                        }
                    >
                        {BOOKING_TEXT.PHONE_UNVERIFIED_TEXT}
                    </BookingStateBox>
                </section>
            );
        }
        if (page.status === "error" && !page.profileLoaded) {
            return (
                <section className="card-app">
                    <LoadErrorBox headingLevel={2} onRetry={actions.retryContext} />
                </section>
            );
        }
        return (
            <section className="card-app">
                <BookingSectionHeading number={1} title={BOOKING_TEXT.PATIENT_SECTION} />
                <BookingPatientCard patient={context.patient} note={state.note} onNoteChange={actions.changeNote} showNote={isForm} />
                <hr className="my-7 border-border" />
                <BookingSectionHeading number={2} title={BOOKING_TEXT.SCHEDULE_SECTION} />
                <BookingSchedule form={form} />
            </section>
        );
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 id={BOOKING_IDS.PAGE_TITLE} tabIndex={-1} className="page-title">
                        {BOOKING_TEXT.TITLE}
                    </h1>
                    <p className="page-description">{BOOKING_TEXT.DESCRIPTION}</p>
                </div>
            </div>
            {renderCard()}
            <p className="sr-only" aria-live="polite">
                {state.live.text}
                {state.live.seq % 2 ? "\u200B" : ""}
            </p>
            <p className="sr-only" role="status">
                {state.submitting ? BOOKING_TEXT.SUBMITTING : ""}
            </p>
        </>
    );
};

export default BookAppointment;

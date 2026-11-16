import { useEffect, useState } from "react";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import BookingSchedule, { BookingLoadingCard, BookingSectionHeading, LoadErrorBox } from "@/components/booking/BookingSchedule";
import BookingSuccess from "@/components/booking/BookingSuccess";
import GuestPatientForm from "@/components/booking/GuestPatientForm";
import useBookingForm from "@/hooks/useBookingForm";
import { GUEST_BOOKING_API } from "@/services/guestBookingService";
import { BOOKING_IDS } from "@/utils/booking";
import { getClinicToday } from "@/utils/format";
import { BOOKING_TEXT, GUEST_BOOKING_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import { EMPTY_GUEST, firstGuestError, guestPayload, validateGuest } from "@/utils/guestBooking";

const BREADCRUMB = [{ label: TEXT.HOME, href: ROUTES.HOME }, { label: TEXT.TITLE }];

const GuestBookAppointment = () => {
    const today = getClinicToday();
    const [values, setValues] = useState(EMPTY_GUEST);
    const [errors, setErrors] = useState({});
    const [checked, setChecked] = useState(false);

    const form = useBookingForm({
        api: GUEST_BOOKING_API,
        guest: {
            validate: () => {
                const found = validateGuest(values, getClinicToday());
                setErrors(found);
                setChecked(true);
                return firstGuestError(found);
            },
            payload: () => guestPayload(values),
        },
    });
    const { state, actions } = form;
    const { page, done } = state;

    useEffect(() => {
        const previous = document.title;
        return () => {
            document.title = previous;
        };
    }, []);

    useEffect(() => {
        document.title = done ? BOOKING_TEXT.SUCCESS_DOCUMENT_TITLE : TEXT.TITLE;
    }, [done]);

    const change = (key, value) => {
        const next = { ...values, [key]: value };
        setValues(next);
        if (checked) setErrors(validateGuest(next, today));
    };

    const renderCard = () => {
        if (done) {
            return (
                <section className="card-public">
                    <BookingSuccess result={done} guest />
                </section>
            );
        }
        if (page.status === "loading") return <BookingLoadingCard card="card-public" />;
        if (page.status === "error" && !page.profileLoaded) {
            return (
                <section className="card-public">
                    <LoadErrorBox headingLevel={2} onRetry={actions.retryContext} />
                </section>
            );
        }
        return (
            <section className="card-public">
                <BookingSectionHeading number={1} title={BOOKING_TEXT.PATIENT_SECTION} />
                <GuestPatientForm values={values} errors={errors} onChange={change} note={state.note} onNoteChange={actions.changeNote} today={today} />
                <hr className="my-7 border-border" />
                <BookingSectionHeading number={2} title={BOOKING_TEXT.SCHEDULE_SECTION} />
                <BookingSchedule form={form} />
            </section>
        );
    };

    return (
        <div className="bg-surface-tint">
            <div className="container-public pb-6 pt-3">
                <Breadcrumb items={BREADCRUMB} />
            </div>
            <div className="container-public flex flex-col gap-6 pb-12 md:pb-16">
                <div>
                    <h1 id={BOOKING_IDS.PAGE_TITLE} tabIndex={-1} className="text-display-md md:text-display-lg">
                        {TEXT.TITLE}
                    </h1>
                    <p className="mt-2 text-body-lg text-body">{TEXT.DESCRIPTION}</p>
                </div>
                {renderCard()}
            </div>
            <p className="sr-only" aria-live="polite">
                {state.live.text}
                {state.live.seq % 2 ? "​" : ""}
            </p>
            <p className="sr-only" role="status">
                {state.submitting ? BOOKING_TEXT.SUBMITTING : ""}
            </p>
        </div>
    );
};

export default GuestBookAppointment;

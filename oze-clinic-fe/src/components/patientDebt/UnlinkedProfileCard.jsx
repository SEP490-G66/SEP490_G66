import { CircleAlert } from "lucide-react";
import { Hotline } from "@/components/booking/BookingSchedule";
import BookingStateBox from "@/components/booking/BookingStateBox";
import { BOOKING_TEXT, PATIENT_DEBT_TEXT } from "@/utils/messages";

const UnlinkedProfileCard = () => (
    <section className="card-app p-0">
        <BookingStateBox tone="warning" icon={CircleAlert} title={BOOKING_TEXT.UNLINKED_TITLE} headingLevel={2}>
            {PATIENT_DEBT_TEXT.UNLINKED_TEXT} <Hotline /> {PATIENT_DEBT_TEXT.UNLINKED_TEXT_END}
        </BookingStateBox>
    </section>
);

export default UnlinkedProfileCard;

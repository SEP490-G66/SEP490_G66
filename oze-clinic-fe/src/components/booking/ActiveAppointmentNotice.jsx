import { Link } from "react-router-dom";
import NextVisitCard from "@/components/dashboard/NextVisitCard";
import { BOOKING_IDS } from "@/utils/booking";
import { ROUTES } from "@/utils/routes";

// Booking page when the patient already has an unfinished appointment (one at a time):
// warning banner + the appointment (Figma: Đặt lịch khám · đang có lịch hẹn).
// unfinished: { id, code, date, slotStart, slotEnd, status, serviceName, doctorName } from getPatientBookingContext.
const ActiveAppointmentNotice = ({ unfinished }) => {
    const appointment = unfinished && {
        id: unfinished.id,
        appointmentCode: unfinished.code,
        appointmentDate: unfinished.date,
        timeSlotStart: unfinished.slotStart,
        timeSlotEnd: unfinished.slotEnd,
        status: unfinished.status,
        serviceName: unfinished.serviceName,
        doctorName: unfinished.doctorName,
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="alert alert-warning flex-wrap items-center justify-between">
                <div>
                    <h2 id={BOOKING_IDS.STATE_TITLE} tabIndex={-1} className="alert-title outline-none">
                        Bạn đang có một lịch hẹn
                    </h2>
                    <p className="text-caption">Liên hệ lễ tân nếu bạn muốn đổi hoặc huỷ lịch hiện tại.</p>
                </div>
                <Link to={ROUTES.APPOINTMENTS} className="btn btn-secondary min-h-11 md:min-h-0">
                    Xem lịch hẹn
                </Link>
            </div>
            {appointment && (
                <section className="card-app" aria-label="Lịch hẹn hiện tại">
                    <NextVisitCard appointment={appointment} showDetailLink={false} />
                </section>
            )}
        </div>
    );
};

export default ActiveAppointmentNotice;

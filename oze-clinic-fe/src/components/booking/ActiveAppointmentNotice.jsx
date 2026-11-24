import { Link } from "react-router-dom";
import NextVisitCard from "@/components/dashboard/NextVisitCard";
import { getAppointmentDetailRoute } from "@/utils/routes";

// Booking page when the patient already has a self-booked appointment (one at a time):
// warning banner + the appointment (Figma: Đặt lịch khám · đang có lịch hẹn).
const ActiveAppointmentNotice = ({ appointment }) => (
    <div className="flex flex-col gap-4">
        <div role="status" className="alert alert-warning flex-wrap items-center justify-between">
            <div>
                <p className="alert-title">Bạn đang có một lịch hẹn</p>
                <p className="text-caption">Liên hệ lễ tân nếu bạn muốn đổi hoặc huỷ lịch hiện tại.</p>
            </div>
            <Link to={getAppointmentDetailRoute(appointment.id)} className="btn btn-secondary min-h-11 md:min-h-0">
                Xem lịch hẹn
            </Link>
        </div>
        <div className="card-app">
            <NextVisitCard appointment={appointment} showDetailLink={false} />
        </div>
    </div>
);

export default ActiveAppointmentNotice;

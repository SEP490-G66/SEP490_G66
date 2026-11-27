import { Link } from "react-router-dom";
import { ROUTES } from "@/utils/routes";
import StepBlockedCard from "./StepBlockedCard";

// Exam step with nobody in the room: patients are called in from "Hàng chờ".
const NoExamView = ({ waitingCount }) => (
    <StepBlockedCard
        title="Chưa có lượt khám"
        text={waitingCount > 0 ? `Có ${waitingCount} bệnh nhân đang chờ. Gọi bệnh nhân vào khám ở trang Hàng chờ.` : "Hàng chờ đang trống."}
        action={
            <Link to={ROUTES.DOCTOR_QUEUE} className="btn btn-secondary">
                Mở hàng chờ
            </Link>
        }
    />
);

export default NoExamView;

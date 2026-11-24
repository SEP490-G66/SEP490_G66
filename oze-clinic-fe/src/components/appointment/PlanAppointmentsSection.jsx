import { useId } from "react";
import { Link } from "react-router-dom";
import { Phone } from "lucide-react";
import NextVisitCard from "@/components/dashboard/NextVisitCard";
import DashboardSection from "@/components/dashboard/DashboardSection";
import DataTable from "@/components/ui/DataTable";
import Notice from "@/components/ui/Notice";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate, formatTimeRange } from "@/utils/format";
import { CLINIC_HOTLINE, PATIENT_APPOINTMENT_STATUS } from "@/utils/messages";
import { getTreatmentPlanRoute } from "@/utils/routes";

const COLUMNS = [
    { key: "order", label: "STT", hideStack: true },
    {
        key: "content",
        label: "Nội dung buổi",
        primary: true,
        render: (session) => (
            <>
                <span className="text-ink">{session.content}</span>
                {session.upcoming && <span className="ml-1 text-caption text-muted">· lịch hẹn sắp tới</span>}
            </>
        ),
    },
    { key: "date", label: "Ngày hẹn", render: (session) => formatDate(session.date) || "Chưa lên lịch" },
    { key: "time", label: "Giờ hẹn", render: (session) => formatTimeRange(session.timeSlotStart, session.timeSlotEnd) || "—" },
    { key: "status", label: "Trạng thái lịch hẹn", render: (session) => <StatusBadge status={session.status} labels={PATIENT_APPOINTMENT_STATUS} /> },
];

// One treatment plan's appointments, arranged by the front desk (Figma: Lịch hẹn sắp tới · theo kế hoạch điều trị).
// plan: { id, name }; appointment: the next session's appointment (NextVisitCard shape);
// sessions: [{ id, order, content, date, timeSlotStart, timeSlotEnd, status, upcoming }].
const PlanAppointmentsSection = ({ plan, appointment, extra, sessions = [] }) => {
    const titleId = useId();
    const actions = (
        <div className="flex flex-wrap items-center gap-3">
            <a href={`tel:${CLINIC_HOTLINE.TEL}`} className="btn btn-secondary min-h-11 md:min-h-0">
                <Phone className="size-4" aria-hidden="true" />
                Liên hệ lễ tân để đổi / huỷ
                <span className="sr-only"> qua số {CLINIC_HOTLINE.DISPLAY}</span>
            </a>
            <Link to={getTreatmentPlanRoute(plan.id)} className="btn btn-link min-h-11 pointer-fine:min-h-0">
                Xem kế hoạch
                <span className="sr-only"> {plan.name}</span>
                <span aria-hidden="true">›</span>
            </Link>
        </div>
    );

    return (
        <DashboardSection id={titleId} title={plan.name} badge={actions}>
            {appointment && <NextVisitCard appointment={appointment} extra={extra} showDetailLink={false} />}
            <Notice tone="neutral">Lịch theo kế hoạch do lễ tân sắp xếp. Để đổi hoặc huỷ, vui lòng liên hệ lễ tân.</Notice>
            {sessions.length > 0 && (
                <DataTable columns={COLUMNS} rows={sessions} caption={`Các buổi của kế hoạch ${plan.name}`} rowClassName={(session) => (session.upcoming ? "bg-primary-softer" : undefined)} />
            )}
        </DashboardSection>
    );
};

export default PlanAppointmentsSection;

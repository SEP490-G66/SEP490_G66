import { useParams } from "react-router-dom";
import PlanSessionTable from "@/components/treatmentPlan/PlanSessionTable";
import PlanSummaryGrid from "@/components/treatmentPlan/PlanSummaryGrid";
import Notice from "@/components/ui/Notice";
import PageHeader from "@/components/ui/PageHeader";
import PageLoadState from "@/components/ui/PageLoadState";
import StatusBadge from "@/components/ui/StatusBadge";
import useMedicalBook from "@/hooks/useMedicalBook";
import { formatDate } from "@/utils/format";
import { parseRecordId } from "@/utils/medicalRecord";
import { MEDICAL_RECORD_PLAN_STATUS } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";

const BACK = { to: ROUTES.TREATMENT_PLANS, label: "Kế hoạch điều trị" };

const SESSION_STATUS = {
    done: { label: "Hoàn thành", badge: "badge-success" },
    next: { label: "Buổi tiếp theo", badge: "badge-info" },
    todo: { label: "Chưa bắt đầu", badge: "badge-neutral" },
    cancelled: { label: "Đã huỷ", badge: "badge-neutral" },
};

const toSession = (stage, doctorName) => ({
    id: stage.number,
    order: stage.number,
    content: stage.name,
    date: stage.actualDate ?? stage.scheduledDate ?? "",
    doctorName,
    status: SESSION_STATUS[stage.cancelled ? "cancelled" : stage.status],
    amountDue: stage.cost || null,
});

// "Chi tiết kế hoạch" (Figma): summary tiles and the session progress table.
// TODO(api): pay type, deposit and paid / remaining per plan are not returned yet, so those parts stay hidden.
const TreatmentPlanDetail = () => {
    const { planId } = useParams();
    const book = useMedicalBook();
    const id = parseRecordId(planId);
    const plan = book.data?.plans.find((item) => item.id === id) ?? null;

    if (book.status !== "ready" || !plan) {
        return (
            <>
                <PageHeader title="Chi tiết kế hoạch" back={BACK} />
                <PageLoadState status={book.status} onRetry={book.reload} />
                {book.status === "ready" && <div className="card-app empty-state py-16">Không tìm thấy kế hoạch điều trị này.</div>}
            </>
        );
    }

    const counted = plan.stages.filter((stage) => !stage.cancelled);
    const created = formatDate(plan.createdAt);

    return (
        <>
            <PageHeader
                title={plan.variant}
                badge={<StatusBadge status={plan.status} labels={MEDICAL_RECORD_PLAN_STATUS} />}
                description={created ? `Lập ngày ${created}` : null}
                back={BACK}
            />
            <div className="flex flex-col gap-5">
                {plan.status === "proposed" && <Notice tone="warning">Bác sĩ đã lập kế hoạch này. Vui lòng trao đổi và xác nhận với bác sĩ tại phòng khám trước khi bắt đầu điều trị.</Notice>}
                <PlanSummaryGrid summary={{ doctorName: plan.doctor, completed: counted.filter((stage) => stage.status === "done").length, total: counted.length, estimatedTotal: plan.total || null }} />
                <PlanSessionTable sessions={plan.stages.map((stage) => toSession(stage, plan.doctor))} />
            </div>
        </>
    );
};

export default TreatmentPlanDetail;

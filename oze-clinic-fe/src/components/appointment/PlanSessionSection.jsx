import { Phone } from "lucide-react";
import { Link } from "react-router-dom";
import PlanProgressSteps from "@/components/appointment/PlanProgressSteps";
import DashboardSection from "@/components/dashboard/DashboardSection";
import Notice from "@/components/ui/Notice";
import { formatMonthShort, formatWeekday, parseDateOnly } from "@/utils/format";
import { CLINIC_HOTLINE } from "@/utils/messages";
import { getTreatmentPlanRoute } from "@/utils/routes";

const TITLE_ID = "plan-session-title";

// "Buổi điều trị sắp tới": the next session of a plan that has no appointment yet. The day is the one the
// doctor planned; the front desk calls to set the time, and online booking is blocked meanwhile.
// session: findNextSession result.
const PlanSessionSection = ({ session }) => {
    const { plan, stage, index, total } = session;
    const date = parseDateOnly(stage.scheduledDate);
    const stages = plan.stages.filter((item) => item.stageStatus !== "Cancelled").sort((a, b) => a.stageNumber - b.stageNumber);
    const action = (
        <a href={`tel:${CLINIC_HOTLINE.TEL}`} className="btn btn-secondary min-h-11 md:min-h-0">
            <Phone className="size-4" aria-hidden="true" />
            Gọi lễ tân
            <span className="sr-only"> qua số {CLINIC_HOTLINE.DISPLAY}</span>
        </a>
    );

    return (
        <DashboardSection id={TITLE_ID} title="Buổi điều trị sắp tới" badge={action}>
            <div className="flex items-start gap-4 rounded-lg border border-border bg-primary-softer p-4 md:p-6">
                <div aria-hidden="true" className="flex w-20 shrink-0 flex-col items-center rounded-md border border-border bg-canvas py-2">
                    {date ? (
                        <>
                            <span className="text-caption text-muted">{formatMonthShort(stage.scheduledDate)}</span>
                            <span className="num font-heading text-stat text-ink">{date.getDate()}</span>
                            <span className="text-caption text-muted">{formatWeekday(stage.scheduledDate)}</span>
                        </>
                    ) : (
                        <span className="px-2 py-3 text-center text-caption text-muted">Chưa có ngày</span>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="card-title">
                        Buổi {index + 1} · {stage.stageName || "Buổi điều trị"}
                    </h3>
                    <p className="mt-1 text-body-sm text-body">{[plan.planName, plan.doctorName].filter(Boolean).join(" · ")}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="badge badge-neutral">
                            Buổi {index + 1}/{total}
                        </span>
                        <span className="badge badge-warning">Chờ lễ tân chốt giờ</span>
                    </div>
                </div>
            </div>
            <PlanProgressSteps stages={stages} currentNumber={stage.stageNumber} />
            <Notice>
                Lễ tân sẽ gọi để <strong>chốt giờ</strong> cho buổi này. Muốn đổi ngày hoặc khám thêm dịch vụ khác, vui lòng gọi lễ tân.{" "}
                <Link to={getTreatmentPlanRoute(plan.treatmentPlanId)} className="font-semibold text-primary hover:underline">
                    Xem kế hoạch điều trị
                </Link>
            </Notice>
        </DashboardSection>
    );
};

export default PlanSessionSection;

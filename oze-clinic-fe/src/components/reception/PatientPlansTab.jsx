import { Badge, EmptyState } from "./shared";
import { dmy, money } from "./receptionUtils";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";
import { PLAN_STATUS } from "@/utils/patientRecord";

const PatientPlansTab = ({ items }) => {
    const plans = items.filter((p) => p.status !== "Draft");
    if (plans.length === 0) return <EmptyState text={TEXT.PLAN_EMPTY} />;
    return (
        <ul className="space-y-3">
            {plans.map((plan) => {
                const cancelled = Number(plan.cancelledStages ?? 0);
                const total = Math.max(0, Number(plan.totalStages ?? 0) - cancelled);
                return (
                    <li key={plan.id} className="rounded-xl border border-border bg-canvas p-5 text-body-sm">
                        <div className="flex flex-wrap items-start gap-2">
                            <span className="min-w-0 flex-1 font-semibold text-ink">{plan.planName || TEXT.DASH}</span>
                            <Badge map={PLAN_STATUS} value={plan.status} />
                        </div>
                        <p className="mt-1 text-muted">
                            {plan.createdByDoctorName && <>{TEXT.PLAN_BY(plan.createdByDoctorName)} · </>}
                            <span className="num">
                                {TEXT.PLAN_STAGES(Number(plan.completedStages ?? 0), total)}
                                {cancelled > 0 && TEXT.PLAN_CANCELLED_STAGES(cancelled)}
                            </span>
                            {" · "}
                            <span className="num">{TEXT.PLAN_TOTAL(money(plan.estimatedTotalCost))}</span>
                        </p>
                        {plan.nextStageName && (
                            <p className="mt-1 text-caption text-muted">
                                {TEXT.PLAN_NEXT(plan.nextStageName, plan.nextStageScheduledDate ? dmy(String(plan.nextStageScheduledDate).slice(0, 10)) : null)}
                            </p>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};

export default PatientPlansTab;

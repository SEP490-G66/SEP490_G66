import ClinicalExamSection from "@/components/examination/ClinicalExamSection";
import StatusBadge from "@/components/ui/StatusBadge";

const PLAN_STATUS = {
    Approved: { label: "Đã đồng ý", badge: "badge-info" },
    InProgress: { label: "Đang điều trị", badge: "badge-info" },
};

const STAGE_STATUS = {
    done: { label: "Đã thực hiện", badge: "badge-success" },
    next: { label: "Buổi tiếp theo", badge: "badge-info" },
    todo: { label: "Chưa thực hiện", badge: "badge-neutral" },
    cancelled: { label: "Đã huỷ", badge: "badge-danger" },
};

// "Kế hoạch điều trị đang thực hiện" on the doctor's patient record: each agreed plan with its sessions.
// plans: [{ id, name, status, code, doctor, createdAt, done, total, stages: [{ id, number, name, date, status }] }].
const ActivePlanCard = ({ plans }) => (
    <ClinicalExamSection title="Kế hoạch điều trị đang thực hiện" divided={false} flush>
        {plans.length === 0 ? (
            <p className="border-t border-border px-5 py-6 text-center text-muted">Bệnh nhân không có kế hoạch điều trị nào đang thực hiện.</p>
        ) : (
            plans.map((plan) => (
                <div key={plan.id} className="border-t border-border">
                    <div className="flex flex-wrap items-start gap-3 px-5 py-4">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-ink">{plan.name}</p>
                                <StatusBadge status={plan.status} labels={PLAN_STATUS} />
                            </div>
                            <p className="mt-0.5 text-caption text-muted">{[plan.code, plan.doctor, plan.createdAt && `Lập ${plan.createdAt}`].filter(Boolean).join(" · ")}</p>
                        </div>
                        <span className="num shrink-0 text-caption font-semibold text-ink">
                            {plan.done}/{plan.total} buổi
                        </span>
                    </div>
                    <div className="table-wrap rounded-none border-x-0 border-b-0">
                        <table className="table">
                            <caption className="sr-only">Các buổi của kế hoạch {plan.name}</caption>
                            <thead>
                                <tr>
                                    <th scope="col">STT</th>
                                    <th scope="col">Nội dung buổi</th>
                                    <th scope="col">Ngày</th>
                                    <th scope="col">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {plan.stages.map((stage) => (
                                    <tr key={stage.id}>
                                        <td className="num">{stage.number}</td>
                                        <td className="min-w-48">{stage.name}</td>
                                        <td className="num whitespace-nowrap">{stage.date || "—"}</td>
                                        <td>
                                            <StatusBadge status={stage.status} labels={STAGE_STATUS} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))
        )}
    </ClinicalExamSection>
);

export default ActivePlanCard;

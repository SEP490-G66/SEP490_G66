import { useState } from "react";
import { toast } from "react-toastify";
import ConfirmActionDialog from "@/components/billing/ConfirmActionDialog";
import useAutosave from "@/hooks/useAutosave";
import { confirmTreatmentPlan, saveTreatmentPlan } from "@/services/examinationService";
import { planSummary, validatePlan } from "@/utils/examination";
import { formatNumber, getClinicToday } from "@/utils/format";
import PlanServiceList from "@/components/examination/PlanServiceList";
import PlanSummaryCard from "@/components/examination/PlanSummaryCard";
import StepBlockedCard from "@/components/examination/StepBlockedCard";
import useExamDraft from "@/hooks/useExamDraft";

const NO_SERVICE_HINT = "Chưa có dịch vụ nào trong kế hoạch. Thêm dịch vụ từ danh mục để lập kế hoạch.";

// Once the patient agreed (Approved) the plan is followed, not edited
const LOCKED_STATUSES = ["Approved", "InProgress", "Completed"];

// Step 3 "Lập kế hoạch điều trị": sessions of each service to treat, in treatment order, with the summary. The plan starts
// with the booked services; the doctor adds others from record.planCatalog ([{ serviceId, name }]) in every case.
// record.plan is the plan of the visit ({ services, planId?, status? }); every change is saved to the backend
// (treatment plan and its stages) and passed to onPlanChange. record.planTypes: { [serviceId]: [{ id, name, price }] },
// the service's variants offered as "Loại dịch vụ". The plan is checked (validatePlan) before "Hoàn thành", which asks
// the doctor to confirm the patient agreed, then proposes and approves it and goes to the treatment room (onComplete).
// Without a diagnosis (and no plan yet) the step only points back to "Khám & chẩn đoán" (onToDiagnosis).
// draft: the visit header's "Lưu nháp" and status (useExamDraft).
const TreatmentPlanTab = ({ queueId, record, busy = false, onPlanChange, onComplete, onToDiagnosis, draft }) => {
    const { value: plan, setValue: setPlan, statusText, saveNow } = useAutosave((draft) => saveTreatmentPlan(queueId, draft), record.plan, onPlanChange);
    const locked = LOCKED_STATUSES.includes(plan.status);
    const typeOptionsOf = (service) => record.planTypes?.[service.serviceId] ?? [];
    // Services shown open; each one opens and closes independently of the others. An agreed plan shows them all.
    const [expandedIds, setExpandedIds] = useState(() =>
        locked ? record.plan.services.map((service) => service.id) : record.plan.services[0] ? [record.plan.services[0].id] : [],
    );
    const toggleService = (id) => setExpandedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    const [errors, setErrors] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const hasServices = plan.services.length > 0;

    const check = (services) => validatePlan(services, typeOptionsOf, getClinicToday());

    const changeServices = (services) => {
        setPlan({ ...plan, services });
        if (errors) setErrors(check(services));
    };

    // Shows the errors and opens the first service that has one (others stay as they are); true when the plan can be sent.
    const checkPlan = () => {
        const result = check(plan.services);
        setErrors(result);
        if (!result.count) return true;
        const firstWithError = plan.services.find((service) => result.services[service.id] || service.sessions.some((session) => result.sessions[session.id]));
        if (firstWithError) setExpandedIds((current) => (current.includes(firstWithError.id) ? current : [...current, firstWithError.id]));
        toast.error("Kế hoạch còn thông tin chưa nhập hoặc chưa hợp lệ.");
        return false;
    };

    const askAgreement = async () => {
        if (locked) {
            onComplete?.(plan);
            return;
        }
        if (!checkPlan()) return;
        const response = await saveNow();
        if (!response.success) {
            toast.error(response.message || "Chưa lưu được kế hoạch, thử lại sau.");
            return;
        }
        setConfirming(true);
    };

    // The dialog shows its own spinner and cannot be closed while this runs
    const agree = async () => {
        const response = await confirmTreatmentPlan(queueId, plan);
        setConfirming(false);
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        setPlan(response.data);
        toast.success(response.message);
        onComplete?.(response.data);
    };

    const status = !hasServices
        ? NO_SERVICE_HINT
        : locked
          ? `Kế hoạch ${plan.code ?? ""} đã được bệnh nhân đồng ý · chỉ xem`
          : errors?.count
            ? `${statusText} · Còn ${errors.count} thông tin chưa nhập hoặc chưa hợp lệ`
            : statusText;
    const sessionCount = plan.services.reduce((total, service) => total + service.sessions.length, 0);

    useExamDraft(draft, saveNow, status);

    if (!plan.planId && !record.exam.diagnoses.length) {
        return (
            <StepBlockedCard
                title="Chưa có chẩn đoán"
                text="Ghi nhận ít nhất 1 chẩn đoán trước khi lập kế hoạch điều trị."
                actionLabel="Về Khám & chẩn đoán"
                onAction={onToDiagnosis}
            />
        );
    }

    return (
        <>
            {locked && (
                <p role="status" className="alert alert-info">
                    Bệnh nhân đã đồng ý kế hoạch này nên không sửa được nữa. Các buổi được thực hiện ở bước Điều trị.
                </p>
            )}
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18.75rem]">
                {/* An agreed plan is shown with every field and button turned off */}
                <div className="flex min-w-0 flex-col gap-4">
                    <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
                        <PlanServiceList
                            services={plan.services}
                            catalog={record.planCatalog ?? []}
                            typeOptionsOf={typeOptionsOf}
                            expandedIds={expandedIds}
                            errors={errors}
                            onToggle={toggleService}
                            onChange={changeServices}
                            onAdd={(service) => setExpandedIds((current) => [...current, service.id])}
                        />
                    </fieldset>
                    {/* Saving asks the doctor to confirm the patient agreed, then the plan is followed in "Điều trị" */}
                    {!locked && (
                        <div className="flex justify-end">
                            <button type="button" className="btn btn-primary" disabled={busy || !hasServices} onClick={askAgreement}>
                                Lưu kế hoạch
                            </button>
                        </div>
                    )}
                </div>
                <div className="lg:sticky lg:top-4">
                    <PlanSummaryCard services={plan.services} />
                </div>
            </div>
            {confirming && (
                <ConfirmActionDialog
                    title="Bệnh nhân đồng ý kế hoạch điều trị?"
                    description={`${record.patient.name} · ${sessionCount} buổi`}
                    body={[
                        "Đã trao đổi với bệnh nhân về ",
                        `${sessionCount} buổi điều trị`,
                        ", chi phí dự kiến ",
                        `${formatNumber(planSummary(plan.services).total)} ₫`,
                        ". Sau khi xác nhận, kế hoạch không sửa được nữa.",
                    ]}
                    closeLabel="Chưa đồng ý"
                    submitLabel="Bệnh nhân đã đồng ý"
                    onClose={() => setConfirming(false)}
                    onSubmit={agree}
                />
            )}
        </>
    );
};

export default TreatmentPlanTab;

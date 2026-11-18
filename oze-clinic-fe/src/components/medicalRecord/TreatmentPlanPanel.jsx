import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck, Clock, Info } from "lucide-react";
import { cx } from "@/utils/cx";
import { formatCurrency } from "@/utils/format";
import { RECORD_NAV_FLAG, RECORD_STATUS_BUTTON_ID, SHEET_TAB, buildRecordUrl, displayText, isPlainClick } from "@/utils/medicalRecord";
import { CLINIC_HOTLINE, MEDICAL_RECORD_PLAN_STATUS, MEDICAL_RECORD_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import ApprovePlanDialog from "./ApprovePlanDialog";
import RecordStatusBadge from "./RecordStatusBadge";
import StatusDefinitionDrawer from "./StatusDefinitionDrawer";
import TreatmentStepList from "./TreatmentStepList";

const LINK_STATE = { [RECORD_NAV_FLAG]: true, scrollTop: true, focusH1: true };
const CARD_HEADER_CLASS = "flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4";
const SMALL_LINK_CLASS = "btn h-8 px-3 text-primary hover:bg-surface-tint";

const orDash = (value) => (value === "" || value == null ? "—" : displayText(value));

const PlanAlert = ({ plan }) => {
    const nextStage = plan.stages.find((stage) => stage.status === "next");
    if (plan.status === "active" && nextStage) {
        return (
            <div className="alert alert-info">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div>
                    <p className="font-semibold">Bước tiếp theo: {displayText(nextStage.name)}</p>
                    <p>{displayText(nextStage.note)}</p>
                </div>
            </div>
        );
    }
    if (plan.status === "done") {
        return (
            <div className="alert alert-success">
                <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p className="font-semibold">Đã hoàn thành kế hoạch</p>
            </div>
        );
    }
    return null;
};

const CostTable = ({ plan }) => (
    <>
        <div className="overflow-x-auto">
            <table className="table">
                <thead>
                    <tr>
                        <th>Bước</th>
                        <th>Nội dung</th>
                        <th className="text-right">Chi phí dự kiến</th>
                    </tr>
                </thead>
                <tbody>
                    {plan.stages
                        .filter((stage) => !stage.cancelled)
                        .map((stage) => (
                            <tr key={stage.number}>
                                <td className="whitespace-nowrap font-semibold text-ink">{TEXT.STAGE(stage.number)}</td>
                                <td>{displayText(stage.name)}</td>
                                <td className="num whitespace-nowrap text-right">{formatCurrency(stage.cost)}</td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
        <div className="flex justify-between gap-3 border-t border-border px-5 py-3 font-semibold text-ink">
            <span>{TEXT.PLAN_TOTAL}</span>
            <span className="num">{formatCurrency(plan.total)}</span>
        </div>
    </>
);

const ApproveBox = ({ plan, onApprove }) => (
    <section className="card-app border-2 border-warning p-0">
        <div className={CARD_HEADER_CLASS}>
            <div className="flex items-center gap-2">
                <Clock className="size-5 text-warning" aria-hidden="true" />
                <h2 className="card-title">{TEXT.APPROVE_TITLE}</h2>
            </div>
        </div>
        <CostTable plan={plan} />
        <div className="flex flex-col gap-3 border-t border-border px-5 py-4">
            <p className="text-body-sm">{TEXT.APPROVE_INFO}</p>
            <div>
                <button type="button" className="btn btn-primary" onClick={onApprove}>
                    {TEXT.APPROVE_BUTTON}
                </button>
            </div>
            <p className="text-caption text-muted">
                {TEXT.APPROVE_CHANGE}{" "}
                <a href={`tel:${CLINIC_HOTLINE.TEL}`} className="font-semibold text-primary hover:underline">
                    {CLINIC_HOTLINE.DISPLAY}
                </a>
                .
            </p>
        </div>
    </section>
);

const LogTable = ({ plan, visitId, visitIds, onOpenVisit }) => (
    <section className="card-app p-0">
        <div className={CARD_HEADER_CLASS}>
            <h2 className="card-title">Quá trình điều trị</h2>
        </div>
        {plan.log.length > 0 ? (
            <div className="overflow-x-auto">
                <table className="table">
                    <thead>
                        <tr>
                            <th className="w-32">Ngày</th>
                            <th>Đã làm</th>
                            <th>Bước tiếp theo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {plan.log.map((row, index) => {
                            const current = visitId != null && row.visit === visitId;
                            return (
                                <tr key={`${index}-${row.date}`} className={cx(current && "bg-primary-soft")}>
                                    <td className={cx("whitespace-nowrap font-semibold text-ink", current && "border-l-3 border-l-primary")}>
                                        {current ? (
                                            <>
                                                {displayText(row.date)} <span className="badge badge-info">{TEXT.THIS_VISIT}</span>
                                            </>
                                        ) : visitIds.has(row.visit) ? (
                                            <Link
                                                to={buildRecordUrl(row.visit, SHEET_TAB)}
                                                state={LINK_STATE}
                                                className="text-primary hover:underline"
                                                onClick={(event) => isPlainClick(event) && onOpenVisit()}
                                            >
                                                {displayText(row.date)}
                                            </Link>
                                        ) : (
                                            <span className="font-normal text-muted">{displayText(row.date)}</span>
                                        )}
                                    </td>
                                    <td>{displayText(row.action)}</td>
                                    <td className="text-muted">{displayText(row.next)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        ) : (
            <p className="p-6 text-center text-body-sm text-muted">Chưa có bước nào được làm.</p>
        )}
    </section>
);

const PlanCard = ({ plan, first, visitId, visitIds, onOpenDrawer, onOpenVisit, onApprove }) => {
    const proposed = plan.status === "proposed";
    return (
        <div className="flex flex-col gap-4">
            <section className="card-app p-0">
                <div className={CARD_HEADER_CLASS}>
                    <div className="min-w-0">
                        <h2 className="font-heading text-heading-3 text-ink">{displayText(plan.variant)}</h2>
                        <p className="num text-caption text-muted">{proposed ? TEXT.PLAN_SENT(plan.doctor, plan.sentOn) : TEXT.PLAN_STARTED(plan.doctor, plan.start)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <RecordStatusBadge status={plan.status} labels={MEDICAL_RECORD_PLAN_STATUS} />
                        <button id={first ? RECORD_STATUS_BUTTON_ID : undefined} type="button" className={SMALL_LINK_CLASS} onClick={onOpenDrawer}>
                            <Info className="size-4" aria-hidden="true" />
                            Trạng thái
                        </button>
                    </div>
                </div>
                <div className="grid gap-6 p-5 lg:grid-cols-2">
                    <div>
                        <p className="text-caption text-muted">Chẩn đoán</p>
                        <p className="mb-3.5 font-semibold text-ink">{orDash(plan.diag)}</p>
                        {plan.description && <p className="mb-3.5 text-body-sm">{plan.description}</p>}
                        <PlanAlert plan={plan} />
                    </div>
                    <div>
                        <p className="mb-2 text-caption text-muted">Các bước</p>
                        <TreatmentStepList stages={plan.stages} />
                    </div>
                </div>
                {!proposed && plan.status !== "stopped" && (
                    <div className="border-t border-border px-5 py-3">
                        <Link to={ROUTES.PAYMENT_DEBTS} className="inline-flex items-center gap-1 text-body-sm font-semibold text-primary hover:underline">
                            {TEXT.VIEW_DEBTS}
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                    </div>
                )}
            </section>
            {proposed ? <ApproveBox plan={plan} onApprove={onApprove} /> : <LogTable plan={plan} visitId={visitId} visitIds={visitIds} onOpenVisit={onOpenVisit} />}
        </div>
    );
};

const TreatmentPlanPanel = ({ plans, visitId, visitIds, drawerOpen, onOpenDrawer, onCloseDrawer, onOpenVisit, onApproved }) => {
    const [approving, setApproving] = useState(null);

    const closeDialog = (refresh) => {
        setApproving(null);
        if (refresh) onApproved();
    };

    return (
        <div className="flex flex-col gap-6">
            {plans.map((plan, index) => (
                <PlanCard
                    key={plan.id}
                    first={index === 0}
                    plan={plan}
                    visitId={visitId}
                    visitIds={visitIds}
                    onOpenDrawer={onOpenDrawer}
                    onOpenVisit={onOpenVisit}
                    onApprove={() => setApproving(plan)}
                />
            ))}
            {approving && (
                <ApprovePlanDialog
                    plan={approving}
                    onClose={closeDialog}
                    onApproved={() => {
                        setApproving(null);
                        onApproved();
                    }}
                />
            )}
            {drawerOpen && <StatusDefinitionDrawer onClose={onCloseDrawer} />}
        </div>
    );
};

export default TreatmentPlanPanel;

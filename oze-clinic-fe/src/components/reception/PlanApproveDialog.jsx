import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { DialogActions } from "./shared";
import { dmy, money } from "./receptionUtils";
import { approveTreatmentPlan, getTreatmentPlan } from "@/services/receptionService";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";
import { planFingerprint, sortedStages } from "@/utils/patientRecord";
import { BE_MESSAGES, errorText, hasMessage, isUncertain } from "@/utils/patientRecordErrors";
import { notifyPatientRecord } from "@/utils/patientRecordStore";

const READ = { skipErrorPage: true };
const C = TEXT.APPROVE_COLUMNS;

const isGone = (result) => result.status === 404 || hasMessage(result, BE_MESSAGES.PLAN_NOT_FOUND);

const closedText = (plan) => (plan.status === "Approved" ? TEXT.PLAN_ALREADY_APPROVED : TEXT.PLAN_NOT_PROPOSED);

const PlanApproveDialog = ({ plan: listPlan, owner, onClose, onResolved }) => {
    const [view, setView] = useState({ status: "loading", plan: null });
    const [alert, setAlert] = useState(null);
    const [sending, setSending] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const mountedRef = useRef(false);
    const alertRef = useRef(null);
    const formRef = useRef(null);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (alert) alertRef.current?.focus();
    }, [alert]);

    const finish = (text, { error = false } = {}) => {
        notifyPatientRecord(owner, { text }, { error });
        if (mountedRef.current) onResolved();
    };

    useEffect(() => {
        const controller = new AbortController();
        getTreatmentPlan(listPlan.id, { ...READ, signal: controller.signal }).then((result) => {
            if (result.aborted || controller.signal.aborted) return;
            if (!result.success) {
                if (isGone(result)) {
                    notifyPatientRecord(owner, { text: TEXT.PLAN_GONE }, { error: true });
                    onResolved();
                    return;
                }
                setView({ status: "error", plan: null });
                setAlert({ text: errorText(result, "plan"), retry: true });
                return;
            }
            const data = result.data;
            if (data?.status && data.status !== "Proposed") {
                notifyPatientRecord(owner, { text: closedText(data) });
                onResolved();
                return;
            }
            if (planFingerprint(data) === null) {
                setView({ status: "error", plan: data });
                setAlert({ text: TEXT.PLAN_UNVERIFIABLE, retry: true });
                return;
            }
            setView({ status: "ready", plan: data });
        });
        return () => controller.abort();
    }, [listPlan.id, attempt, owner, onResolved]);

    const retry = () => {
        setAlert(null);
        setView({ status: "loading", plan: null });
        setAttempt((n) => n + 1);
    };

    const checkAfterUncertain = async () => {
        const check = await getTreatmentPlan(listPlan.id, READ);
        if (check.success && check.data?.status === "Approved") return finish(TEXT.PLAN_ALREADY_APPROVED);
        if (check.success && check.data?.status && check.data.status !== "Proposed") return finish(closedText(check.data));
        if (check.success) {
            if (mountedRef.current) setAlert({ text: TEXT.PLAN_NOT_SEEN });
            else notifyPatientRecord(owner, { text: TEXT.PLAN_NOT_SEEN }, { error: true });
            return undefined;
        }
        if (isGone(check)) return finish(TEXT.PLAN_GONE, { error: true });
        if (mountedRef.current) setAlert({ text: TEXT.PLAN_UNKNOWN });
        else notifyPatientRecord(owner, { text: TEXT.PLAN_UNKNOWN }, { error: true });
        return undefined;
    };

    const send = async () => {
        const shown = view.plan;
        setSending(true);
        setAlert(null);
        formRef.current?.closest(".modal")?.focus();
        try {
            const fresh = await getTreatmentPlan(listPlan.id, READ);
            if (!mountedRef.current) return;
            if (!fresh.success) {
                if (isGone(fresh)) return finish(TEXT.PLAN_GONE, { error: true });
                setAlert({ text: errorText(fresh, "plan") });
                return;
            }
            if (fresh.data?.status && fresh.data.status !== "Proposed") return finish(closedText(fresh.data));
            const freshPrint = planFingerprint(fresh.data);
            if (freshPrint === null) {
                setAlert({ text: TEXT.PLAN_UNVERIFIABLE });
                return;
            }
            if (freshPrint !== planFingerprint(shown)) {
                setView({ status: "ready", plan: fresh.data });
                setAlert({ text: TEXT.PLAN_CHANGED, warning: true });
                return;
            }
            if (!mountedRef.current) return;
            const result = await approveTreatmentPlan(listPlan.id, READ);
            if (result.success) return finish(TEXT.APPROVE_DONE);
            if (isUncertain(result)) return checkAfterUncertain();
            if (isGone(result)) return finish(TEXT.PLAN_GONE, { error: true });
            if (hasMessage(result, BE_MESSAGES.PLAN_NOT_PROPOSED)) return finish(TEXT.PLAN_NOT_PROPOSED, { error: true });
            if (mountedRef.current) setAlert({ text: errorText(result, "plan") });
            else notifyPatientRecord(owner, { text: errorText(result, "plan") }, { error: true });
        } finally {
            if (mountedRef.current) setSending(false);
        }
    };

    const plan = view.plan;
    const stages = sortedStages(plan?.stages);
    return (
        <Modal title={TEXT.APPROVE_TITLE} size="lg" onClose={onClose} closeDisabled={sending}>
            <form
                ref={formRef}
                className="space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!sending && view.status === "ready") send();
                }}
            >
                {view.status === "loading" ? (
                    <p className="text-body-sm text-muted">{TEXT.LOADING}</p>
                ) : (
                    plan && (
                        <>
                            <div>
                                <p className="font-semibold text-ink">{plan.planName || listPlan.planName || TEXT.DASH}</p>
                                {(plan.createdByDoctorName || listPlan.createdByDoctorName) && (
                                    <p className="text-body-sm text-muted">{TEXT.PLAN_BY(plan.createdByDoctorName || listPlan.createdByDoctorName)}</p>
                                )}
                            </div>
                            <div className="table-wrap">
                                <table className="table table-stack">
                                    <thead>
                                        <tr>
                                            <th>{C.NO}</th>
                                            <th>{C.STAGE}</th>
                                            <th>{C.SERVICE}</th>
                                            <th className="text-right">{C.COST}</th>
                                            <th>{C.DATE}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stages.map((stage) => (
                                            <tr key={stage.id}>
                                                <td data-label={C.NO} className="num">
                                                    {stage.stageNumber}
                                                </td>
                                                <td data-primary>{stage.stageName || TEXT.DASH}</td>
                                                <td data-label={C.SERVICE}>{stage.serviceName || TEXT.DASH}</td>
                                                <td data-label={C.COST} className="num text-right">
                                                    {money(stage.estimatedCost)}
                                                </td>
                                                <td data-label={C.DATE} className="num">
                                                    {stage.scheduledDate ? dmy(String(stage.scheduledDate).slice(0, 10)) : TEXT.DASH}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-body-sm text-muted">
                                {TEXT.APPROVE_TOTAL} <span className="num font-semibold text-ink">{money(plan.estimatedTotalCost)}</span>
                            </p>
                            <p className="text-body-sm text-ink">{TEXT.APPROVE_HINT}</p>
                        </>
                    )
                )}
                {alert && (
                    <div ref={alertRef} role="alert" tabIndex={-1} className={alert.warning ? "alert alert-warning" : "alert alert-danger"}>
                        <span className="flex-1">{alert.text}</span>
                        {alert.retry && (
                            <button type="button" className="btn btn-secondary h-9" onClick={retry}>
                                {TEXT.RETRY}
                            </button>
                        )}
                    </div>
                )}
                <DialogActions
                    onClose={onClose}
                    submitLabel={TEXT.APPROVE}
                    busy={sending}
                    disabled={view.status !== "ready"}
                    closeDisabled={sending}
                    closeLabel={TEXT.CANCEL}
                />
            </form>
        </Modal>
    );
};

export default PlanApproveDialog;

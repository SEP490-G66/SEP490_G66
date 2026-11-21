import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import { Card } from "@/components/reception/shared";
import { money } from "@/components/reception/receptionUtils";
import { LoadError, OptionBadge, Stat, Stats } from "@/components/cashier/cashierUi";
import PeriodCard from "@/components/cashier/PeriodCard";
import PlanPicker from "@/components/cashier/PlanPicker";
import { actionOf } from "@/components/cashier/planActions";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { getPlan } from "@/services/cashierService";
import { ACTION, OPTION } from "@/utils/cashier";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { ROUTES, getCashierRoute } from "@/utils/routes";

const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.PERIODS_TITLE }];

// Thanh toán theo đợt: every period (treatment session) of a plan with its money; "Thu tiền" opens Ghi nhận with it added
const CashierPeriods = () => {
    const [params, setParams] = useSearchParams();
    const patientId = params.get("patient") ?? "";
    const planId = params.get("plan") ?? "";
    const [result, setResult] = useState(null);
    const [version, setVersion] = useState(0);

    usePageTitle(TEXT.PERIODS_DOC_TITLE);

    const key = `${patientId}|${planId}|${version}`;
    useEffect(() => {
        if (!patientId || !planId) return undefined;
        let active = true;
        getPlan({ patientId, planId }).then((response) => active && setResult({ key, ...response }));
        return () => {
            active = false;
        };
    }, [patientId, planId, key]);

    const current = result?.key === key ? result : null;
    const plan = current?.success && current.data.option ? current.data : null;

    const pick = ({ patientId: nextPatient, planId: nextPlan }, replace = false) => {
        const next = new URLSearchParams();
        if (nextPatient) next.set("patient", nextPatient);
        if (nextPlan) next.set("plan", nextPlan);
        setParams(next, { replace });
    };

    const action = plan ? actionOf(Number(patientId), plan) : null;

    return (
        <div className="app-content min-h-full space-y-5">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.PERIODS_TITLE}</h1>
            </div>
            <Card>
                <div className="px-5 py-4">
                    <PlanPicker idPrefix="periods" patientId={patientId} planId={planId} options={null} emptyText={TEXT.NO_CHOSEN_PLAN} onChange={pick} />
                </div>
            </Card>
            {!patientId || !planId ? (
                <p className="rounded-xl border border-border bg-canvas px-6 py-10 text-center text-body-sm text-muted">{TEXT.PICK_FIRST}</p>
            ) : !current ? (
                <div className="skeleton h-48 rounded-xl" />
            ) : !plan ? (
                <LoadError onRetry={() => setVersion((v) => v + 1)} />
            ) : (
                <>
                    <Stats three>
                        <Stat label={TEXT.PRICE} value={money(plan.planPrice)} />
                        <Stat label={TEXT.REACHED} value={money(plan.reachedAmount)} />
                        <Stat label={TEXT.STILL_DUE} value={money(plan.currentDue)} tone="primary" />
                    </Stats>
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
                        <div className="grid content-start gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                            {plan.periods.map((p) => (
                                <PeriodCard key={p.id} patientId={Number(patientId)} plan={plan} period={p} />
                            ))}
                        </div>
                        <Card title={TEXT.OPTION_INFO} className="self-start">
                            <div className="space-y-3 px-5 py-4 text-body-sm">
                                <OptionBadge option={plan.option} />
                                <p className="text-body">{action.line}</p>
                                {plan.option === OPTION.DEPOSIT && (
                                    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                                        <dt className="text-muted">{TEXT.DEPOSIT_REQUIRED}</dt>
                                        <dd className="num m-0 text-right text-ink">{money(plan.depositRequired)}</dd>
                                        <dt className="text-muted">{TEXT.DEPOSIT_PAID}</dt>
                                        <dd className="num m-0 text-right text-ink">{money(plan.depositPaid)}</dd>
                                        <dt className="text-muted">{TEXT.DEPOSIT_UNUSED}</dt>
                                        <dd className="num m-0 text-right text-ink">{money(plan.depositLeft)}</dd>
                                    </dl>
                                )}
                                {plan.option === OPTION.FULL && (
                                    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                                        <dt className="text-muted">{TEXT.PAID}</dt>
                                        <dd className="num m-0 text-right text-ink">{money(plan.fullPaid)}</dd>
                                    </dl>
                                )}
                                {(plan.action === ACTION.DEPOSIT || plan.action === ACTION.FULL) && (
                                    <Link to={action.to} className="btn btn-primary h-9 w-full">
                                        {action.label}
                                    </Link>
                                )}
                                {plan.option === OPTION.DEPOSIT && plan.action !== ACTION.DEPOSIT && (
                                    <Link to={getCashierRoute(ROUTES.RECEPTION_DEPOSITS, { patient: patientId, plan: planId })} className="btn btn-secondary h-9 w-full">
                                        {TEXT.LEDGER}
                                    </Link>
                                )}
                            </div>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
};

export default CashierPeriods;

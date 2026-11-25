import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import BackLink from "@/components/navigation/BackLink";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import { money } from "@/components/reception/receptionUtils";
import { LoadError, PageSkeleton, Stat, Stats } from "@/components/cashier/cashierUi";
import PlanAccountCard from "@/components/cashier/PlanAccountCard";
import VisitAccountCard from "@/components/cashier/VisitAccountCard";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { getPaymentAccount } from "@/services/cashierService";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { safeListSearch } from "@/utils/patientRecord";
import { ROUTES } from "@/utils/routes";

// Hồ sơ thanh toán: what one patient owes, plan by plan, and walk-ins still owing; each card has its next step
const CashierAccount = () => {
    const { patientId } = useParams();
    const location = useLocation();
    const [result, setResult] = useState(null);
    const [version, setVersion] = useState(0);

    usePageTitle(TEXT.ACCOUNT_DOC_TITLE);

    useEffect(() => {
        let active = true;
        getPaymentAccount(patientId).then((response) => active && setResult({ key: `${patientId}|${version}`, ...response }));
        return () => {
            active = false;
        };
    }, [patientId, version]);

    const loading = result?.key !== `${patientId}|${version}`;
    const p = !loading && result?.success ? result.data : null;
    const from = location.state?.from;
    const listSearch = safeListSearch(location.state?.listSearch);
    const fromDebts = from === ROUTES.RECEPTION_DEBTS;
    const listHref = `${ROUTES.RECEPTION_PAYMENTS}${from === ROUTES.RECEPTION_PAYMENTS ? listSearch : ""}`;
    const back = fromDebts ? { to: `${ROUTES.RECEPTION_DEBTS}${listSearch}`, label: TEXT.BACK_DEBTS_LABEL } : { to: listHref, label: TEXT.BACK_LIST_LABEL };
    const crumbs = [{ label: TEXT.CRUMB }, { label: TEXT.LIST_TITLE, href: listHref }, { label: p?.name ?? TEXT.ACCOUNT_TITLE }];
    const owingVisits = p?.visits.filter((v) => v.remaining > 0) ?? [];

    return (
        <div className="app-content min-h-full space-y-5">
            <div>
                <div className="mb-2 flex items-center gap-3">
                    <BackLink to={back.to} label={back.label} />
                    <Breadcrumb items={crumbs} className="min-w-0 flex-wrap wrap-anywhere" />
                </div>
                <h1 className="page-title">{TEXT.ACCOUNT_TITLE}</h1>
                {p && (
                    <p className="page-description">
                        <b className="text-ink">{p.name}</b> · <span className="num">{p.code}</span> · <span className="num">{String(p.phone ?? "").replace(/^\+84/, "0")}</span>
                    </p>
                )}
            </div>
            {loading ? (
                <PageSkeleton />
            ) : !p ? (
                <LoadError onRetry={() => setVersion((v) => v + 1)} />
            ) : (
                <>
                    <Stats>
                        <Stat label={TEXT.NOW_DUE} value={money(p.owed)} tone="primary" />
                        {p.pending > 0 && <Stat label={TEXT.PENDING_TOTAL} value={money(p.pending)} />}
                        {p.depositLeft > 0 && <Stat label={TEXT.DEPOSIT_UNUSED} value={money(p.depositLeft)} />}
                        {p.refundable > 0 && <Stat label={TEXT.DEPOSIT_REFUND} value={money(p.refundable)} />}
                    </Stats>
                    {!p.plans.length && !owingVisits.length ? (
                        <p className="rounded-xl border border-border bg-canvas px-6 py-10 text-center text-body-sm text-muted">{TEXT.NO_PLANS}</p>
                    ) : (
                        <div className="grid gap-5 xl:grid-cols-2">
                            {p.plans.length > 0 && (
                                <section className={owingVisits.length ? "space-y-3" : "space-y-3 xl:col-span-2"}>
                                    <h2 className="section-title">{TEXT.PLANS}</h2>
                                    <div className={owingVisits.length ? "grid gap-3" : "grid gap-3 xl:grid-cols-2"}>
                                        {p.plans.map((plan) => (
                                            <PlanAccountCard key={plan.id} patientId={p.id} plan={plan} />
                                        ))}
                                    </div>
                                </section>
                            )}
                            {owingVisits.length > 0 && (
                                <section className={p.plans.length ? "space-y-3" : "space-y-3 xl:col-span-2"}>
                                    <h2 className="section-title">{TEXT.VISITS}</h2>
                                    <div className={p.plans.length ? "grid gap-3" : "grid gap-3 xl:grid-cols-2"}>
                                        {owingVisits.map((v) => (
                                            <VisitAccountCard key={v.id} patientId={p.id} visit={v} />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CashierAccount;

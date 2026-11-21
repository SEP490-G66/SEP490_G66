import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import { Card } from "@/components/reception/shared";
import { money, dmy, useSubmit } from "@/components/reception/receptionUtils";
import { LabelBadge, LoadError, PageSkeleton, Stat, Stats } from "@/components/cashier/cashierUi";
import ShiftLockAlert from "@/components/cashier/ShiftLockAlert";
import useCashShiftLock from "@/components/cashier/useCashShiftLock";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { DEPOSIT_RATE, choosePaymentOption, getPlan } from "@/services/cashierService";
import { OPTION } from "@/utils/cashier";
import { cx } from "@/utils/cx";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { ROUTES, getCashierAccountRoute, getCashierRoute } from "@/utils/routes";

const OPTIONS = [OPTION.FULL, OPTION.PERIODS, OPTION.DEPOSIT];
const T = TEXT.PERIOD_TABLE;

const PeriodTable = ({ plan }) => (
    <div className="table-wrap">
        <table className="table table-stack-sm">
            <thead>
                <tr>
                    <th>{T.PERIOD}</th>
                    <th>{T.DATE}</th>
                    <th className="text-right">{T.AMOUNT}</th>
                    <th>{T.STATUS}</th>
                </tr>
            </thead>
            <tbody>
                {plan.periods.map((p) => (
                    <tr key={p.id}>
                        <td data-primary className="font-semibold text-ink">
                            {TEXT.PERIOD_LABEL(p.seq)}
                        </td>
                        <td data-label={T.DATE} className="num">
                            {dmy(p.date)}
                        </td>
                        <td data-label={T.AMOUNT} className="num text-right">
                            {money(p.amount)}
                        </td>
                        <td data-label={T.STATUS}>
                            <LabelBadge map={TEXT.PERIOD_STATUS} value={p.status} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

// Phương án thanh toán: the receptionist picks how one plan is paid; once saved it cannot change
const CashierPaymentOption = () => {
    const { patientId, planId } = useParams();
    const navigate = useNavigate();
    const lock = useCashShiftLock();
    const [result, setResult] = useState(null);
    const [version, setVersion] = useState(0);
    const [choice, setChoice] = useState(OPTION.PERIODS);

    usePageTitle(TEXT.OPTION_DOC_TITLE);

    useEffect(() => {
        let active = true;
        getPlan({ patientId, planId }).then((response) => active && setResult({ key: `${patientId}|${planId}|${version}`, ...response }));
        return () => {
            active = false;
        };
    }, [patientId, planId, version]);

    const loading = result?.key !== `${patientId}|${planId}|${version}`;
    const plan = !loading && result?.success ? result.data : null;
    const locked = Boolean(plan?.option);
    const shown = locked ? plan.option : choice;

    const [busy, submit] = useSubmit(async () => {
        const saved = await choosePaymentOption({ patientId: Number(patientId), planId: Number(planId), option: choice });
        if (!saved.success) {
            toast.error(saved.message);
            setVersion((v) => v + 1);
            return;
        }
        toast.success(saved.message);
        const next = {
            [OPTION.FULL]: getCashierRoute(ROUTES.RECEPTION_COLLECT, { patient: patientId, add: `full:${planId}` }),
            [OPTION.PERIODS]: getCashierRoute(ROUTES.RECEPTION_PERIODS, { patient: patientId, plan: planId }),
            [OPTION.DEPOSIT]: getCashierRoute(ROUTES.RECEPTION_DEPOSITS, { patient: patientId, plan: planId }),
        };
        navigate(next[choice]);
    });

    const crumbs = [
        { label: TEXT.CRUMB },
        { label: TEXT.LIST_TITLE, href: ROUTES.RECEPTION_PAYMENTS },
        { label: TEXT.ACCOUNT_TITLE, href: getCashierAccountRoute(patientId) },
        { label: TEXT.OPTION_TITLE },
    ];
    const depositAmount = plan ? Math.round(plan.planPrice * (locked ? (plan.depositRate ?? 0) : DEPOSIT_RATE)) : 0;

    return (
        <div className="app-content min-h-full space-y-5">
            <div>
                <Breadcrumb items={crumbs} className="mb-2" />
                <h1 className="page-title">{TEXT.OPTION_TITLE}</h1>
                {plan && <p className="page-description">{plan.name}</p>}
            </div>
            {loading ? (
                <PageSkeleton />
            ) : !plan ? (
                <LoadError onRetry={() => setVersion((v) => v + 1)} />
            ) : (
                <>
                    <Stats three>
                        <Stat label={TEXT.PRICE} value={money(plan.planPrice)} />
                        <Stat label={TEXT.PAID} value={money(plan.paidTotal)} />
                        <Stat label={TEXT.STILL_DUE} value={money(plan.currentDue)} tone="primary" />
                    </Stats>
                    {locked && (
                        <div role="status" className="alert alert-info">
                            {TEXT.ALREADY_CHOSEN(TEXT.OPTIONS[plan.option])}
                        </div>
                    )}
                    <div className="grid gap-5 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
                        <fieldset className="space-y-3" disabled={locked}>
                            <legend className="section-title mb-3">{TEXT.PICK_OPTION}</legend>
                            {OPTIONS.map((option) => (
                                <label
                                    key={option}
                                    className={cx(
                                        "flex cursor-pointer items-start gap-3 rounded-xl border bg-canvas px-4 py-3.5",
                                        shown === option ? "border-primary bg-primary-softer" : "border-border hover:border-primary/50",
                                        locked && shown !== option && "opacity-50",
                                    )}
                                >
                                    <input type="radio" name="payment-option" className="mt-1" value={option} checked={shown === option} onChange={() => setChoice(option)} />
                                    <span>
                                        <b className="block text-body-sm text-ink">{TEXT.OPTIONS[option]}</b>
                                        <span className="text-caption text-muted">{TEXT.OPTION_HINT[option]}</span>
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                        <Card title={`${TEXT.PREVIEW}: ${TEXT.OPTIONS[shown]}`}>
                            <div className="space-y-4 px-5 py-4">
                                {shown === OPTION.FULL && (
                                    <>
                                        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-body-sm">
                                            <dt className="text-muted">{TEXT.PRICE}</dt>
                                            <dd className="num m-0 text-right text-ink">{money(plan.planPrice)}</dd>
                                            <dt className="font-semibold text-ink">{TEXT.COLLECT_NOW}</dt>
                                            <dd className="num m-0 text-right font-heading text-heading-3 font-bold text-ink">
                                                {money(locked ? plan.fullCeiling : plan.planPrice - plan.paidTotal)}
                                            </dd>
                                        </dl>
                                        <p className="text-caption text-muted">{TEXT.EXTRA_SEPARATE}</p>
                                    </>
                                )}
                                {shown === OPTION.DEPOSIT && (
                                    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-body-sm">
                                        <dt className="text-muted">{TEXT.DEPOSIT_RATE}</dt>
                                        <dd className="num m-0 text-right text-ink">{Math.round((locked ? plan.depositRate : DEPOSIT_RATE) * 100)}%</dd>
                                        <dt className="font-semibold text-ink">{TEXT.DEPOSIT_AMOUNT}</dt>
                                        <dd className="num m-0 text-right font-heading text-heading-3 font-bold text-ink">{money(depositAmount)}</dd>
                                    </dl>
                                )}
                                {shown !== OPTION.FULL && <PeriodTable plan={plan} />}
                                {shown === OPTION.DEPOSIT && <p className="text-caption text-muted">{TEXT.DEPOSIT_AUTO}</p>}
                            </div>
                            {!locked && (
                                <div className="space-y-3 border-t border-border px-5 py-4">
                                    <ShiftLockAlert lock={lock} />
                                    <div className="flex flex-wrap items-center justify-end gap-3">
                                        <span className="mr-auto text-caption text-muted">{TEXT.OPTION_LOCK_NOTE}</span>
                                        <button type="button" className="btn btn-primary" disabled={!lock.open || busy} onClick={submit}>
                                            {busy && <span className="btn-spinner" aria-hidden />}
                                            {TEXT.CONFIRM_OPTION}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
};

export default CashierPaymentOption;

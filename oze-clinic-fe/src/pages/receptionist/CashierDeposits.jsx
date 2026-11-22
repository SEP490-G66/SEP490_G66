import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import { Card } from "@/components/reception/shared";
import { money, useSubmit } from "@/components/reception/receptionUtils";
import { LoadError, Stat, Stats } from "@/components/cashier/cashierUi";
import DepositLedger from "@/components/cashier/DepositLedger";
import MoneyInput from "@/components/cashier/MoneyInput";
import PaymentMethodFields from "@/components/cashier/PaymentMethodFields";
import PlanPicker from "@/components/cashier/PlanPicker";
import ShiftLockAlert from "@/components/cashier/ShiftLockAlert";
import useCashShiftLock from "@/components/cashier/useCashShiftLock";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { getPlan, getReceipts, receiveDeposit, setReceiptStatus } from "@/services/cashierService";
import { METHOD, OPTION, RECEIPT_STATUS } from "@/utils/cashier";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";

const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.DEPOSIT_TITLE }];

// Đặt cọc dịch vụ: deposit of a plan on the "Đặt cọc" option; the amount owed is worked out (R11), paying in parts is fine
const CashierDeposits = () => {
    const [params, setParams] = useSearchParams();
    const patientId = params.get("patient") ?? "";
    const planId = params.get("plan") ?? "";
    const lock = useCashShiftLock();
    const [data, setData] = useState(null);
    const [version, setVersion] = useState(0);
    const [amount, setAmount] = useState(0);
    const [method, setMethod] = useState(METHOD.CASH);
    const [reference, setReference] = useState("");
    const [note, setNote] = useState("");
    const [tried, setTried] = useState(false);

    usePageTitle(TEXT.DEPOSIT_DOC_TITLE);

    // The amount box is filled with what is still owed only when the plan changes or after a deposit is saved,
    // never when the page just reloads (confirming a receipt, a failed save)
    const refillAmount = useRef(true);
    const selection = useRef(`${patientId}|${planId}`);
    useEffect(() => {
        selection.current = `${patientId}|${planId}`;
    }, [patientId, planId]);

    const key = `${patientId}|${planId}|${version}`;
    useEffect(() => {
        if (!patientId || !planId) return undefined;
        let active = true;
        Promise.all([getPlan({ patientId, planId }), getReceipts({ patientId, planId })]).then(([plan, receipts]) => {
            if (!active) return;
            const good = plan.success && plan.data.option === OPTION.DEPOSIT;
            setData({ key, ok: good && receipts.success, wrongOption: plan.success && !good, plan: good ? plan.data : null, receipts: receipts.data ?? [] });
            if (good && refillAmount.current) {
                refillAmount.current = false;
                setAmount(plan.data.depositToPay);
            }
        });
        return () => {
            active = false;
        };
    }, [patientId, planId, key]);

    const current = data?.key === key ? data : null;
    const plan = current?.plan;
    const error = tried ? (amount <= 0 ? TEXT.AMOUNT_REQUIRED : plan && amount > plan.depositToPay ? TEXT.AMOUNT_OVER(money(plan.depositToPay)) : null) : null;

    const pick = ({ patientId: nextPatient, planId: nextPlan }, replace = false) => {
        const next = new URLSearchParams();
        if (nextPatient) next.set("patient", nextPatient);
        if (nextPlan) next.set("plan", nextPlan);
        setParams(next, { replace });
        setTried(false);
        setReference("");
        setNote("");
        refillAmount.current = true;
    };

    const [busy, submit] = useSubmit(async () => {
        setTried(true);
        if (amount <= 0 || amount > plan.depositToPay) return;
        const forSelection = `${patientId}|${planId}`;
        const saved = await receiveDeposit({ patientId: Number(patientId), planId: Number(planId), amount, method, ref: reference, note });
        if (selection.current !== forSelection) return;
        if (!saved.success) {
            toast.error(saved.message);
        } else {
            toast.success(saved.data.status === RECEIPT_STATUS.PENDING ? TEXT.DEPOSIT_SAVED_PENDING(money(amount)) : TEXT.DEPOSIT_SAVED(money(amount)));
            setReference("");
            setNote("");
            setTried(false);
            refillAmount.current = true;
        }
        setVersion((v) => v + 1);
    });

    const changeStatus = async (receipt, status) => {
        const changed = await setReceiptStatus({ patientId: Number(patientId), receiptId: receipt.id, status });
        if (changed.success) toast.success(status === RECEIPT_STATUS.CONFIRMED ? TEXT.RECEIPT_CONFIRMED : TEXT.RECEIPT_REJECTED);
        else toast.error(changed.message);
        setVersion((v) => v + 1);
    };

    const balanced = plan && plan.depositRequired === plan.depositPaid + plan.depositPending + plan.depositToPay;

    return (
        <div className="app-content min-h-full space-y-5">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.DEPOSIT_TITLE}</h1>
            </div>
            <Card>
                <div className="px-5 py-4">
                    <PlanPicker idPrefix="deposit" patientId={patientId} planId={planId} options={[OPTION.DEPOSIT]} emptyText={TEXT.NO_DEPOSIT_PLAN} onChange={pick} disabled={busy} />
                </div>
            </Card>
            {!patientId || !planId ? (
                <p className="rounded-xl border border-border bg-canvas px-6 py-10 text-center text-body-sm text-muted">{TEXT.PICK_FIRST}</p>
            ) : !current ? (
                <div className="skeleton h-48 rounded-xl" />
            ) : current.wrongOption ? (
                <p className="alert alert-info">{TEXT.NOT_DEPOSIT_PLAN}</p>
            ) : !plan ? (
                <LoadError onRetry={() => setVersion((v) => v + 1)} />
            ) : (
                <>
                    <Stats>
                        <Stat label={TEXT.PRICE} value={money(plan.planPrice)} />
                        <Stat label={TEXT.DEPOSIT_REQUIRED} value={money(plan.depositRequired)} note={`${Math.round(plan.depositRate * 100)}%`} />
                        <Stat
                            label={TEXT.DEPOSIT_PAID}
                            value={money(plan.depositPaid)}
                            note={plan.depositPending > 0 ? TEXT.DEPOSIT_PENDING_LINE(money(plan.depositPending)) : null}
                        />
                        <Stat label={TEXT.DEPOSIT_TO_PAY} value={money(plan.depositToPay)} tone="primary" />
                    </Stats>
                    {!balanced && plan.depositToPay === 0 && <div className="alert alert-info">{TEXT.DEPOSIT_NO_ROOM}</div>}
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)]">
                        <Card title={TEXT.DEPOSIT_FORM}>
                            {plan.depositToPay === 0 ? (
                                <p className="px-5 py-8 text-center text-body-sm text-muted">{balanced ? TEXT.DEPOSIT_DONE : TEXT.DEPOSIT_NO_ROOM}</p>
                            ) : (
                                <form
                                    className="space-y-4 px-5 py-4"
                                    noValidate
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        submit();
                                    }}
                                >
                                    <div className="field max-w-xs">
                                        <label htmlFor="deposit-amount" className="label label-required">
                                            {TEXT.DEPOSIT_AMOUNT}
                                        </label>
                                        <MoneyInput id="deposit-amount" value={amount} onChange={setAmount} invalid={Boolean(error)} describedBy={error ? "deposit-amount-error" : undefined} />
                                        {error && (
                                            <p id="deposit-amount-error" className="error-text">
                                                {error}
                                            </p>
                                        )}
                                    </div>
                                    <PaymentMethodFields
                                        idPrefix="deposit"
                                        method={method}
                                        onMethod={setMethod}
                                        reference={reference}
                                        onReference={setReference}
                                        note={note}
                                        onNote={setNote}
                                    />
                                    <ShiftLockAlert lock={lock} />
                                    <div className="flex justify-end">
                                        <button type="submit" className="btn btn-primary" disabled={!lock.open || busy}>
                                            {busy && <span className="btn-spinner" aria-hidden />}
                                            {TEXT.DEPOSIT_SUBMIT}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </Card>
                        <Card title={TEXT.LEDGER} className="self-start overflow-hidden">
                            <DepositLedger plan={plan} receipts={current.receipts} canWrite={lock.open} onStatus={changeStatus} />
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
};

export default CashierDeposits;

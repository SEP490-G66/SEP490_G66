import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import { Card } from "@/components/reception/shared";
import { money, dmy, useSubmit } from "@/components/reception/receptionUtils";
import { LoadError } from "@/components/cashier/cashierUi";
import { dateTimeText } from "@/components/cashier/cashierFormat";
import CollectItemPicker from "@/components/cashier/CollectItemPicker";
import CollectLines from "@/components/cashier/CollectLines";
import { lineError } from "@/components/cashier/cashierFormat";
import PaymentMethodFields from "@/components/cashier/PaymentMethodFields";
import ReceiptHistory from "@/components/cashier/ReceiptHistory";
import ReceiptView from "@/components/cashier/ReceiptView";
import ShiftLockAlert from "@/components/cashier/ShiftLockAlert";
import useCashShiftLock from "@/components/cashier/useCashShiftLock";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { collect, getCollectables, getPatientOptions, getReceipts, setReceiptStatus } from "@/services/cashierService";
import { COLLECT_KIND as KIND, LINE, METHOD, RECEIPT_STATUS, keysFromAdd } from "@/utils/cashier";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";

const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.COLLECT_TITLE }];

const labelOf = (target) => {
    if (target.kind === LINE.FULL) return TEXT.LINE_FULL(target.planName);
    if (target.kind === LINE.PERIOD) return TEXT.LINE_PERIOD(target.planName, target.seq, dmy(target.date));
    return TEXT.LINE_SERVICE(target.name, dateTimeText(target.startAt));
};

// Every line that may be added now, by key, with its plan name
const targetsOf = (collectables) =>
    collectables
        ? new Map([
              ...collectables.plans.flatMap((p) => p.targets.map((t) => [t.key, { ...t, planName: p.name }])),
              ...collectables.services.map((s) => [s.key, s]),
          ])
        : new Map();

// Names the lines of a saved receipt from the patient's plans and walk-ins
const describerOf = (patient) => (line) => {
    if (line.kind === LINE.VISIT_SERVICE) {
        const visit = patient?.visits.find((v) => v.id === line.visitId);
        const service = visit?.services.find((s) => s.id === line.serviceId);
        return service ? TEXT.LINE_SERVICE(service.name, dateTimeText(visit.startAt)) : TEXT.VISIT_LABEL;
    }
    const plan = patient?.plans.find((p) => p.id === line.planId);
    const name = plan?.name ?? TEXT.PLAN;
    if (line.kind === LINE.DEPOSIT) return `${name} · ${TEXT.LEDGER_IN}`;
    if (line.kind === LINE.FULL) return TEXT.LINE_FULL(name);
    const period = plan?.periods.find((p) => p.id === line.periodId);
    return period ? TEXT.LINE_PERIOD(name, period.seq, dmy(period.date)) : name;
};

// Ghi nhận thu tiền: one receipt for plan periods and walk-in services together (Loại only filters the pickers)
const CashierCollect = () => {
    const [params, setParams] = useSearchParams();
    const patientId = params.get("patient") ?? "";
    const lock = useCashShiftLock();
    const [patients, setPatients] = useState(null);
    const [data, setData] = useState(null);
    const [version, setVersion] = useState(0);
    const [kind, setKind] = useState(KIND.VISIT);
    const [lines, setLines] = useState([]);
    const [method, setMethod] = useState(METHOD.CASH);
    const [reference, setReference] = useState("");
    const [note, setNote] = useState("");
    const [saved, setSaved] = useState(null);

    usePageTitle(TEXT.COLLECT_DOC_TITLE);

    useEffect(() => {
        let active = true;
        getPatientOptions().then((result) => active && setPatients(result.success ? result.data : []));
        return () => {
            active = false;
        };
    }, []);

    const key = `${patientId}|${version}`;
    useEffect(() => {
        if (!patientId) return undefined;
        let active = true;
        Promise.all([getCollectables(patientId), getReceipts({ patientId })]).then(([collectables, receipts]) => {
            if (!active) return;
            setData({ key, ok: collectables.success && receipts.success, collectables: collectables.data, receipts: receipts.data ?? [] });
            // Lines asked for in ?add= are added once, when the patient's data arrives; Loại follows the first valid one
            const asked = new URLSearchParams(window.location.search).get("add");
            if (!asked || !collectables.success) return;
            const found = targetsOf(collectables.data);
            const keys = keysFromAdd(asked, collectables.data);
            if (keys.length) {
                setLines(keys.map((k) => ({ ...found.get(k), label: labelOf(found.get(k)), amount: found.get(k).ceiling })));
                setKind(found.get(keys[0]).kind === LINE.VISIT_SERVICE ? KIND.VISIT : KIND.PLAN);
            }
            const next = new URLSearchParams(window.location.search);
            next.delete("add");
            setParams(next, { replace: true });
        });
        return () => {
            active = false;
        };
    }, [patientId, key, setParams]);

    const current = data?.key === key ? data : null;
    const collectables = current?.ok ? current.collectables : null;
    const targets = useMemo(() => targetsOf(collectables), [collectables]);

    // Ceilings change after each save: keep the lines that can still take money, capped to what is left
    const liveLines = lines
        .filter((line) => targets.has(line.key))
        .map((line) => ({ ...line, ceiling: targets.get(line.key).ceiling }));
    const chosenKeys = new Set(liveLines.map((l) => l.key));
    const invalid = !liveLines.length || liveLines.some((l) => lineError(l));

    const pickPatient = (next) => {
        setLines([]);
        setKind(KIND.VISIT);
        setParams(next ? { patient: next } : {}, { replace: false });
    };

    const [busy, submit] = useSubmit(async () => {
        if (invalid) return;
        const result = await collect({
            patientId: Number(patientId),
            method,
            ref: reference,
            note,
            lines: liveLines.map((l) =>
                l.kind === LINE.VISIT_SERVICE
                    ? { kind: l.kind, visitId: l.visitId, serviceId: l.serviceId, amount: l.amount }
                    : l.kind === LINE.FULL
                      ? { kind: l.kind, planId: l.planId, amount: l.amount }
                      : { kind: l.kind, planId: l.planId, periodId: l.periodId, amount: l.amount },
            ),
        });
        if (!result.success) {
            toast.error(result.message);
            setVersion((v) => v + 1);
            return;
        }
        const total = money(liveLines.reduce((sum, l) => sum + l.amount, 0));
        toast.success(result.data.status === RECEIPT_STATUS.PENDING ? TEXT.COLLECTED_PENDING(total) : TEXT.COLLECTED(total));
        setSaved(result.data);
        setLines([]);
        setReference("");
        setNote("");
        setVersion((v) => v + 1);
    });

    const changeStatus = async (receipt, status) => {
        const result = await setReceiptStatus({ patientId: Number(patientId), receiptId: receipt.id, status });
        if (result.success) toast.success(status === RECEIPT_STATUS.CONFIRMED ? TEXT.RECEIPT_CONFIRMED : TEXT.RECEIPT_REJECTED);
        else toast.error(result.message);
        setVersion((v) => v + 1);
    };

    const patientView = collectables?.patient;
    const describe = describerOf(patientView);
    const nothing = collectables && !collectables.plans.length && !collectables.services.length;

    return (
        <div className="app-content min-h-full space-y-5">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.COLLECT_TITLE}</h1>
            </div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
                <Card className="self-start">
                    <form
                        className="space-y-5 px-5 py-5"
                        noValidate
                        onSubmit={(e) => {
                            e.preventDefault();
                            submit();
                        }}
                    >
                        <div className="field max-w-xl">
                            <label htmlFor="collect-patient" className="label">
                                {TEXT.PATIENT}
                            </label>
                            <select id="collect-patient" className="input" value={patientId} disabled={!patients} onChange={(e) => pickPatient(e.target.value)}>
                                <option value="">{TEXT.PICK_PATIENT}</option>
                                {(patients ?? []).map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} · {p.code}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {!patientId ? null : !current ? (
                            <div className="skeleton h-40 rounded-lg" />
                        ) : !collectables ? (
                            <LoadError onRetry={() => setVersion((v) => v + 1)} />
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <p className="label label-required">{TEXT.SERVICE}</p>
                                    {nothing && !liveLines.length ? (
                                        <p className="text-body-sm text-muted">{TEXT.NO_COLLECTABLE}</p>
                                    ) : (
                                        <CollectItemPicker
                                            idPrefix="collect"
                                            collectables={collectables}
                                            chosenKeys={chosenKeys}
                                            kind={kind}
                                            onKind={setKind}
                                            disabled={busy}
                                            onAdd={(target) => setLines((list) => [...list, { ...target, label: labelOf(target), amount: target.ceiling }])}
                                        />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <h2 className="label">{TEXT.CHOSEN}</h2>
                                    <CollectLines
                                        idPrefix="collect-line"
                                        lines={liveLines}
                                        disabled={busy}
                                        onAmount={(lineKey, amount) => setLines((list) => list.map((l) => (l.key === lineKey ? { ...l, amount } : l)))}
                                        onRemove={(lineKey) => setLines((list) => list.filter((l) => l.key !== lineKey))}
                                    />
                                </div>
                                <PaymentMethodFields
                                    idPrefix="collect"
                                    method={method}
                                    onMethod={setMethod}
                                    reference={reference}
                                    onReference={setReference}
                                    note={note}
                                    onNote={setNote}
                                />
                                <ShiftLockAlert lock={lock} />
                                <div className="flex justify-end">
                                    <button type="submit" className="btn btn-primary" disabled={!lock.open || busy || invalid}>
                                        {busy && <span className="btn-spinner" aria-hidden />}
                                        {TEXT.SUBMIT}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                </Card>
                {patientId && (
                    <Card title={TEXT.HISTORY} className="self-start overflow-hidden">
                        <ReceiptHistory receipts={current?.ok ? current.receipts : null} describe={describe} canWrite={lock.open} onStatus={changeStatus} />
                    </Card>
                )}
            </div>
            {saved && <ReceiptView receipt={saved} patientName={patientView?.name ?? ""} describe={describe} onClose={() => setSaved(null)} />}
        </div>
    );
};

export default CashierCollect;

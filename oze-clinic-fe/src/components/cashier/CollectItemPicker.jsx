import { useState } from "react";
import { Plus } from "lucide-react";
import { money, dmy } from "@/components/reception/receptionUtils";
import { COLLECT_KIND as KIND, LINE } from "@/utils/cashier";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { dateTimeText } from "./cashierFormat";

const targetLabel = (target) =>
    target.kind === LINE.FULL ? TEXT.FULL_TARGET(money(target.ceiling)) : TEXT.PERIOD_TARGET(target.seq, dmy(target.date), money(target.ceiling));

// One row: Loại · Dịch vụ · Mốc điều trị · + Thêm dịch vụ (like the service picker of the booking dialog).
// Loại only filters what the two selects offer; lines already added are not offered again.
const CollectItemPicker = ({ idPrefix, collectables, chosenKeys, kind, onKind, onAdd, disabled }) => {
    const [service, setService] = useState("");
    const [planId, setPlanId] = useState("");
    const [milestone, setMilestone] = useState("");

    const services = collectables.services.filter((s) => !chosenKeys.has(s.key));
    const plans = collectables.plans.map((p) => ({ ...p, free: p.targets.filter((t) => !chosenKeys.has(t.key)) })).filter((p) => p.free.length);
    const plan = plans.find((p) => String(p.id) === planId);
    const milestones = plan?.free ?? [];
    const isPlan = kind === KIND.PLAN;

    const pickedService = services.find((s) => s.key === service);
    const pickedTarget = milestones.find((t) => t.key === milestone);
    const ready = isPlan ? Boolean(pickedTarget) : Boolean(pickedService);

    const changeKind = (next) => {
        onKind(next);
        setService("");
        setPlanId("");
        setMilestone("");
    };

    const add = () => {
        if (isPlan && pickedTarget) {
            onAdd({ ...pickedTarget, planName: plan.name });
            setMilestone("");
        } else if (!isPlan && pickedService) {
            onAdd(pickedService);
            setService("");
        }
    };

    const nothing = isPlan ? !plans.length : !services.length;

    return (
        <div className="grid items-end gap-3 sm:grid-cols-2 2xl:grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="field">
                <label htmlFor={`${idPrefix}-kind`} className="label">
                    {TEXT.KIND}
                </label>
                <select id={`${idPrefix}-kind`} className="input" value={kind} disabled={disabled} onChange={(e) => changeKind(e.target.value)}>
                    <option value={KIND.VISIT}>{TEXT.KINDS.VISIT}</option>
                    <option value={KIND.PLAN}>{TEXT.KINDS.PLAN}</option>
                </select>
            </div>
            <div className="field">
                <label htmlFor={`${idPrefix}-service`} className="label">
                    {TEXT.SERVICE}
                </label>
                {isPlan ? (
                    <select
                        id={`${idPrefix}-service`}
                        className="input"
                        value={planId}
                        disabled={disabled || nothing}
                        onChange={(e) => {
                            setPlanId(e.target.value);
                            const next = plans.find((p) => String(p.id) === e.target.value);
                            setMilestone(next?.free.length === 1 ? next.free[0].key : "");
                        }}
                    >
                        <option value="">{nothing ? TEXT.NOTHING_TO_ADD : TEXT.PICK_SERVICE}</option>
                        {plans.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                ) : (
                    <select id={`${idPrefix}-service`} className="input" value={service} disabled={disabled || nothing} onChange={(e) => setService(e.target.value)}>
                        <option value="">{nothing ? TEXT.NOTHING_TO_ADD : TEXT.PICK_SERVICE}</option>
                        {services.map((s) => (
                            <option key={s.key} value={s.key}>
                                {TEXT.SERVICE_TARGET(s.name, dateTimeText(s.startAt), money(s.ceiling))}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            <div className="field">
                <label htmlFor={`${idPrefix}-milestone`} className="label">
                    {TEXT.MILESTONE}
                </label>
                <select
                    id={`${idPrefix}-milestone`}
                    className="input"
                    value={isPlan ? milestone : ""}
                    disabled={disabled || !isPlan || !plan}
                    onChange={(e) => setMilestone(e.target.value)}
                >
                    <option value="">{isPlan ? TEXT.PICK_MILESTONE : TEXT.NOT_APPLICABLE}</option>
                    {milestones.map((t) => (
                        <option key={t.key} value={t.key}>
                            {targetLabel(t)}
                        </option>
                    ))}
                </select>
            </div>
            <button type="button" className="btn btn-secondary sm:justify-self-start 2xl:justify-self-auto" disabled={disabled || !ready} onClick={add}>
                <Plus className="size-4" aria-hidden="true" /> {TEXT.ADD}
            </button>
        </div>
    );
};

export default CollectItemPicker;

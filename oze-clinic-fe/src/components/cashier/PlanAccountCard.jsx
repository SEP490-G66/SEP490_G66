import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { money, dmy } from "@/components/reception/receptionUtils";
import { ACTION } from "@/utils/cashier";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { ROUTES, getCashierRoute } from "@/utils/routes";
import { LabelBadge, OptionBadge } from "./cashierUi";
import { actionOf } from "./planActions";

// One treatment plan on the payment record: option, what is being collected, the main button, and its periods on demand
const PlanAccountCard = ({ patientId, plan }) => {
    const [open, setOpen] = useState(false);
    const listId = useId();
    const action = actionOf(patientId, plan);
    const periodsLink = getCashierRoute(ROUTES.RECEPTION_PERIODS, { patient: patientId, plan: plan.id });
    return (
        <article className="rounded-xl border border-border bg-canvas">
            <div className="flex flex-wrap items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading text-title text-ink">{plan.name}</h3>
                        <OptionBadge option={plan.option} />
                    </div>
                    <p className="text-body-sm text-body">{action.line}</p>
                    <p className="text-caption text-muted">
                        {TEXT.PRICE}: <span className="num">{money(plan.planPrice)}</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-caption text-muted">{TEXT.STILL_DUE}</p>
                    <p className="num font-heading text-heading-3 font-bold text-ink">{money(plan.currentDue)}</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
                <button type="button" className="btn btn-link mr-auto" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
                    {open ? TEXT.HIDE_PERIODS : TEXT.SHOW_PERIODS}
                </button>
                <Link to={periodsLink} className="btn btn-secondary h-9">
                    {TEXT.VIEW_PERIODS}
                </Link>
                {plan.action !== ACTION.VIEW && (
                    <Link to={action.to} className="btn btn-primary h-9">
                        {action.label}
                    </Link>
                )}
            </div>
            {open && (
                <ul id={listId} className="divide-y divide-border border-t border-border">
                    {plan.periods.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-body-sm">
                            <b className="text-ink">{TEXT.PERIOD_LABEL(p.seq)}</b>
                            <span className="num text-muted">{dmy(p.date)}</span>
                            <LabelBadge map={TEXT.PERIOD_STATUS} value={p.status} />
                            <span className="num ml-auto text-ink">{TEXT.PERIOD_LEFT(money(p.finished ? p.due : p.amount - p.fullCover))}</span>
                        </li>
                    ))}
                </ul>
            )}
        </article>
    );
};

export default PlanAccountCard;

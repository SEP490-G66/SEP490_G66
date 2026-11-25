import { Link } from "react-router-dom";
import { money, dmy } from "@/components/reception/receptionUtils";
import { OPTION } from "@/utils/cashier";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { ROUTES, getCashierRoute } from "@/utils/routes";
import { LabelBadge } from "./cashierUi";

const Row = ({ label, value, strong }) => (
    <div className="flex justify-between gap-3">
        <dt className="text-muted">{label}</dt>
        <dd className={strong ? "num m-0 font-semibold text-ink" : "num m-0 text-ink"}>{value}</dd>
    </div>
);

// One period (đợt = one treatment session) of a plan, with its money and the collect button when it can take money
const PeriodCard = ({ patientId, plan, period: p }) => {
    const isFull = plan.option === OPTION.FULL;
    return (
        <article className="flex flex-col rounded-xl border border-border bg-canvas">
            <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <h3 className="mr-auto font-heading text-title text-ink">
                    {TEXT.PERIOD_LABEL(p.seq)} · <span className="num">{dmy(p.date)}</span>
                </h3>
                <LabelBadge map={TEXT.PERIOD_STATUS} value={p.status} />
            </header>
            <dl className="flex-1 space-y-1.5 px-4 py-3 text-body-sm">
                <Row label={TEXT.PLAN_PART} value={money(p.planAmount)} />
                {p.extraAmount > 0 && <Row label={TEXT.EXTRA_PART} value={money(p.extraAmount)} />}
                <Row label={TEXT.PERIOD_PAID} value={money(p.paid + p.fullCover)} />
                {plan.option === OPTION.DEPOSIT && <Row label={TEXT.PERIOD_DEPOSIT} value={money(p.deposit)} />}
                <Row label={TEXT.PERIOD_LEFT_LABEL} value={p.finished ? money(p.due) : TEXT.DASH} strong />
            </dl>
            {isFull && p.finished && <p className="px-4 pb-3 text-caption text-muted">{TEXT.PLAN_PART}: {p.planDue === 0 ? TEXT.FULL_DONE : TEXT.FULL_WAIT}</p>}
            {p.collectable && (
                <div className="border-t border-border px-4 py-3 text-right">
                    <Link to={getCashierRoute(ROUTES.RECEPTION_COLLECT, { patient: patientId, add: `period:${p.id}` })} className="btn btn-primary h-9">
                        {isFull ? TEXT.COLLECT_EXTRA : TEXT.COLLECT}
                    </Link>
                </div>
            )}
        </article>
    );
};

export default PeriodCard;

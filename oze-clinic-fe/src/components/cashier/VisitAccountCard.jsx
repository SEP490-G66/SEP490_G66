import { Link } from "react-router-dom";
import { money } from "@/components/reception/receptionUtils";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { ROUTES, getCashierRoute } from "@/utils/routes";
import { dateTimeText } from "./cashierFormat";

// One walk-in visit that still owes money; "Thu tiền" only while some service can still take money (not all waiting)
const VisitAccountCard = ({ patientId, visit }) => (
    <article className="flex flex-wrap items-start gap-4 rounded-xl border border-border bg-canvas px-5 py-4">
        <div className="min-w-0 flex-1 space-y-1">
            <h3 className="font-heading text-title text-ink">
                {TEXT.VISIT_LABEL} · <span className="num">{dateTimeText(visit.startAt)}</span>
            </h3>
            <p className="text-body-sm text-body">{visit.services.map((s) => s.name).join(", ")}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            <div className="text-right">
                <p className="text-caption text-muted">{TEXT.STILL_DUE}</p>
                <p className="num font-heading text-heading-3 font-bold text-ink">{money(visit.remaining)}</p>
            </div>
            {visit.ceiling > 0 ? (
                <Link to={getCashierRoute(ROUTES.RECEPTION_COLLECT, { patient: patientId, add: `visit:${visit.id}` })} className="btn btn-primary h-9">
                    {TEXT.COLLECT}
                </Link>
            ) : (
                <span className="badge badge-info">{TEXT.WAITING}</span>
            )}
        </div>
    </article>
);

export default VisitAccountCard;

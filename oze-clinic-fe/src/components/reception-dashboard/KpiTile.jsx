import { Link } from "react-router-dom";
import { cx } from "@/utils/cx";

// off: the figure is not available (e.g. no cash shift open), drawn greyed out
const KpiTile = ({ to, state, label, value, unit, off }) => (
    <Link
        to={to}
        state={state}
        aria-label={`${label}: ${value} ${unit ?? ""}`.trim()}
        className="block rounded-xl border border-border bg-canvas px-4.5 py-4 shadow-xs transition hover:border-primary focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-soft focus-visible:outline-none"
    >
        <span className="block text-body-sm font-medium text-muted">{label}</span>
        <span className={cx("num mt-1.5 block text-[28px] leading-tight font-bold", off ? "text-placeholder" : "text-ink")}>
            {value}
            {unit && <small className="ml-1 text-body-sm font-semibold text-muted">{unit}</small>}
        </span>
    </Link>
);

export default KpiTile;

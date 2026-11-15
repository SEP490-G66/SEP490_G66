import { Link } from "react-router-dom";

const KpiTile = ({ to, label, value, sub }) => (
    <Link to={to} className="flex flex-col gap-1 rounded-xl border border-border bg-canvas px-4 py-3 hover:border-border-strong hover:bg-surface-tint">
        <small className="text-caption text-muted">{label}</small>
        <b className="num font-heading text-heading-2 text-ink">{value}</b>
        <span className="text-caption text-muted">{sub}</span>
    </Link>
);

export default KpiTile;

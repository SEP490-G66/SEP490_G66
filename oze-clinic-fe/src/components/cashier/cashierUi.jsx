import { cx } from "@/utils/cx";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";

// Small pieces shared by the cashier pages

export const Stat = ({ label, value, note, tone }) => (
    <div className={cx("rounded-xl border border-border bg-canvas px-4 py-3.5", tone === "primary" && "border-primary/40 bg-primary-softer")}>
        <p className="stat-label">{label}</p>
        <p className="num mt-1 font-heading text-heading-3 font-bold text-ink">{value}</p>
        {note && <p className="mt-0.5 text-caption text-muted">{note}</p>}
    </div>
);

// three = three tiles in a row on wide screens instead of four
export const Stats = ({ children, three }) => <div className={cx("grid gap-3 sm:grid-cols-2", three ? "xl:grid-cols-3" : "xl:grid-cols-4")}>{children}</div>;

export const LabelBadge = ({ map, value }) => {
    const [label, tone] = map[value] ?? [value, "badge-neutral"];
    return <span className={cx("badge", tone)}>{label}</span>;
};

export const OptionBadge = ({ option }) => (
    <span className={cx("badge", option ? "badge-info" : "badge-neutral")}>{option ? TEXT.OPTIONS[option] : TEXT.NO_OPTION}</span>
);

export const LoadError = ({ onRetry }) => (
    <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
        <span className="flex-1">{TEXT.LOAD_ERROR}</span>
        <button type="button" className="btn btn-secondary h-9" onClick={onRetry}>
            {TEXT.RETRY}
        </button>
    </div>
);

export const PageSkeleton = () => (
    <div className="space-y-3" aria-busy="true">
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
    </div>
);

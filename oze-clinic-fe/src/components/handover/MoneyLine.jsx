import { cx } from "@/utils/cx";

const MoneyLine = ({ label, children, strong }) => (
    <div className="flex items-center justify-between gap-4 py-0.5 text-body-sm">
        <dt className="text-muted">{label}</dt>
        <dd className={cx("num m-0 text-right", strong ? "font-semibold text-ink" : "text-body")}>{children}</dd>
    </div>
);

export default MoneyLine;

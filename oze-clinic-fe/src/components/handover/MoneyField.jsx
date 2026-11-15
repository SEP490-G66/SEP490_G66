import { formatMoneyInput } from "@/utils/cashShift";
import { cx } from "@/utils/cx";

const MoneyField = ({ id, value, onChange, invalid, describedBy }) => (
    <div className="relative">
        <input
            id={id}
            className={cx("input num pr-8 text-right", invalid && "border-danger")}
            inputMode="numeric"
            autoComplete="off"
            value={formatMoneyInput(value)}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-muted">
            ₫
        </span>
    </div>
);

export default MoneyField;

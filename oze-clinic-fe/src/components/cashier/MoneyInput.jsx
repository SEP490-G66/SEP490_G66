import { cx } from "@/utils/cx";
import { parseMoney } from "@/utils/cashier";

// Whole-đồng amount box: shows 4.000.000 while typing, hands back a number (0 when empty)
const MoneyInput = ({ id, value, onChange, disabled, invalid, describedBy, label, className }) => (
    <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={describedBy}
        className={cx("input num text-right", invalid && "input-error", className)}
        value={value ? value.toLocaleString("vi-VN") : ""}
        disabled={disabled}
        onChange={(event) => onChange(parseMoney(event.target.value))}
    />
);

export default MoneyInput;

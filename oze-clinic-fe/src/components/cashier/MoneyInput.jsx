import { useLayoutEffect, useRef } from "react";
import { cx } from "@/utils/cx";
import { parseMoney } from "@/utils/cashier";

// Position in `text` just after the n-th digit (0 = before every digit)
const caretAfterDigits = (text, n) => {
    if (n <= 0) return 0;
    let seen = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (/\d/.test(text[i])) seen += 1;
        if (seen === n) return i + 1;
    }
    return text.length;
};

// Whole-đồng amount box: shows 4.000.000 while typing, hands back a number (0 when empty).
// The caret keeps its place among the digits when the dots move, so editing in the middle works.
const MoneyInput = ({ id, value, onChange, disabled, invalid, describedBy, label, className }) => {
    const input = useRef(null);
    const digitsBeforeCaret = useRef(null);
    const text = value ? value.toLocaleString("vi-VN") : "";

    useLayoutEffect(() => {
        if (digitsBeforeCaret.current === null || document.activeElement !== input.current) return;
        const at = caretAfterDigits(text, digitsBeforeCaret.current);
        input.current.setSelectionRange(at, at);
        digitsBeforeCaret.current = null;
    }, [text]);

    return (
        <input
            ref={input}
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label={label}
            aria-invalid={invalid ? "true" : undefined}
            aria-describedby={describedBy}
            className={cx("input num text-right", invalid && "input-error", className)}
            value={text}
            disabled={disabled}
            onChange={(event) => {
                const raw = event.target.value;
                const caret = event.target.selectionStart ?? raw.length;
                // Leading zeros vanish once parsed, so they do not count
                digitsBeforeCaret.current = raw.slice(0, caret).replace(/\D/g, "").replace(/^0+/, "").length;
                onChange(parseMoney(raw));
            }}
        />
    );
};

export default MoneyInput;

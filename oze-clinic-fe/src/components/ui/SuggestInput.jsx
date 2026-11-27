import { useId, useState } from "react";
import { cx } from "@/utils/cx";

const MAX_SHOWN = 8;

// Lower case without accents, so "viem loi" finds "Viêm lợi"
const searchKey = (text) =>
    String(text ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase()
        .trim();

// Text box that suggests while typing (ARIA combobox), not a dropdown: the doctor can type anything; the list only helps.
// options: [{ value, label?, detail? }] — value is what goes into the box, label (optional) is shown beside it,
// detail (optional) is searched too (e.g. the group of an ICD-10 code). Matches anywhere in value, label or detail,
// with or without accents. ↑/↓ move, Enter picks, Esc closes. Other props go to the <input> (id, placeholder, aria-*).
const SuggestInput = ({ value, onChange, options, className, maxShown = MAX_SHOWN, onKeyDown, ...inputProps }) => {
    const listId = useId();
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);

    const key = searchKey(value);
    const matches = (
        key
            ? options.filter((option) => [option.value, option.label, option.detail].some((text) => searchKey(text).includes(key)))
            : options
    ).slice(0, maxShown);
    // The exact text is already in the box: nothing left to suggest
    const shown = open && matches.length > 0 && !(matches.length === 1 && searchKey(matches[0].value) === key);
    const optionId = (index) => `${listId}-${index}`;

    const pick = (option) => {
        onChange(option.value);
        setOpen(false);
        setActive(-1);
    };

    const handleKeyDown = (event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!shown) {
                setOpen(true);
                setActive(0);
                return;
            }
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((current) => (current + step + matches.length) % matches.length);
            return;
        }
        if (event.key === "Enter" && shown && active >= 0) {
            event.preventDefault();
            pick(matches[active]);
            return;
        }
        if (event.key === "Escape" && shown) {
            event.preventDefault();
            setOpen(false);
            return;
        }
        onKeyDown?.(event);
    };

    return (
        <div className="relative">
            <input
                {...inputProps}
                className={cx("input", className)}
                role="combobox"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={shown}
                aria-controls={listId}
                aria-activedescendant={shown && active >= 0 ? optionId(active) : undefined}
                value={value}
                onChange={(event) => {
                    onChange(event.target.value);
                    setOpen(true);
                    setActive(-1);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={handleKeyDown}
            />
            <ul
                id={listId}
                role="listbox"
                className={cx(
                    "absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-canvas py-1 shadow-lg",
                    !shown && "hidden",
                )}
            >
                {shown &&
                    matches.map((option, index) => (
                        <li
                            key={option.value}
                            id={optionId(index)}
                            role="option"
                            aria-selected={index === active}
                            className={cx("flex cursor-pointer items-baseline gap-2 px-3 py-2 text-body-sm hover:bg-surface-tint", index === active && "bg-surface-tint")}
                            // mousedown, not click: the input would lose focus and close the list first
                            onMouseDown={(event) => {
                                event.preventDefault();
                                pick(option);
                            }}
                        >
                            <span className={cx("shrink-0", option.label ? "num font-semibold text-ink" : "text-ink")}>{option.value}</span>
                            {option.label && <span className="min-w-0 text-body">{option.label}</span>}
                        </li>
                    ))}
            </ul>
        </div>
    );
};

export default SuggestInput;

import { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/utils/cx";
import { normalizeText } from "@/utils/format";

const TONES = {
    danger: { count: "bg-danger-soft text-danger", checked: "border-danger bg-danger-soft", accent: "accent-danger" },
    warning: { count: "bg-warning-soft text-warning", checked: "border-primary bg-primary-soft", accent: "accent-primary" },
    neutral: { count: "bg-surface-tint text-body", checked: "border-primary bg-primary-soft", accent: "accent-primary" },
};

// Options of the list plus items typed by the doctor, without duplicates.
const allOptions = (options, value) => [...options, ...value.filter((item) => !options.some((option) => normalizeText(option) === normalizeText(item)))];

// One collapsible group of the medical history (Dị ứng, Bệnh nền…): tick items, or type one that is not listed.
// Collapsed, the head shows the ticked items. readOnly: the group still opens and closes, nothing can be ticked or added.
const HistoryChecklist = ({ title, options = [], value = [], onChange, tone = "neutral", placeholder, note, defaultOpen = true, locked, itemNotes, maxLength, emptyError, otherLabel, readOnly = false }) => {
    const panelId = useId();
    const inputId = useId();
    const errorId = useId();
    const [open, setOpen] = useState(defaultOpen);
    const [draft, setDraft] = useState("");
    const [draftError, setDraftError] = useState(false);
    const [other, setOther] = useState({ on: false, text: "", added: null });
    const otherRef = useRef(null);
    const isLocked = (item) => Boolean(locked?.includes(item));
    const colors = TONES[tone] ?? TONES.neutral;
    const items = allOptions(options, value).filter((item) => item !== other.added);
    const isChecked = (item) => value.includes(item);

    const toggle = (item) => {
        if (isLocked(item)) return;
        onChange?.(isChecked(item) ? value.filter((entry) => entry !== item) : [...value, item]);
    };

    const addDraft = () => {
        const text = draft.trim();
        if (!text) {
            if (emptyError) setDraftError(true);
            return;
        }
        const existing = items.find((item) => normalizeText(item) === normalizeText(text));
        if (!existing) onChange?.([...value, text]);
        else if (!isChecked(existing)) onChange?.([...value, existing]);
        setDraft("");
    };

    const changeOther = (on, text) => {
        const rest = other.added ? value.filter((entry) => entry !== other.added) : value;
        const typed = on ? text.trim() : "";
        const known = typed ? rest.find((entry) => normalizeText(entry) === normalizeText(typed)) : null;
        const added = typed && !known ? typed : null;
        setOther({ on, text: on ? text : "", added });
        onChange?.(added ? [...rest, added] : rest);
    };

    return (
        <div className="rounded-[10px] border border-border px-3.5 pt-3 pb-3.5">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                className="flex w-full cursor-pointer items-center gap-2 rounded text-left outline-none focus-visible:shadow-focus"
                onClick={() => setOpen((current) => !current)}
            >
                <span className="font-semibold text-ink">{title}</span>
                <span className={cx("num shrink-0 rounded-full px-2 py-0.5 text-caption font-medium", value.length ? colors.count : TONES.neutral.count)}>
                    {value.length ? `${value.length} mục` : "Không có"}
                </span>
                <span className="ml-auto min-w-0 truncate text-caption text-muted">{!open && value.join(", ")}</span>
                <ChevronDown className={cx("size-5 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
            </button>

            {open && (
                <div id={panelId} className="mt-2.5 flex flex-col gap-2.5">
                    <fieldset disabled={readOnly}>
                        <legend className="sr-only">{title}</legend>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {items.map((item) => {
                                const checked = isChecked(item);
                                const itemLocked = isLocked(item);
                                const itemNote = itemNotes?.[item];
                                return (
                                    <label
                                        key={item}
                                        className={cx(
                                            "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-caption transition-colors",
                                            checked ? cx(colors.checked, "font-medium text-ink") : "border-border bg-canvas text-body",
                                            !readOnly && "cursor-pointer hover:border-primary",
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            className={cx("size-4 shrink-0", colors.accent)}
                                            checked={checked}
                                            disabled={itemLocked || undefined}
                                            onChange={() => toggle(item)}
                                        />
                                        <span className="min-w-0 break-words">
                                            {item}
                                            {itemNote && <span className="block text-caption font-normal text-muted">{itemNote}</span>}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>
                    {note && <p className="text-caption text-muted">{note}</p>}
                    {readOnly ? null : otherLabel ? (
                        <div className="flex items-center gap-2">
                            <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-body-sm">
                                <input
                                    type="checkbox"
                                    className={cx("size-4", colors.accent)}
                                    checked={other.on}
                                    onChange={(event) => {
                                        changeOther(event.target.checked, other.text);
                                        if (event.target.checked) setTimeout(() => otherRef.current?.focus(), 0);
                                    }}
                                />
                                {otherLabel}
                            </label>
                            <input
                                ref={otherRef}
                                id={inputId}
                                className="input min-w-0 flex-1 disabled:bg-surface-muted"
                                aria-label={placeholder}
                                placeholder={placeholder}
                                value={other.text}
                                maxLength={maxLength}
                                disabled={!other.on}
                                onChange={(event) => changeOther(true, event.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <label htmlFor={inputId} className="sr-only">
                                Thêm mục khác vào {title}
                            </label>
                            <input
                                id={inputId}
                                className="input min-w-0 flex-1"
                                placeholder={placeholder}
                                value={draft}
                                maxLength={maxLength}
                                aria-invalid={draftError ? "true" : undefined}
                                aria-describedby={draftError ? errorId : undefined}
                                onChange={(event) => {
                                    setDraft(event.target.value);
                                    if (draftError) setDraftError(false);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key !== "Enter") return;
                                    event.preventDefault();
                                    addDraft();
                                }}
                            />
                            <button type="button" className="btn btn-secondary shrink-0" disabled={emptyError ? undefined : !draft.trim()} onClick={addDraft}>
                                + Thêm
                            </button>
                        </div>
                    )}
                    {!readOnly && !otherLabel && draftError && (
                        <p id={errorId} className="error-text">
                            {emptyError}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default HistoryChecklist;

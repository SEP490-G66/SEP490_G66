import { X } from "lucide-react";
import { money } from "@/components/reception/receptionUtils";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import MoneyInput from "./MoneyInput";
import { lineError } from "./cashierFormat";

// The lines of this receipt: each with what is left, the amount taken now (lower it to take part), and a remove button
const CollectLines = ({ idPrefix, lines, onAmount, onRemove, disabled }) => {
    if (!lines.length) return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-body-sm text-muted">{TEXT.CHOSEN_EMPTY}</p>;
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    return (
        <div className="rounded-lg border border-border">
            <ul className="divide-y divide-border">
                {lines.map((line) => {
                    const error = lineError(line);
                    const inputId = `${idPrefix}-${line.key.replace(/:/g, "-")}`;
                    return (
                        <li key={line.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:gap-x-4">
                            <div className="col-span-2 min-w-0 sm:col-span-1">
                                <p className="text-body-sm font-medium text-ink">{line.label}</p>
                                <p className="num text-caption text-muted">{TEXT.LINE_LEFT(money(line.ceiling))}</p>
                            </div>
                            <div>
                                <MoneyInput
                                    id={inputId}
                                    label={`${TEXT.LINE_AMOUNT} – ${line.label}`}
                                    value={line.amount}
                                    onChange={(amount) => onAmount(line.key, amount)}
                                    invalid={Boolean(error)}
                                    describedBy={error ? `${inputId}-error` : undefined}
                                    disabled={disabled}
                                />
                                {error && (
                                    <p id={`${inputId}-error`} className="error-text">
                                        {error}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary btn-icon justify-self-end"
                                aria-label={TEXT.REMOVE(line.label)}
                                disabled={disabled}
                                onClick={() => onRemove(line.key)}
                            >
                                <X className="size-4" aria-hidden="true" />
                            </button>
                        </li>
                    );
                })}
            </ul>
            <div className="flex items-center justify-between border-t border-border bg-surface-tint px-4 py-3">
                <span className="font-semibold text-ink">{TEXT.TOTAL}</span>
                <b className="num font-heading text-heading-3 text-ink">{money(total)}</b>
            </div>
        </div>
    );
};

export default CollectLines;

import { useState } from "react";
import { Card } from "@/components/reception/shared";
import { money } from "@/components/reception/receptionUtils";
import DiffChip from "./DiffChip";
import MoneyField from "./MoneyField";
import MoneyLine from "./MoneyLine";
import ShiftFigures from "./ShiftFigures";
import { DENOMINATIONS, denominationTotal, parseMoney } from "@/utils/cashShift";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const ShiftClosePanel = ({ openingCash, cashNet, system, onRequestClose, className }) => {
    const [cash, setCash] = useState("");
    const [byNote, setByNote] = useState(false);
    const [counts, setCounts] = useState({});
    const [note, setNote] = useState("");
    const [errors, setErrors] = useState({});

    const actualCash = byNote ? denominationTotal(counts) : parseMoney(cash);
    const diffCash = actualCash == null ? null : actualCash - system.cash;
    const needsNote = Boolean(diffCash);
    const clear = (key) => setErrors((e) => ({ ...e, [key]: undefined }));

    const request = (print) => {
        const next = {};
        if (actualCash == null) next.cash = TEXT.ERR_CASH;
        if (needsNote && note.trim().length < TEXT.NOTE_MIN) next.note = TEXT.ERR_NOTE;
        setErrors(next);
        const first = next.cash ? (byNote ? `hc-note-${DENOMINATIONS[0]}` : "hc-cash") : next.note ? "hc-note" : null;
        if (first) {
            document.getElementById(first)?.focus();
            return;
        }
        onRequestClose(
            {
                countedCash: actualCash,
                denominations: byNote ? Object.fromEntries(DENOMINATIONS.map((d) => [d, Number(counts[d]) || 0])) : null,
                notes: note.trim(),
            },
            print,
        );
    };

    return (
        <Card title={TEXT.COUNT_PANEL} className={className}>
            <div className="space-y-4 px-5 py-5">
                <ShiftFigures openingCash={openingCash} cashNet={cashNet} expectedCash={system.cash} />
                <div className="field">
                    <label htmlFor={byNote ? `hc-note-${DENOMINATIONS[0]}` : "hc-cash"} className="label label-required">
                        {TEXT.ACTUAL_CASH}
                    </label>
                    {byNote ? (
                        <div className="space-y-1.5">
                            {DENOMINATIONS.map((d) => (
                                <div key={d} className="grid grid-cols-[5.5rem_auto_4.5rem_1fr] items-center gap-2 text-body-sm">
                                    <span className="num text-right text-body">{d.toLocaleString("vi-VN")}</span>
                                    <span className="text-muted" aria-hidden="true">
                                        ×
                                    </span>
                                    <input
                                        id={`hc-note-${d}`}
                                        className="input num h-8 px-2 text-right"
                                        inputMode="numeric"
                                        maxLength={4}
                                        aria-label={TEXT.NOTE_COUNT(money(d))}
                                        value={counts[d] ?? ""}
                                        onChange={(e) => {
                                            setCounts((c) => ({ ...c, [d]: e.target.value.replace(/\D/g, "").slice(0, 4) }));
                                            clear("cash");
                                        }}
                                    />
                                    <b className="num text-right font-medium text-ink">{money(d * (Number(counts[d]) || 0))}</b>
                                </div>
                            ))}
                            <div className="flex justify-between border-t border-border pt-1.5 text-body-sm font-semibold text-ink">
                                <span>{TEXT.TOTAL}</span>
                                <span className="num">{money(actualCash ?? 0)}</span>
                            </div>
                        </div>
                    ) : (
                        <MoneyField
                            id="hc-cash"
                            value={cash}
                            invalid={Boolean(errors.cash)}
                            describedBy={errors.cash ? "hc-cash-error" : undefined}
                            onChange={(v) => {
                                setCash(v);
                                clear("cash");
                            }}
                        />
                    )}
                    <button type="button" className="btn-link w-fit text-label print:hidden" onClick={() => setByNote((v) => !v)}>
                        {byNote ? TEXT.ENTER_TOTAL : TEXT.COUNT_BY_NOTE}
                    </button>
                    {errors.cash && (
                        <p id="hc-cash-error" className="error-text">
                            {errors.cash}
                        </p>
                    )}
                </div>
                <dl>
                    <MoneyLine label={TEXT.DIFF}>
                        <DiffChip value={diffCash} />
                    </MoneyLine>
                </dl>
                <div className="field">
                    <label htmlFor="hc-note" className={cx("label", needsNote && "label-required")}>
                        {TEXT.NOTE}
                    </label>
                    <textarea
                        id="hc-note"
                        rows={3}
                        maxLength={500}
                        className={cx("input py-2", errors.note && "border-danger")}
                        aria-invalid={errors.note ? true : undefined}
                        aria-describedby={errors.note ? "hc-note-error" : undefined}
                        value={note}
                        onChange={(e) => {
                            setNote(e.target.value);
                            clear("note");
                        }}
                    />
                    {errors.note && (
                        <p id="hc-note-error" className="error-text">
                            {errors.note}
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end print:hidden">
                    <button type="button" className="btn btn-secondary" onClick={() => request(false)}>
                        {TEXT.CLOSE_PANEL}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => request(true)}>
                        {TEXT.CLOSE_AND_PRINT}
                    </button>
                </div>
            </div>
        </Card>
    );
};

export default ShiftClosePanel;

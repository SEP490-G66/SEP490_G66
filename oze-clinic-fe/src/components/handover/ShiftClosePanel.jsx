import { useState } from "react";
import { Card } from "@/components/reception/shared";
import { money } from "@/components/reception/receptionUtils";
import DiffChip from "./DiffChip";
import MoneyField from "./MoneyField";
import MoneyLine from "./MoneyLine";
import { DENOMINATIONS, denominationTotal, parseMoney } from "@/utils/cashShift";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const ShiftClosePanel = ({ openingCash, system, onRequestClose }) => {
    const [cash, setCash] = useState("");
    const [transfer, setTransfer] = useState("");
    const [byNote, setByNote] = useState(false);
    const [counts, setCounts] = useState({});
    const [note, setNote] = useState("");
    const [errors, setErrors] = useState({});

    const actualCash = byNote ? denominationTotal(counts) : parseMoney(cash);
    const actualTransfer = parseMoney(transfer);
    const diffCash = actualCash == null ? null : actualCash - system.cash;
    const diffTransfer = actualTransfer == null ? null : actualTransfer - system.transfer;
    const needsNote = Boolean(diffCash || diffTransfer);
    const clear = (key) => setErrors((e) => ({ ...e, [key]: undefined }));

    const request = (print) => {
        const next = {};
        if (actualCash == null) next.cash = TEXT.ERR_CASH;
        else if (actualTransfer == null) next.transfer = TEXT.ERR_TRANSFER;
        if (needsNote && !note.trim()) next.note = TEXT.ERR_NOTE;
        setErrors(next);
        const first = next.cash ? (byNote ? `hc-note-${DENOMINATIONS[0]}` : "hc-cash") : next.transfer ? "hc-transfer" : next.note ? "hc-note" : null;
        if (first) {
            document.getElementById(first)?.focus();
            return;
        }
        onRequestClose(
            {
                countedCash: actualCash,
                countedTransfer: actualTransfer,
                denominations: byNote ? Object.fromEntries(DENOMINATIONS.map((d) => [d, Number(counts[d]) || 0])) : null,
                notes: note.trim(),
            },
            print,
        );
    };

    return (
        <Card title={TEXT.CLOSE_PANEL}>
            <div className="grid gap-6 px-5 py-5 lg:grid-cols-3">
                <div className="lg:border-r lg:border-border lg:pr-6">
                    <h3 className="mb-2 text-label font-semibold text-ink">{TEXT.CASH}</h3>
                    <dl>
                        <MoneyLine label={TEXT.OPENING}>{money(openingCash)}</MoneyLine>
                        <MoneyLine label={TEXT.SYSTEM_END} strong>
                            {money(system.cash)}
                        </MoneyLine>
                    </dl>
                    <div className="field mt-3">
                        <label htmlFor={byNote ? `hc-note-${DENOMINATIONS[0]}` : "hc-cash"} className="label label-required">
                            {TEXT.ACTUAL}
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
                                            aria-label={TEXT.NOTE_COUNT(money(d))}
                                            value={counts[d] ?? ""}
                                            onChange={(e) => {
                                                setCounts((c) => ({ ...c, [d]: e.target.value.replace(/\D/g, "") }));
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
                        <button type="button" className="btn-link w-fit text-label" onClick={() => setByNote((v) => !v)}>
                            {byNote ? TEXT.ENTER_TOTAL : TEXT.COUNT_BY_NOTE}
                        </button>
                        {errors.cash && (
                            <p id="hc-cash-error" className="error-text">
                                {errors.cash}
                            </p>
                        )}
                    </div>
                    <dl className="mt-2">
                        <MoneyLine label={TEXT.DIFF}>
                            <DiffChip value={diffCash} />
                        </MoneyLine>
                    </dl>
                </div>
                <div>
                    <h3 className="mb-2 text-label font-semibold text-ink">{TEXT.TRANSFER}</h3>
                    <dl>
                        <MoneyLine label={TEXT.SYSTEM_END} strong>
                            {money(system.transfer)}
                        </MoneyLine>
                    </dl>
                    <div className="field mt-3">
                        <label htmlFor="hc-transfer" className="label label-required">
                            {TEXT.ACTUAL_TRANSFER}
                        </label>
                        <MoneyField
                            id="hc-transfer"
                            value={transfer}
                            invalid={Boolean(errors.transfer)}
                            describedBy={errors.transfer ? "hc-transfer-error" : undefined}
                            onChange={(v) => {
                                setTransfer(v);
                                clear("transfer");
                            }}
                        />
                        <button
                            type="button"
                            className="btn-link w-fit text-label"
                            onClick={() => {
                                setTransfer(String(system.transfer));
                                clear("transfer");
                            }}
                        >
                            {TEXT.FILL_SYSTEM}
                        </button>
                        {errors.transfer && (
                            <p id="hc-transfer-error" className="error-text">
                                {errors.transfer}
                            </p>
                        )}
                    </div>
                    <dl className="mt-2">
                        <MoneyLine label={TEXT.DIFF}>
                            <DiffChip value={diffTransfer} />
                        </MoneyLine>
                    </dl>
                </div>
                <div className="self-start rounded-lg bg-surface-tint p-4">
                    <h3 className="mb-2 text-label font-semibold text-ink">{TEXT.END_TOTAL}</h3>
                    <dl>
                        <MoneyLine label={TEXT.SYSTEM}>{money(system.cash + system.transfer)}</MoneyLine>
                        <MoneyLine label={TEXT.ACTUAL} strong>
                            {actualCash == null || actualTransfer == null ? "—" : money(actualCash + actualTransfer)}
                        </MoneyLine>
                        <MoneyLine label={TEXT.DIFF}>
                            <DiffChip value={diffCash == null || diffTransfer == null ? null : diffCash + diffTransfer} />
                        </MoneyLine>
                    </dl>
                </div>
                <div className="field lg:col-span-2">
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
                <div className="flex flex-col justify-end gap-2.5">
                    <button type="button" className="btn btn-primary w-full" onClick={() => request(true)}>
                        {TEXT.CLOSE_AND_PRINT}
                    </button>
                    <button type="button" className="btn btn-secondary w-full" onClick={() => request(false)}>
                        {TEXT.CLOSE_PANEL}
                    </button>
                </div>
            </div>
        </Card>
    );
};

export default ShiftClosePanel;

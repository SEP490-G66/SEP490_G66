import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { DialogActions } from "@/components/reception/shared";
import { money, useSubmit } from "@/components/reception/receptionUtils";
import MoneyField from "./MoneyField";
import MoneyLine from "./MoneyLine";
import { parseMoney } from "@/utils/cashShift";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";

// plan: { label, staff, from, to, now, amount, source }
const ShiftOpenDialog = ({ plan, onClose, onSubmit }) => {
    const [same, setSame] = useState(true);
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const [error, setError] = useState(null);
    const [busy, submit] = useSubmit(onSubmit);

    const send = (event) => {
        event.preventDefault();
        if (same) return submit({ openingCash: plan.amount, expectedOpeningCash: plan.amount, notes: "" });
        const got = parseMoney(amount);
        if (got == null) {
            setError(["os-amount", TEXT.ERR_RECEIVED]);
            document.getElementById("os-amount")?.focus();
            return;
        }
        // Typing the same amount as expected is simply "received it all": no reason needed.
        if (got === plan.amount) return submit({ openingCash: got, expectedOpeningCash: plan.amount, notes: "" });
        if (!reason.trim()) {
            setError(["os-reason", TEXT.ERR_REASON]);
            document.getElementById("os-reason")?.focus();
            return;
        }
        const diff = got - plan.amount;
        submit({ openingCash: got, expectedOpeningCash: plan.amount, notes: TEXT.OPEN_NOTE(money(got), `${diff < 0 ? "−" : "+"}${money(Math.abs(diff))}`, reason.trim()) });
    };

    return (
        <Modal title={TEXT.OPEN_TITLE(plan.label)} description={TEXT.OPEN_SUB} onClose={onClose} closeDisabled={busy}>
            <form className="space-y-4" onSubmit={send}>
                <dl>
                    <MoneyLine label={TEXT.OPEN_STAFF}>{plan.staff}</MoneyLine>
                    <MoneyLine label={TEXT.OPEN_SHIFT_ROW}>{[plan.label, plan.from && plan.to ? `${plan.from} – ${plan.to}` : null].filter(Boolean).join(" ")}</MoneyLine>
                    <MoneyLine label={TEXT.OPEN_AT}>{plan.now}</MoneyLine>
                </dl>
                <div className="rounded-lg bg-surface-tint px-4 py-3 text-center">
                    <small className="block text-caption text-muted">{TEXT.OPENING_CASH}</small>
                    <b className="num block font-heading text-heading-3 text-ink">{money(plan.amount)}</b>
                    <small className="block text-caption text-muted">{plan.source}</small>
                </div>
                <fieldset className="space-y-2">
                    <legend className="sr-only">{TEXT.OPENING_CASH}</legend>
                    {[
                        [true, TEXT.RECEIVED_ALL(money(plan.amount))],
                        [false, TEXT.RECEIVED_OTHER],
                    ].map(([value, text]) => (
                        <label key={String(value)} className="flex cursor-pointer items-center gap-2 text-body-sm text-ink">
                            <input
                                type="radio"
                                name="os-same"
                                checked={same === value}
                                onChange={() => {
                                    setSame(value);
                                    setError(null);
                                }}
                            />
                            {text}
                        </label>
                    ))}
                </fieldset>
                {!same && (
                    <div className="space-y-3">
                        <div className="field">
                            <label htmlFor="os-amount" className="label label-required">
                                {TEXT.RECEIVED_AMOUNT}
                            </label>
                            <MoneyField
                                id="os-amount"
                                value={amount}
                                invalid={error?.[0] === "os-amount"}
                                describedBy={error?.[0] === "os-amount" ? "os-error" : undefined}
                                onChange={(v) => {
                                    setAmount(v);
                                    setError(null);
                                }}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="os-reason" className="label label-required">
                                {TEXT.RECEIVED_REASON}
                            </label>
                            <textarea
                                id="os-reason"
                                rows={2}
                                maxLength={300}
                                className="input py-2"
                                aria-invalid={error?.[0] === "os-reason" || undefined}
                                aria-describedby={error?.[0] === "os-reason" ? "os-error" : undefined}
                                value={reason}
                                onChange={(e) => {
                                    setReason(e.target.value);
                                    setError(null);
                                }}
                            />
                        </div>
                        {error && (
                            <p id="os-error" className="error-text">
                                {error[1]}
                            </p>
                        )}
                    </div>
                )}
                <DialogActions onClose={onClose} closeDisabled={busy} closeLabel={TEXT.CANCEL} submitLabel={TEXT.OPEN_SHIFT} busy={busy} />
            </form>
        </Modal>
    );
};

export default ShiftOpenDialog;

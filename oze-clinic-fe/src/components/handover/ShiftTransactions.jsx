import { useState } from "react";
import LabeledSelect from "@/components/ui/LabeledSelect";
import { Card } from "@/components/reception/shared";
import { usePaging } from "@/components/reception/receptionUtils";
import { KINDS, methodOf, signOf, signedMoney, timeOf } from "@/utils/cashShift";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";

const KIND_OPTIONS = [["", TEXT.TX_ALL_KINDS], ...KINDS.map((k) => [k, TEXT.KIND[k]])];
const METHOD_OPTIONS = [["", TEXT.TX_ALL_METHODS], ...Object.entries(TEXT.METHOD)];

const ShiftTransactions = ({ transactions }) => {
    const [kind, setKind] = useState("");
    const [method, setMethod] = useState("");
    const shown = transactions
        .filter((t) => (!kind || t.kind === kind) && (!method || methodOf(t) === method))
        .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)));
    const { pageItems, footer, setPage } = usePaging(shown, 10);
    const dash = <span className="text-muted">—</span>;
    const pick = (setter) => (value) => {
        setter(value);
        setPage(1);
    };
    return (
        <Card
            className="overflow-hidden"
            title={
                <span className="flex items-center gap-2">
                    {TEXT.TX_TITLE}
                    <span className="num rounded-full bg-surface-muted px-2 text-caption font-semibold text-body">{transactions.length}</span>
                </span>
            }
            actions={
                <span className="flex flex-wrap items-end gap-3">
                    <LabeledSelect id="hs-kind" label={TEXT.TX_KIND} value={kind} options={KIND_OPTIONS} onChange={pick(setKind)} />
                    <LabeledSelect id="hs-method" label={TEXT.TX_METHOD} value={method} options={METHOD_OPTIONS} onChange={pick(setMethod)} />
                </span>
            }
        >
            {shown.length ? (
                <div className="table-wrap rounded-none border-x-0 border-t-0">
                    <table className="table table-stack">
                        <thead>
                            <tr>
                                {TEXT.TX_COLUMNS.map((c, i) => (
                                    <th key={c} className={i >= 5 ? "text-right" : undefined}>
                                        {c}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pageItems.map((t) => {
                                const sign = signOf(t.kind);
                                return (
                                    <tr key={t.id}>
                                        <td data-label={TEXT.TX_COLUMNS[0]} className="num">
                                            {timeOf(t.occurredAt)}
                                        </td>
                                        <td data-label={TEXT.TX_COLUMNS[1]}>{t.code}</td>
                                        <td data-label={TEXT.TX_COLUMNS[2]}>{TEXT.KIND[t.kind] ?? t.kind}</td>
                                        <td data-primary className="text-ink">
                                            {t.description}
                                        </td>
                                        <td data-label={TEXT.TX_COLUMNS[4]}>{TEXT.METHOD[methodOf(t)] ?? "—"}</td>
                                        <td data-label={TEXT.TX_COLUMNS[5]} className="num text-right">
                                            {t.cashAmount ? signedMoney(sign * t.cashAmount) : dash}
                                        </td>
                                        <td data-label={TEXT.TX_COLUMNS[6]} className="num text-right">
                                            {t.transferAmount ? signedMoney(sign * t.transferAmount) : dash}
                                        </td>
                                        <td data-label={TEXT.TX_COLUMNS[7]} className="num text-right font-semibold">
                                            {signedMoney(sign * (t.cashAmount + t.transferAmount))}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="px-6 py-10 text-center text-body-sm text-muted">{TEXT.TX_EMPTY}</p>
            )}
            {footer}
        </Card>
    );
};

export default ShiftTransactions;

import { Card } from "@/components/reception/shared";
import { KINDS, signedMoney } from "@/utils/cashShift";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";

const ShiftSummary = ({ summary }) => {
    const out = (kind, value) => signedMoney(kind === "Receipt" ? value : -value);
    return (
        <Card title={TEXT.SUMMARY} className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="table whitespace-nowrap">
                    <thead>
                        <tr>
                            {TEXT.SUMMARY_COLUMNS.map((c, i) => (
                                <th key={c} className={i ? "text-right" : undefined}>
                                    {c}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {KINDS.map((kind) => {
                            const row = summary.rows[kind];
                            return (
                                <tr key={kind}>
                                    <td className="text-ink">{TEXT.KIND[kind]}</td>
                                    <td className="num text-right">{row.count}</td>
                                    <td className="num text-right">{out(kind, row.cash)}</td>
                                    <td className="num text-right">{out(kind, row.transfer)}</td>
                                    <td className="num text-right">{out(kind, row.cash + row.transfer)}</td>
                                </tr>
                            );
                        })}
                        <tr className="bg-surface-tint font-semibold text-ink">
                            <td>{TEXT.TOTAL}</td>
                            <td className="num text-right">{summary.count}</td>
                            <td className="num text-right">{signedMoney(summary.net.cash)}</td>
                            <td className="num text-right">{signedMoney(summary.net.transfer)}</td>
                            <td className="num text-right">{signedMoney(summary.net.cash + summary.net.transfer)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export default ShiftSummary;

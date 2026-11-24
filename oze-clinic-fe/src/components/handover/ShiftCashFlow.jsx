import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/reception/shared";
import { signedMoney } from "@/utils/cashShift";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";

const ShiftCashFlow = ({ net, reconLink, className }) => {
    const rows = [
        [TEXT.CASH, net.cash],
        [TEXT.TRANSFER, net.transfer],
    ];
    return (
        <Card title={TEXT.FLOW_TITLE} className={className}>
            <div className="px-5 py-4">
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                {TEXT.FLOW_COLUMNS.map((c, i) => (
                                    <th key={c} className={i ? "text-right" : undefined}>
                                        {c}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(([label, value]) => (
                                <tr key={label}>
                                    <td className="text-ink">{label}</td>
                                    <td className="num whitespace-nowrap text-right">{signedMoney(value)}</td>
                                </tr>
                            ))}
                            <tr className="bg-surface-tint font-semibold text-ink">
                                <td>{TEXT.TOTAL}</td>
                                <td className="num whitespace-nowrap text-right">{signedMoney(net.cash + net.transfer)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <dl className="mt-3 border-t border-border pt-3">
                    <div className="flex items-start justify-between gap-4 py-0.5 text-body-sm">
                        <dt className="text-muted">{TEXT.REFUNDED_TOTAL}</dt>
                        <dd className="m-0 text-right font-semibold text-warning">{TEXT.REFUND_NOT_RECORDED}</dd>
                    </div>
                </dl>
                <p className="mt-2 text-caption text-muted">{TEXT.REFUND_NOTE}</p>
                {reconLink && (
                    <div className="mt-4 flex justify-end print:hidden">
                        <Link to={reconLink} className="btn btn-secondary">
                            {TEXT.TO_RECON}
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default ShiftCashFlow;

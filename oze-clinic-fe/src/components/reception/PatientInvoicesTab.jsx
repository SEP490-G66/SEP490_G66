import LoadMoreButton from "@/components/navigation/LoadMoreButton";
import { Badge, EmptyState } from "./shared";
import { INVOICE_LABEL, dmy, money } from "./receptionUtils";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";
import { clinicDateOf } from "@/utils/patientRecord";

const C = TEXT.INVOICE_COLUMNS;

const PatientInvoicesTab = ({ items, hasMore, more, onMore }) => {
    if (items.length === 0) return <EmptyState text={TEXT.INVOICE_EMPTY} />;
    return (
        <>
            <div className="table-wrap rounded-none border-0">
                <table className="table table-stack">
                    <thead>
                        <tr>
                            <th>{C.NUMBER}</th>
                            <th>{C.DATE}</th>
                            <th className="text-right">{C.FINAL}</th>
                            <th className="text-right">{C.PAID}</th>
                            <th className="text-right">{C.REMAINING}</th>
                            <th>{C.STATUS}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((i) => (
                            <tr key={i.id}>
                                <td data-primary className="num whitespace-nowrap">
                                    {i.invoiceNumber}
                                </td>
                                <td data-label={C.DATE} className="num">
                                    {i.createdAt ? dmy(clinicDateOf(i.createdAt)) : TEXT.DASH}
                                </td>
                                <td data-label={C.FINAL} className="num text-right">
                                    {money(i.finalAmount)}
                                </td>
                                <td data-label={C.PAID} className="num text-right">
                                    {money(i.paidAmount)}
                                </td>
                                <td data-label={C.REMAINING} className={Number(i.remainingAmount) > 0 ? "num text-right text-danger" : "num text-right"}>
                                    {money(i.remainingAmount)}
                                </td>
                                <td data-label={C.STATUS}>
                                    <Badge map={INVOICE_LABEL} value={i.paymentStatus} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {hasMore && <LoadMoreButton loading={more.loading} error={more.error} onClick={onMore} label={TEXT.LOAD_MORE} retryLabel={TEXT.RETRY} errorText={TEXT.LOAD_MORE_ERROR} />}
        </>
    );
};

export default PatientInvoicesTab;

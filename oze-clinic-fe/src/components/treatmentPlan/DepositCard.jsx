import { Link } from "react-router-dom";
import DashboardSection from "@/components/dashboard/DashboardSection";
import Notice from "@/components/ui/Notice";
import { cx } from "@/utils/cx";
import { formatCurrency, formatDateTime } from "@/utils/format";
import { getPaymentHistoryRoute } from "@/utils/routes";

const TITLE_ID = "plan-deposit-title";

const InvoiceLink = ({ invoice }) => (
    <Link to={getPaymentHistoryRoute(invoice.id)} className="font-semibold text-primary hover:underline">
        {invoice.code}
    </Link>
);

// "Đặt cọc" card of a treatment plan (Figma: Chi tiết kế hoạch · đã đặt cọc / chưa đặt cọc).
// deposit: { amount, paidAt, method, status: { label, badge }, depositInvoice: { id, code }, appliedInvoice: { id, code } }
// When not paid yet (paidAt empty) it shows the amount to pay at the front desk instead.
const DepositCard = ({ deposit }) => {
    const paid = Boolean(deposit.paidAt);
    const status = deposit.status && <span className={cx("badge", deposit.status.badge)}>{deposit.status.label}</span>;

    return (
        <DashboardSection id={TITLE_ID} title="Đặt cọc" badge={status}>
            {paid ? (
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md bg-surface-tint px-4 py-3">
                        <p className="text-caption text-muted">Số tiền đặt cọc</p>
                        <p className="num mt-1 font-heading text-heading-3 text-ink">{formatCurrency(deposit.amount)}</p>
                    </div>
                    <div className="rounded-md bg-surface-tint px-4 py-3">
                        <p className="text-caption text-muted">Ngày đặt cọc · hình thức</p>
                        <p className="num mt-1 text-title text-ink">{[formatDateTime(deposit.paidAt), deposit.method].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="rounded-md bg-surface-tint px-4 py-3">
                        <p className="text-caption text-muted">Hoá đơn đặt cọc · đã trừ vào</p>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-title">
                            {deposit.depositInvoice && <InvoiceLink invoice={deposit.depositInvoice} />}
                            {deposit.appliedInvoice && (
                                <>
                                    <span aria-hidden="true">→</span>
                                    <span className="sr-only">đã trừ vào</span>
                                    <InvoiceLink invoice={deposit.appliedInvoice} />
                                </>
                            )}
                        </p>
                    </div>
                </div>
            ) : (
                <Notice tone="warning">
                    Cần đặt cọc <strong>{formatCurrency(deposit.amount)}</strong> tại quầy lễ tân trước khi lên lịch buổi điều trị đầu tiên.
                </Notice>
            )}
        </DashboardSection>
    );
};

export default DepositCard;

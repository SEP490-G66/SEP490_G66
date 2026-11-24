import { Link } from "react-router-dom";
import DashboardSection from "@/components/dashboard/DashboardSection";
import DataTable from "@/components/ui/DataTable";
import KeyValueList from "@/components/ui/KeyValueList";
import { cx } from "@/utils/cx";
import { formatCurrency, formatDate, formatDateTime } from "@/utils/format";
import { getPaymentHistoryRoute, getTreatmentPlanRoute } from "@/utils/routes";

const SERVICE_COLUMNS = [
    {
        key: "name",
        label: "Dịch vụ",
        primary: true,
        render: (line) => (
            <>
                <span className="font-semibold text-ink">{line.name}</span>
                {line.note && <span className="block text-caption text-muted">{line.note}</span>}
            </>
        ),
    },
    { key: "quantity", label: "SL", align: "center" },
    { key: "unitPrice", label: "Đơn giá", align: "right", render: (line) => formatCurrency(line.unitPrice) },
    { key: "total", label: "Thành tiền", align: "right", render: (line) => <span className="font-semibold text-ink">{formatCurrency(line.total)}</span> },
];

const PAYMENT_COLUMNS = [
    { key: "paidAt", label: "Thời gian", primary: true, render: (payment) => formatDateTime(payment.paidAt) },
    { key: "method", label: "Hình thức" },
    { key: "amount", label: "Số tiền", align: "right", render: (payment) => <span className="font-semibold text-success">{formatCurrency(payment.amount)}</span> },
];

const Line = ({ label, value, strong, className }) => (
    <div className={cx("flex items-center justify-between gap-4", className)}>
        <dt className={strong ? "font-semibold text-ink" : "text-body"}>{label}</dt>
        <dd className={cx("num", strong ? "font-semibold text-ink" : "text-ink")}>{value}</dd>
    </div>
);

// Body of an invoice page (Figma 1243:4434 "Chi tiết hoá đơn · trừ tiền cọc"), under the page header with breadcrumb.
// invoice: { code, createdAt, createdBy, payTypeLabel, plan: { id, name }, lines: [{ id, name, note, quantity, unitPrice, total }],
//            subtotal, deposit: { amount, invoice: { id, code } }, total, paid, remaining, payments: [{ id, paidAt, method, amount }] }
const InvoiceDetail = ({ invoice }) => {
    const info = [
        { label: "Ngày tạo", value: formatDate(invoice.createdAt), tone: "strong" },
        { label: "Người lập", value: invoice.createdBy, tone: "strong" },
        {
            label: "Kế hoạch",
            value: invoice.plan && (
                <Link to={getTreatmentPlanRoute(invoice.plan.id)} className="font-semibold text-primary hover:underline">
                    {invoice.plan.name}
                </Link>
            ),
        },
        { label: "Hình thức", value: invoice.payTypeLabel, tone: "strong" },
    ];

    return (
        <div className="flex flex-col gap-5">
            {invoice.remaining > 0 && (
                <div role="status" className="alert alert-danger flex-col gap-0.5">
                    <p className="alert-title num">Còn phải trả {formatCurrency(invoice.remaining)}</p>
                    <p className="text-caption">Cần thanh toán đủ trước buổi điều trị tương ứng.</p>
                </div>
            )}
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="flex flex-col gap-5">
                    <DashboardSection id="invoice-lines-title" title="Dịch vụ trong hoá đơn">
                        <DataTable columns={SERVICE_COLUMNS} rows={invoice.lines ?? []} labelledBy="invoice-lines-title" />
                        <dl className="flex flex-col gap-2.5 rounded-md bg-surface-tint p-4 text-body-sm">
                            <Line label="Tổng giá trị dịch vụ" value={formatCurrency(invoice.subtotal)} />
                            {invoice.deposit?.amount > 0 && (
                                <div className="flex items-center justify-between gap-4">
                                    <dt className="text-body">
                                        Trừ tiền đặt cọc
                                        {invoice.deposit.invoice && (
                                            <>
                                                {" · "}
                                                <Link to={getPaymentHistoryRoute(invoice.deposit.invoice.id)} className="font-semibold text-primary hover:underline">
                                                    {invoice.deposit.invoice.code}
                                                </Link>
                                            </>
                                        )}
                                    </dt>
                                    <dd className="num font-semibold text-success">− {formatCurrency(invoice.deposit.amount)}</dd>
                                </div>
                            )}
                            <Line label="Tổng phải thanh toán" value={formatCurrency(invoice.total)} strong className="border-t border-border pt-2.5" />
                            <Line label="Đã thanh toán" value={formatCurrency(invoice.paid)} />
                            <div className="flex items-center justify-between gap-4 border-t border-border pt-2.5">
                                <dt className="font-semibold text-ink">Còn phải trả</dt>
                                <dd className={cx("num font-heading text-heading-2", invoice.remaining > 0 ? "text-warning" : "text-ink")}>{formatCurrency(invoice.remaining)}</dd>
                            </div>
                        </dl>
                    </DashboardSection>
                    <DashboardSection id="invoice-payments-title" title="Giao dịch thanh toán">
                        {invoice.payments?.length > 0 ? (
                            <DataTable columns={PAYMENT_COLUMNS} rows={invoice.payments} labelledBy="invoice-payments-title" />
                        ) : (
                            <div className="rounded-md border border-dashed border-border px-4 py-6 text-center">
                                <p className="text-title text-ink">Chưa có giao dịch nào</p>
                                <p className="mt-1 text-caption text-muted">Giao dịch sẽ hiện ở đây sau khi lễ tân ghi nhận thanh toán.</p>
                            </div>
                        )}
                    </DashboardSection>
                </div>
                <DashboardSection id="invoice-info-title" title="Thông tin hoá đơn">
                    <KeyValueList items={info} />
                </DashboardSection>
            </div>
        </div>
    );
};

export default InvoiceDetail;

import { Eye, Undo2 } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import IconLinkButton from "@/components/ui/IconLinkButton";
import { cx } from "@/utils/cx";
import { formatCurrency, formatDate } from "@/utils/format";

const Dash = () => (
    <>
        <span aria-hidden="true" className="text-muted">
            —
        </span>
        <span className="sr-only">Không còn</span>
    </>
);

// "Lịch sử thanh toán · Hoá đơn" tab (Figma 1243:4177). Rows still owing money are tinted.
// invoices: [{ id, code, createdAt, content, amount, depositDeducted, remaining, status: { label, badge }, refundable }]
// invoiceHref(invoice) links the eye button to the invoice detail; onRefund opens RefundRequestCreateModal.
const InvoiceTable = ({ invoices = [], offset = 0, loading = false, labelledBy, empty = "Chưa có hoá đơn nào.", footer, invoiceHref, onRefund }) => {
    const columns = [
        { key: "stt", label: "STT", hideStack: true, render: (_, index) => offset + index + 1 },
        { key: "code", label: "Mã hoá đơn", primary: true, render: (invoice) => <span className="font-semibold text-ink">{invoice.code}</span> },
        { key: "createdAt", label: "Ngày tạo", render: (invoice) => formatDate(invoice.createdAt) },
        { key: "content", label: "Nội dung", block: true },
        {
            key: "amount",
            label: "Phải thanh toán",
            align: "right",
            render: (invoice) => (
                <div className="flex flex-col items-end">
                    <span className="num font-semibold text-ink">{formatCurrency(invoice.amount)}</span>
                    {invoice.depositDeducted > 0 && <span className="num text-caption text-muted">Đã trừ cọc {formatCurrency(invoice.depositDeducted)}</span>}
                </div>
            ),
        },
        {
            key: "remaining",
            label: "Còn phải trả",
            align: "right",
            render: (invoice) => (invoice.remaining > 0 ? <span className="num font-semibold text-danger">{formatCurrency(invoice.remaining)}</span> : <Dash />),
        },
        { key: "status", label: "Trạng thái", render: (invoice) => invoice.status && <span className={cx("badge", invoice.status.badge)}>{invoice.status.label}</span> },
        {
            key: "actions",
            label: "Thao tác",
            align: "right",
            actions: true,
            render: (invoice) => (
                <div className="flex justify-end gap-2">
                    <IconLinkButton icon={Eye} label={`Xem hoá đơn ${invoice.code}`} to={invoiceHref(invoice)} />
                    {invoice.refundable && onRefund && <IconLinkButton icon={Undo2} label={`Yêu cầu hoàn tiền hoá đơn ${invoice.code}`} onClick={() => onRefund(invoice)} />}
                </div>
            ),
        },
    ];

    return (
        <DataTable
            columns={columns}
            rows={invoices}
            labelledBy={labelledBy}
            loading={loading}
            empty={empty}
            footer={footer}
            rowClassName={(invoice) => (invoice.remaining > 0 ? "bg-warning-soft/40" : undefined)}
        />
    );
};

export default InvoiceTable;

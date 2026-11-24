import { Eye } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import IconLinkButton from "@/components/ui/IconLinkButton";
import Pagination from "@/components/ui/Pagination";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/utils/format";
import { REFUND_REQUEST_TEXT } from "@/utils/messages";
import { REFUND_PAGE_SIZE, REFUND_REQUEST_STATUS_LABELS, clinicDate } from "@/utils/refundRequest";

// Patient refund requests (Figma 1244:4636). view / pickUrl / pickState come from useRefundRequestNavigation,
// which keeps the page, filters and the open request in the URL.
const PatientRefundTable = ({ view, labelledBy, pickUrl, pickState, onPageChange }) => {
    const { list, rows, page, pages, current } = view;
    const offset = (page - 1) * REFUND_PAGE_SIZE;

    const columns = [
        { key: "stt", label: "STT", hideStack: true, render: (_, index) => offset + index + 1 },
        { key: "code", label: "Mã yêu cầu", primary: true, render: (request) => <span className="font-semibold text-ink">{request.code}</span> },
        { key: "createdAt", label: "Ngày tạo", render: (request) => clinicDate(request.createdAt) },
        {
            key: "accountName",
            label: "Nội dung",
            block: true,
            render: (request) => (
                <>
                    <span className="text-ink">{request.accountName ?? REFUND_REQUEST_TEXT.NO_VALUE}</span>
                    {request.reason && <span className="block text-caption text-muted">{request.reason}</span>}
                </>
            ),
        },
        {
            key: "refundAmount",
            label: "Số tiền hoàn",
            align: "right",
            render: (request) => (request.refundAmount != null ? <span className="num font-semibold text-ink">{formatCurrency(request.refundAmount)}</span> : <span className="text-muted">—</span>),
        },
        { key: "status", label: "Trạng thái", render: (request) => <StatusBadge status={request.status} labels={REFUND_REQUEST_STATUS_LABELS} /> },
        {
            key: "actions",
            label: "Thao tác",
            align: "right",
            actions: true,
            render: (request) => <IconLinkButton icon={Eye} label={REFUND_REQUEST_TEXT.VIEW_LABEL(request.code)} to={pickUrl(request.code)} state={pickState(request.code)} />,
        },
    ];

    const footer = list.length > 0 && (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="num">
                Hiển thị {offset + 1}–{offset + rows.length} trong {list.length} bản ghi
            </p>
            {pages > 1 && <Pagination page={page} totalPages={pages} onChange={onPageChange} label="Phân trang yêu cầu hoàn tiền" />}
        </div>
    );

    return (
        <DataTable
            columns={columns}
            rows={rows}
            rowKey="code"
            labelledBy={labelledBy}
            empty={REFUND_REQUEST_TEXT.NO_RESULT}
            footer={footer}
            rowClassName={(request) => (current?.code === request.code ? "bg-primary-softer" : undefined)}
        />
    );
};

export default PatientRefundTable;

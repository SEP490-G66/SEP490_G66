import { useParams } from "react-router-dom";
import InvoiceDetail from "@/components/paymentHistory/InvoiceDetail";
import PageHeader from "@/components/ui/PageHeader";
import PageLoadState from "@/components/ui/PageLoadState";
import StatusBadge from "@/components/ui/StatusBadge";
import useAsync from "@/hooks/useAsync";
import { getMyPaymentReceipts } from "@/services/patientBillingService";
import { parseRecordId } from "@/utils/medicalRecord";
import { BOOKING_ERROR_CODE, PAYMENT_HISTORY_STATUS } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";

const BACK = { to: ROUTES.PAYMENT_HISTORY, label: "Lịch sử thanh toán" };

// "Chi tiết hoá đơn" (Figma 1243:4434). TODO(api): who created the invoice and the deposit deducted are not returned yet.
const InvoiceDetailPage = () => {
    const { invoiceId } = useParams();
    const { loading, error, value } = useAsync(() => getMyPaymentReceipts(), []);
    let status = "ready";
    if (loading) status = "loading";
    else if (!error && value?.code === BOOKING_ERROR_CODE.PROFILE_NOT_FOUND) status = "unlinked";
    else if (error || !value?.success) status = "failed";
    const id = parseRecordId(invoiceId);
    const receipt = status === "ready" ? (value.data.items.find((item) => item.id === id) ?? null) : null;

    if (!receipt) {
        return (
            <>
                <PageHeader title="Chi tiết hoá đơn" back={BACK} />
                <PageLoadState status={status} />
                {status === "ready" && <div className="card-app empty-state py-16">Không tìm thấy hoá đơn này.</div>}
            </>
        );
    }

    const description = [receipt.date && `Tạo ngày ${receipt.date}`, receipt.title].filter(Boolean).join(" · ");

    return (
        <>
            <PageHeader
                title={`Hoá đơn ${receipt.no}`}
                crumb={receipt.no}
                badge={<StatusBadge status={receipt.status} labels={PAYMENT_HISTORY_STATUS} />}
                description={description}
                back={BACK}
            />
            <InvoiceDetail
                invoice={{
                    code: receipt.no,
                    createdAt: receipt.date ? receipt.date.split("/").reverse().join("-") : "",
                    plan: receipt.planId != null ? { id: receipt.planId, name: receipt.title } : null,
                    lines: receipt.lines,
                    subtotal: receipt.gross,
                    discount: receipt.disc,
                    total: receipt.net,
                    paid: receipt.paid,
                    remaining: receipt.left,
                    payments: receipt.pays,
                }}
            />
        </>
    );
};

export default InvoiceDetailPage;

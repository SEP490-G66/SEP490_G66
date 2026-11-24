import { ReceiptText } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import DashboardSection from "@/components/dashboard/DashboardSection";
import DataTable from "@/components/ui/DataTable";
import IconLinkButton from "@/components/ui/IconLinkButton";
import PageHeader from "@/components/ui/PageHeader";
import PageLoadState from "@/components/ui/PageLoadState";
import StatusBadge from "@/components/ui/StatusBadge";
import useAsync from "@/hooks/useAsync";
import { getMyDebtAccounts } from "@/services/patientBillingService";
import { cx } from "@/utils/cx";
import { formatCurrency } from "@/utils/format";
import { BOOKING_ERROR_CODE, PATIENT_DEBT_PAY_TYPE, PATIENT_DEBT_STAGE_STATUS, PATIENT_DEBT_STATUS } from "@/utils/messages";
import { ROUTES, getPaymentHistoryRoute } from "@/utils/routes";

const BACK = { to: `${ROUTES.PAYMENT_HISTORY}?tab=installments`, label: "Lịch sử thanh toán" };
const TITLE_ID = "installment-periods-title";

const Tile = ({ label, value, className }) => (
    <div className="rounded-md bg-surface-tint px-4 py-3">
        <p className="text-caption text-muted">{label}</p>
        <p className={cx("num mt-1 font-heading text-heading-3 text-ink", className)}>{value}</p>
    </div>
);

// "Chi tiết trả theo đợt" (Figma 1244:4456): totals, payment progress and the periods / steps of one plan.
// TODO(api): amount paid per period is not returned (only a note for a partly paid step), so "Đã trả" / "Còn thiếu" stay hidden.
const InstallmentDetail = () => {
    const { debtId } = useParams();
    const { loading, error, value } = useAsync(() => getMyDebtAccounts(), []);
    let status = "ready";
    if (loading) status = "loading";
    else if (!error && value?.code === BOOKING_ERROR_CODE.PROFILE_NOT_FOUND) status = "unlinked";
    else if (error || !value?.success) status = "failed";
    const item = status === "ready" ? (value.data.items.find((entry) => String(entry.id) === debtId) ?? null) : null;

    if (!item) {
        return (
            <>
                <PageHeader title="Chi tiết trả theo đợt" back={BACK} />
                <PageLoadState status={status} />
                {status === "ready" && <div className="card-app empty-state py-16">Không tìm thấy khoản thanh toán này.</div>}
            </>
        );
    }

    // A one-off invoice has no periods: its page is the invoice detail (links from notifications land here).
    if (item.type === "once") return <Navigate to={getPaymentHistoryRoute(item.invoiceId)} replace />;

    const remaining = Math.max(item.total - item.paid, 0);
    const percent = item.total > 0 ? Math.round((item.paid / item.total) * 100) : 0;
    const periods = item.stages.length ? item.stages : item.lines.map((line, index) => ({ key: line.key, label: `Đợt ${index + 1}`, milestone: line.name, amount: line.total, status: null, note: "" }));
    const columns = [
        { key: "label", label: "Đợt", primary: true, render: (period) => <span className="font-semibold text-ink">{period.label}</span> },
        {
            key: "milestone",
            label: "Nội dung buổi điều trị",
            block: true,
            render: (period) => (
                <>
                    {period.milestone}
                    {period.note && <span className="block text-caption text-muted">{period.note}</span>}
                </>
            ),
        },
        { key: "amount", label: "Số tiền", align: "right", render: (period) => formatCurrency(period.amount) },
        { key: "status", label: "Trạng thái", optional: true, render: (period) => <StatusBadge status={period.status} labels={PATIENT_DEBT_STAGE_STATUS} /> },
        {
            key: "actions",
            label: "Thao tác",
            align: "right",
            actions: true,
            render: (period) => <IconLinkButton icon={ReceiptText} label={`Xem hoá đơn ${item.invoiceNumber} (${period.label})`} to={getPaymentHistoryRoute(item.invoiceId)} />,
        },
    ];

    return (
        <>
            <PageHeader
                title={item.name}
                badge={<StatusBadge status={item.status} labels={PATIENT_DEBT_STATUS} />}
                description={[PATIENT_DEBT_PAY_TYPE[item.type]?.label, "mỗi đợt thanh toán trước buổi điều trị tương ứng"].filter(Boolean).join(" · ")}
                back={BACK}
            />
            <div className="flex flex-col gap-5">
                <section className="card-app flex flex-col gap-4" aria-label="Tổng quan khoản thanh toán">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Tile label="Ngày lập" value={item.start} />
                        <Tile label="Số đợt" value={`${periods.length} đợt`} />
                        {item.doctorName && <Tile label="Bác sĩ phụ trách" value={item.doctorName} />}
                        <Tile label="Tổng chi phí" value={formatCurrency(item.total)} />
                        <Tile label="Đã thanh toán" value={formatCurrency(item.paid)} className="text-success" />
                        <Tile label="Còn lại" value={formatCurrency(remaining)} className={remaining > 0 ? "text-danger" : undefined} />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm">
                            <span className="font-semibold text-ink">Tiến độ thanh toán</span>
                            <span className="num font-semibold text-primary">
                                {percent}% · {formatCurrency(item.paid)} / {formatCurrency(item.total)}
                            </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-label="Tiến độ thanh toán" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                        </div>
                    </div>
                </section>
                <DashboardSection id={TITLE_ID} title="Các đợt thanh toán">
                    <DataTable columns={columns} rows={periods} rowKey="key" labelledBy={TITLE_ID} empty="Chưa có đợt thanh toán." />
                </DashboardSection>
            </div>
        </>
    );
};

export default InstallmentDetail;

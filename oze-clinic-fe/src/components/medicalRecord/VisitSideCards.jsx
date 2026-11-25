import { Link } from "react-router-dom";
import DashboardSection from "@/components/dashboard/DashboardSection";
import StatusBadge from "@/components/ui/StatusBadge";
import { cx } from "@/utils/cx";
import { formatCurrency } from "@/utils/format";
import { PATIENT_APPOINTMENT_STATUS } from "@/utils/messages";
import { getPaymentHistoryRoute, getTreatmentPlanRoute } from "@/utils/routes";

// Right column of "Chi tiết lần khám" (Figma): next step of the plan and the visit's invoices.
// "Phim chụp" reuses ImagingPanel.

// next: { title, line, status (appointment status), planId }
export const NextStepCard = ({ next }) => (
    <DashboardSection id="visit-next-step-title" title="Bước tiếp theo">
        <div className="flex flex-col items-start gap-1.5">
            <p className="text-title text-ink">{next.title}</p>
            {next.line && <p className="num text-caption text-muted">{next.line}</p>}
            <StatusBadge status={next.status} labels={PATIENT_APPOINTMENT_STATUS} />
            {next.planId != null && (
                <Link to={getTreatmentPlanRoute(next.planId)} className="btn btn-link mt-1 min-h-11 pointer-fine:min-h-0">
                    Xem kế hoạch điều trị
                </Link>
            )}
        </div>
    </DashboardSection>
);

// invoices: [{ id, code, description, amount, status: { label, badge } }]
export const VisitPaymentsCard = ({ invoices = [] }) => (
    <DashboardSection id="visit-payments-title" title="Thanh toán">
        {invoices.length === 0 && <p className="text-body-sm text-muted">Lần khám này chưa có hoá đơn.</p>}
        <ul className="flex flex-col gap-3">
            {invoices.map((invoice) => (
                <li key={invoice.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <Link to={getPaymentHistoryRoute(invoice.id)} className="font-semibold text-primary hover:underline">
                            {invoice.code}
                        </Link>
                        {invoice.description && <p className="text-caption text-muted">{invoice.description}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="num font-semibold text-ink">{formatCurrency(invoice.amount)}</span>
                        {invoice.status && <span className={cx("badge", invoice.status.badge)}>{invoice.status.label}</span>}
                    </div>
                </li>
            ))}
        </ul>
    </DashboardSection>
);

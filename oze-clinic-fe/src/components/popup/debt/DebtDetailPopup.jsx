import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/ui/StatusBadge";
import { DEBT_PAYMENT_STATUS_LABELS, DEBT_STATUS_LABELS, getDebtAgeLevel } from "@/utils/constants/debt";
import { cx } from "@/utils/cx";
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPhone } from "@/utils/format";

const AmountTile = ({ label, amount, className }) => (
    <div className="rounded-lg border border-border px-4 py-3">
        <p className="text-caption text-muted">{label}</p>
        <p className={cx("num mt-1 font-heading text-heading-3", className)}>{formatCurrency(amount)}</p>
    </div>
);

const SectionTitle = ({ children }) => <h3 className="mb-2 text-body-sm font-semibold text-ink">{children}</h3>;

// Next installment, or the periods already late.
const InstallmentNote = ({ debt }) => {
    if (!debt.hasInstallmentPlan) return null;
    if (debt.overdueCount > 0) {
        return (
            <p className="alert alert-danger border-0">
                Trả góp: quá hạn {debt.overdueCount} kỳ, tổng {formatCurrency(debt.overdueAmount)}.
            </p>
        );
    }
    return (
        <p className="alert alert-info border-0">
            Trả góp
            {debt.nextDueDate && ` · kỳ tới ${formatDate(debt.nextDueDate)}`}
            {debt.nextDueAmount != null && `, ${formatCurrency(debt.nextDueAmount)}`}.
        </p>
    );
};

// "Chi tiết công nợ" popup, read only: amounts, services and payments of the invoice, installments, reminders sent.
const DebtDetailPopup = ({ debt, onClose }) => {
    const ageLevel = debt.ageDays == null ? null : getDebtAgeLevel(debt.ageDays);
    const description = [`Lập ${debt.createdDate}`, debt.fromTreatmentPlan ? "Theo kế hoạch điều trị" : "Khám lẻ", debt.ageDays != null && `Nợ ${debt.ageDays} ngày`]
        .filter(Boolean)
        .join(" · ");

    return (
        <Modal
            size="md"
            title={
                <span className="flex flex-wrap items-center gap-2">
                    Chi tiết công nợ · {debt.invoiceNumber}
                    <StatusBadge status={debt.status} labels={DEBT_STATUS_LABELS} />
                </span>
            }
            description={description}
            onClose={onClose}
        >
            <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-lg bg-surface-tint px-4 py-3">
                    <Avatar fullName={debt.patientName} className="avatar-soft" />
                    <div>
                        <p className="font-semibold text-ink">{debt.patientName}</p>
                        {(debt.patientCode || debt.phone) && (
                            <p className="num text-caption text-muted">{[debt.patientCode, debt.phone && formatPhone(debt.phone)].filter(Boolean).join(" · ")}</p>
                        )}
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    <AmountTile label="Phải trả" amount={debt.totalAmount} className="text-ink" />
                    <AmountTile label="Đã trả" amount={debt.paidAmount} className="text-success" />
                    <AmountTile label="Còn nợ" amount={debt.remainingAmount} className="text-danger" />
                </div>

                <InstallmentNote debt={debt} />

                <section>
                    <SectionTitle>Dịch vụ trong hoá đơn</SectionTitle>
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th scope="col">Dịch vụ</th>
                                    <th scope="col" className="text-right">
                                        SL
                                    </th>
                                    <th scope="col" className="text-right">
                                        Đơn giá
                                    </th>
                                    <th scope="col" className="text-right">
                                        Thành tiền
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {debt.services.map((service) => (
                                    <tr key={service.id}>
                                        <td className="min-w-48">{service.name}</td>
                                        <td className="num text-right">{service.quantity}</td>
                                        <td className="num whitespace-nowrap text-right">{formatNumber(service.unitPrice)}</td>
                                        <td className="num whitespace-nowrap text-right">{formatNumber(service.amount)}</td>
                                    </tr>
                                ))}
                                {debt.discountAmount > 0 && (
                                    <tr>
                                        <td colSpan={3} className="text-right text-muted">
                                            Giảm giá
                                        </td>
                                        <td className="num whitespace-nowrap text-right">−{formatNumber(debt.discountAmount)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <SectionTitle>Lịch sử thanh toán</SectionTitle>
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th scope="col">Thời gian</th>
                                    <th scope="col" className="text-right">
                                        Số tiền
                                    </th>
                                    <th scope="col">Phương thức</th>
                                    <th scope="col">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {debt.payments.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center text-muted">
                                            Chưa có lần thanh toán nào
                                        </td>
                                    </tr>
                                )}
                                {debt.payments.map((payment) => (
                                    <tr key={payment.id}>
                                        <td className="num whitespace-nowrap">{formatDateTime(payment.paidAt)}</td>
                                        <td className="num whitespace-nowrap text-right">{formatNumber(payment.amount)}</td>
                                        <td className="whitespace-nowrap">{payment.methodLabel}</td>
                                        <td className="whitespace-nowrap">
                                            <StatusBadge status={payment.status} labels={DEBT_PAYMENT_STATUS_LABELS} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <SectionTitle>Nhắc thanh toán đã gửi</SectionTitle>
                    {debt.reminders.length === 0 ? (
                        <p className="rounded-lg bg-surface-tint px-4 py-3 text-muted">Chưa gửi nhắc thanh toán nào.</p>
                    ) : (
                        <ul className="divide-y divide-border rounded-lg border border-border">
                            {debt.reminders.map((reminder) => (
                                <li key={reminder.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                                    <span className="num text-ink">{formatDateTime(reminder.sentAt)}</span>
                                    <span className="text-caption text-muted">
                                        {reminder.sentByName}
                                        {reminder.channels && ` · ${reminder.channels}`}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {debt.notes && (
                    <section>
                        <SectionTitle>Ghi chú hoá đơn</SectionTitle>
                        <p className="rounded-lg bg-surface-tint px-4 py-3 break-words text-ink">{debt.notes}</p>
                    </section>
                )}

                {ageLevel && <p className="alert alert-warning">Nợ quá {ageLevel.days} ngày. Lễ tân có thể gửi nhắc thanh toán cho bệnh nhân.</p>}

                <div className="modal-actions -mx-6 mt-2 border-t border-border px-6 pt-4">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Đóng
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default DebtDetailPopup;

import { useState } from "react";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/ui/StatusBadge";
import { REFUND_REQUEST_STATUSES, REFUND_REQUEST_STATUS_LABELS } from "@/utils/refundRequest";
import { formatCurrency, formatDateTime } from "@/utils/format";
import RejectRefundRequestPopup from "./RejectRefundRequestPopup";

const WORK_DONE_ID = "refund-work-done";

const InfoPanel = ({ rows }) => (
    <dl className="flex flex-col gap-2 rounded-lg bg-surface-tint px-4 py-3">
        {rows.map(({ label, value }) => (
            <div key={label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium break-words text-ink">{value}</dd>
            </div>
        ))}
    </dl>
);

const TextPanel = ({ title, children }) => (
    <section>
        <h3 className="text-body-sm font-semibold text-ink">{title}</h3>
        <p className="mt-2 rounded-lg bg-surface-tint px-4 py-3 break-words text-ink">{children}</p>
    </section>
);

const money = (value) => <span className="num">{formatCurrency(value)}</span>;

// Whole VND; "" while nothing is typed.
const parseAmount = (text) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

const workDoneError = (text, paidAmount) => {
    if (!text.trim()) return "Vui lòng nhập giá trị phần việc đã làm (nhập 0 nếu chưa làm gì).";
    const amount = parseAmount(text);
    if (amount === null) return "Vui lòng nhập số tiền là số nguyên, không âm.";
    if (amount >= paidAmount) return "Giá trị phần việc đã làm phải nhỏ hơn số tiền đã thanh toán.";
    return null;
};

// "Yêu cầu hoàn tiền" popup. A pending request is approved after the manager enters the value of the work already done:
// the patient gets back what they paid minus that value. onConfirm(workDoneAmount) and onReject(reason) save the
// decision; the parent closes the popup when that succeeds.
const RefundRequestDetailPopup = ({ request, onClose, onConfirm, onReject }) => {
    const [workDone, setWorkDone] = useState(request.workDoneAmount == null ? "" : String(request.workDoneAmount));
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [rejecting, setRejecting] = useState(false);

    const pending = request.status === REFUND_REQUEST_STATUSES.PENDING;
    const refunded = request.status === REFUND_REQUEST_STATUSES.REFUNDED;
    const approved = request.status === REFUND_REQUEST_STATUSES.APPROVED;
    const workDoneAmount = parseAmount(workDone);
    const previewRefund = workDoneAmount !== null && workDoneAmount < request.paidAmount ? request.paidAmount - workDoneAmount : null;

    const handleConfirm = async () => {
        const nextError = workDoneError(workDone, request.paidAmount);
        setError(nextError);
        if (nextError) {
            document.getElementById(WORK_DONE_ID)?.focus();
            return;
        }
        setSaving(true);
        await onConfirm(workDoneAmount);
        setSaving(false);
    };

    const invoiceRows = [
        { label: "Dịch vụ đăng ký", value: request.serviceNames },
        { label: "Số tiền đã thanh toán", value: money(request.paidAmount) },
    ];
    if (refunded || approved) {
        invoiceRows.push(
            { label: "Phần việc đã làm", value: money(request.workDoneAmount ?? 0) },
            {
                label: refunded ? "Số tiền đã hoàn" : "Số tiền hoàn (chờ lễ tân chi)",
                value: <span className={`num font-semibold ${refunded ? "text-success" : "text-ink"}`}>{formatCurrency(request.refundAmount)}</span>,
            },
        );
        if (request.processedAt) invoiceRows.push({ label: "Hoàn lúc", value: <span className="num">{formatDateTime(request.processedAt)}</span> });
    }

    return (
        <Modal
            title={
                <span className="flex flex-wrap items-center gap-2">
                    Yêu cầu hoàn tiền
                    {!pending && <StatusBadge status={request.status} labels={REFUND_REQUEST_STATUS_LABELS} />}
                </span>
            }
            description={`${request.code} · tạo bởi ${request.requestedByName} lúc ${formatDateTime(request.createdAt)}`}
            onClose={onClose}
            closeDisabled={saving}
        >
            <div className="mt-6 flex flex-col gap-4">
                <InfoPanel rows={[{ label: "Bệnh nhân", value: `${request.patientName} · ${request.patientCode}` }]} />

                <section>
                    <h3 className="mb-2 text-body-sm font-semibold text-ink">Hoá đơn cần hoàn · {request.invoiceNumber}</h3>
                    <InfoPanel rows={invoiceRows} />
                </section>

                <TextPanel title="Lý do">{request.reason}</TextPanel>
                {request.status === REFUND_REQUEST_STATUSES.REJECTED && <TextPanel title="Lý do từ chối">{request.rejectReason}</TextPanel>}

                {pending && (
                    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
                        <FormField id={WORK_DONE_ID} label="Giá trị phần việc đã làm" required error={error}>
                            <div className="relative">
                                <input
                                    id={WORK_DONE_ID}
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    step={1000}
                                    className="input num pr-10"
                                    placeholder="Nhập 0 nếu chưa làm gì"
                                    aria-invalid={Boolean(error)}
                                    aria-describedby={error ? `${WORK_DONE_ID}-error` : undefined}
                                    value={workDone}
                                    onChange={(event) => {
                                        setWorkDone(event.target.value);
                                        setError(null);
                                    }}
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted" aria-hidden="true">
                                    ₫
                                </span>
                            </div>
                        </FormField>
                        <div className="flex items-baseline justify-between gap-3" role="status">
                            <span className="text-muted">Số tiền hoàn cho bệnh nhân</span>
                            <span className="num font-heading text-heading-3 text-primary">{previewRefund === null ? "—" : formatCurrency(previewRefund)}</span>
                        </div>
                        <p className="text-caption text-muted">Số tiền hoàn = số tiền đã thanh toán − giá trị phần việc đã làm. Sau khi duyệt, lễ tân chi tiền cho bệnh nhân.</p>
                    </section>
                )}

                <div className="modal-actions -mx-6 mt-2 border-t border-border px-6 pt-4">
                    {pending ? (
                        <>
                            <button
                                type="button"
                                className="btn btn-secondary border-danger-solid text-danger"
                                disabled={saving}
                                onClick={() => setRejecting(true)}
                            >
                                Từ chối
                            </button>
                            <button type="button" className="btn btn-primary" disabled={saving} onClick={handleConfirm}>
                                {saving && <span className="btn-spinner" aria-hidden="true" />}
                                Xác nhận hoàn tiền
                            </button>
                        </>
                    ) : (
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Đóng
                        </button>
                    )}
                </div>
            </div>

            {rejecting && <RejectRefundRequestPopup request={request} onClose={() => setRejecting(false)} onSubmit={onReject} />}
        </Modal>
    );
};

export default RefundRequestDetailPopup;

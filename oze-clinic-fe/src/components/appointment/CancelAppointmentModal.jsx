import { useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { toast } from "react-toastify";
import AppointmentSummary from "@/components/appointment/AppointmentSummary";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import { APPOINTMENT_ACTION_CODE, cancelMyAppointment } from "@/services/appointmentService";
import { formatDate, formatTime } from "@/utils/format";
import { CANCEL_REASON_MAX_LENGTH, CLINIC_HOTLINE, GENERIC_ERROR_MESSAGE, MESSAGES } from "@/utils/messages";

const REASON_ID = "cancel-reason";

const NOT_ALLOWED_MESSAGE = MESSAGES.MSG31.replace("[số điện thoại]", CLINIC_HOTLINE.DISPLAY);

const getSuccessMessage = (appointment) =>
    MESSAGES.MSG29.replace("[ngày]", formatDate(appointment.appointmentDate)).replace("[giờ]", formatTime(appointment.timeSlotStart));

const CancelAppointmentModal = ({ appointment, onClose, onCancelled, onNotFound }) => {
    const reasonRef = useRef(null);
    const [reason, setReason] = useState("");
    const [reasonError, setReasonError] = useState(null);
    const [formAlert, setFormAlert] = useState(null);
    const [sending, setSending] = useState(false);

    const close = () => onClose({ refetch: Boolean(formAlert?.refetch) });

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!reason.trim()) {
            setReasonError(MESSAGES.MSG30);
            reasonRef.current?.focus();
            return;
        }
        setFormAlert(null);
        setSending(true);
        const result = await cancelMyAppointment(appointment.id, { reason });
        if (result.success) {
            toast.success(getSuccessMessage(appointment));
            onCancelled(result.data);
            return;
        }
        setSending(false);
        if (result.code === APPOINTMENT_ACTION_CODE.NOT_FOUND) {
            onNotFound();
            return;
        }
        const notAllowed = result.code === APPOINTMENT_ACTION_CODE.NOT_ALLOWED;
        setFormAlert({ message: notAllowed ? NOT_ALLOWED_MESSAGE : GENERIC_ERROR_MESSAGE, refetch: notAllowed });
    };

    return (
        <Modal title="Hủy lịch hẹn" onClose={close} closeDisabled={sending}>
            <form noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <AppointmentSummary appointment={appointment} />
                {formAlert && (
                    <div role="alert" className="alert alert-danger">
                        {formAlert.message}
                    </div>
                )}
                <FormField id={REASON_ID} label="Lý do hủy" required error={reasonError}>
                    <textarea
                        ref={reasonRef}
                        id={REASON_ID}
                        name="reason"
                        className="input"
                        rows={3}
                        placeholder="Nhập lý do hủy lịch"
                        maxLength={CANCEL_REASON_MAX_LENGTH}
                        value={reason}
                        disabled={sending}
                        aria-invalid={Boolean(reasonError)}
                        aria-describedby={reasonError ? `${REASON_ID}-error` : undefined}
                        onChange={(event) => {
                            setReason(event.target.value);
                            setReasonError(null);
                        }}
                    />
                </FormField>
                <div className="alert alert-warning">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                    <p>{"Sau khi hủy, ca khám sẽ được trả lại cho bệnh nhân khác. Lịch hẹn vẫn được lưu với trạng thái \"Đã hủy\"."}</p>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" disabled={sending} onClick={close}>
                        Giữ lịch hẹn
                    </button>
                    <button type="submit" className="btn btn-danger" disabled={sending}>
                        {sending && <span className="btn-spinner" aria-hidden="true" />}
                        {sending ? "Đang gửi..." : "Xác nhận hủy lịch"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default CancelAppointmentModal;

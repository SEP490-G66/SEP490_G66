import { useRef } from "react";
import Modal from "@/components/ui/Modal";

const Count = ({ label, value }) => (
    <div className="flex flex-1 flex-col gap-0.5 rounded-lg bg-surface-tint px-3.5 py-2.5">
        <dt className="text-caption text-muted">{label}</dt>
        <dd className="num font-semibold text-ink">{value}</dd>
    </div>
);

// "Kết thúc lượt khám" (Figma): what the visit recorded, then where the patient goes. A prescription with medicines
// is finalized on confirm. summary: { diagnoses, treatments, medicines, followUpDate? (dd/mm/yyyy) }.
const EndVisitDialog = ({ patientName, queueNumber, summary, busy = false, onConfirm, onClose }) => {
    const cancelRef = useRef(null);

    return (
        <Modal title="Kết thúc lượt khám" description={`${patientName} · Số ${queueNumber}`} onClose={onClose} closeDisabled={busy} initialFocusRef={cancelRef}>
            <dl className="mt-5 flex flex-wrap gap-2.5">
                <Count label="Chẩn đoán" value={summary.diagnoses} />
                <Count label="Điều trị" value={summary.treatments} />
                <Count label="Đơn thuốc" value={summary.medicines ? `${summary.medicines} thuốc` : "Không"} />
            </dl>
            <p className="mt-4 text-body-sm text-body">
                Bệnh nhân ra quầy lễ tân thanh toán.
                {summary.followUpDate && (
                    <>
                        {" "}
                        Ngày hẹn tái khám: <b className="num font-semibold text-ink">{summary.followUpDate}</b>.
                    </>
                )}
                {summary.medicines > 0 && " Đơn thuốc sẽ được chốt và không sửa được nữa."}
            </p>
            <div className="modal-actions -mx-6 mt-5 border-t border-border px-6 pt-4">
                <button ref={cancelRef} type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
                    Quay lại
                </button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={onConfirm}>
                    {busy && <span className="btn-spinner" aria-hidden="true" />}
                    Kết thúc lượt khám
                </button>
            </div>
        </Modal>
    );
};

export default EndVisitDialog;

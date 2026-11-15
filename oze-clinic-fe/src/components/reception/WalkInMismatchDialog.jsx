import Modal from "@/components/ui/Modal";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";

const WalkInMismatchDialog = ({ patientCode, onClose, onOpenQueue }) => (
    <Modal title={TEXT.WALK_IN_MISMATCH_TITLE} onClose={onClose}>
        <div role="alert" className="alert alert-warning">
            {TEXT.WALK_IN_MISMATCH(patientCode)}
        </div>
        <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
                {TEXT.CLOSE}
            </button>
            <button type="button" className="btn btn-primary" onClick={onOpenQueue}>
                {TEXT.OPEN_QUEUE}
            </button>
        </div>
    </Modal>
);

export default WalkInMismatchDialog;

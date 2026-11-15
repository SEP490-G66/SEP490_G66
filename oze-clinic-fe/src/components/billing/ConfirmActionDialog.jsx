import Modal from "@/components/ui/Modal";
import { DialogActions } from "@/components/reception/shared";
import { useSubmit } from "@/components/reception/receptionUtils";

// body: [text, bold, text, bold, …] — every odd piece is drawn bold
const ConfirmActionDialog = ({ title, description, body, submitLabel, closeLabel, danger, onClose, onSubmit }) => {
    const [busy, submit] = useSubmit(onSubmit);
    return (
        <Modal title={title} description={description} onClose={onClose}>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <p className="text-body-sm text-body">
                    {body.map((piece, index) =>
                        index % 2 ? (
                            <b key={index} className="text-ink">
                                {piece}
                            </b>
                        ) : (
                            piece
                        ),
                    )}
                </p>
                <DialogActions onClose={onClose} closeLabel={closeLabel} submitLabel={submitLabel} danger={danger} busy={busy} />
            </form>
        </Modal>
    );
};

export default ConfirmActionDialog;

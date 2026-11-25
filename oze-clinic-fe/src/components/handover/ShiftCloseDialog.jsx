import Modal from "@/components/ui/Modal";
import { DialogActions } from "@/components/reception/shared";
import { money, useSubmit } from "@/components/reception/receptionUtils";
import DiffChip from "./DiffChip";
import MoneyLine from "./MoneyLine";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";

const ShiftCloseDialog = ({ label, subtitle, values, system, shiftEnd, now, print, warning, onClose, onSubmit }) => {
    const [busy, submit] = useSubmit(onSubmit);
    const cash = values.countedCash;
    return (
        <Modal title={TEXT.CONFIRM_CLOSE(label)} description={subtitle} onClose={onClose} closeDisabled={busy}>
            <form
                className="space-y-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <dl className="rounded-lg bg-surface-tint px-4 py-3">
                    <MoneyLine label={TEXT.EXPECTED_CASH}>{money(system.cash)}</MoneyLine>
                    <MoneyLine label={TEXT.ACTUAL_CASH} strong>
                        <span className="inline-flex items-center gap-2">
                            {money(cash)} <DiffChip value={cash - system.cash} />
                        </span>
                    </MoneyLine>
                    <MoneyLine label={TEXT.TRANSFER_SYSTEM}>{money(system.transfer)}</MoneyLine>
                </dl>
                {warning && <p className="alert alert-warning">{warning}</p>}
                {shiftEnd && now < shiftEnd && <p className="alert alert-warning">{TEXT.NOT_ENDED(shiftEnd)}</p>}
                <p className="help-text">{TEXT.LOCKED_NOTE}</p>
                <DialogActions onClose={onClose} closeDisabled={busy} closeLabel={TEXT.BACK_BUTTON} submitLabel={print ? TEXT.CLOSE_AND_PRINT : TEXT.CLOSE_PANEL} busy={busy} />
            </form>
        </Modal>
    );
};

export default ShiftCloseDialog;

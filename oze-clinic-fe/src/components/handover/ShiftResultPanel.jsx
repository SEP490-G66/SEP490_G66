import { Card } from "@/components/reception/shared";
import { money } from "@/components/reception/receptionUtils";
import DiffChip from "./DiffChip";
import MoneyLine from "./MoneyLine";
import ShiftFigures from "./ShiftFigures";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";

const ShiftResultPanel = ({ openingCash, cashNet, system, countedCash, notes, onPrint, className }) => (
    <Card title={TEXT.RESULT_PANEL} className={className}>
        <div className="space-y-4 px-5 py-5">
            <ShiftFigures openingCash={openingCash} cashNet={cashNet} expectedCash={system.cash} />
            <dl>
                <MoneyLine label={TEXT.ACTUAL_CASH} strong>
                    {countedCash == null ? "—" : money(countedCash)}
                </MoneyLine>
                <MoneyLine label={TEXT.DIFF}>
                    <DiffChip value={countedCash == null ? null : countedCash - system.cash} />
                </MoneyLine>
            </dl>
            {notes && (
                <div>
                    <h3 className="mb-1 text-label font-semibold text-ink">{TEXT.NOTE}</h3>
                    <p className="whitespace-pre-line text-body-sm text-body">{notes}</p>
                </div>
            )}
            <button type="button" className="btn btn-primary w-full sm:w-auto print:hidden" onClick={onPrint}>
                {TEXT.PRINT}
            </button>
        </div>
    </Card>
);

export default ShiftResultPanel;

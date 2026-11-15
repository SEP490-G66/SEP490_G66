import { Card } from "@/components/reception/shared";
import ResultBlock from "./ResultBlock";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";

const ShiftResultPanel = ({ system, actual, notes, onPrint }) => (
    <Card title={TEXT.RESULT_PANEL}>
        <div className="grid gap-6 px-5 py-5 lg:grid-cols-3">
            <ResultBlock title={TEXT.CASH} system={system.cash} actual={actual.cash} className="lg:border-r lg:border-border lg:pr-6" />
            <ResultBlock title={TEXT.TRANSFER} system={system.transfer} actual={actual.transfer} />
            <ResultBlock title={TEXT.END_TOTAL} system={system.cash + system.transfer} actual={actual.cash + actual.transfer} className="rounded-lg bg-surface-tint p-4" />
            {notes && (
                <div className="lg:col-span-2">
                    <h3 className="mb-1 text-label font-semibold text-ink">{TEXT.NOTE}</h3>
                    <p className="whitespace-pre-line text-body-sm text-body">{notes}</p>
                </div>
            )}
            <div className="lg:col-start-1">
                <button type="button" className="btn btn-primary w-full" onClick={onPrint}>
                    {TEXT.PRINT}
                </button>
            </div>
        </div>
    </Card>
);

export default ShiftResultPanel;

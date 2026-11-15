import { money } from "@/components/reception/receptionUtils";
import DiffChip from "./DiffChip";
import MoneyLine from "./MoneyLine";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";

const ResultBlock = ({ title, system, actual, className }) => (
    <div className={className}>
        <h3 className="mb-2 text-label font-semibold text-ink">{title}</h3>
        <dl>
            <MoneyLine label={TEXT.SYSTEM}>{money(system)}</MoneyLine>
            <MoneyLine label={TEXT.ACTUAL} strong>
                {actual == null ? "—" : money(actual)}
            </MoneyLine>
            <MoneyLine label={TEXT.DIFF}>
                <DiffChip value={actual == null ? null : actual - system} />
            </MoneyLine>
        </dl>
    </div>
);

export default ResultBlock;

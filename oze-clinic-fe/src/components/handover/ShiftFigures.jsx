import { money } from "@/components/reception/receptionUtils";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const Tile = ({ label, value, hint, accent }) => (
    <div className={cx("rounded-lg px-3 py-2.5", accent ? "border border-primary-soft bg-primary-softer" : "bg-surface-tint")}>
        <dt className="text-caption text-muted">{label}</dt>
        <dd className="num m-0 font-heading text-heading-3 font-bold text-ink">{money(value)}</dd>
        {hint && <dd className="m-0 text-caption text-muted">{hint}</dd>}
    </div>
);

const ShiftFigures = ({ openingCash, cashNet, expectedCash }) => (
    <dl className="grid gap-3 sm:grid-cols-3">
        <Tile label={TEXT.OPENING_CASH} value={openingCash} />
        <Tile label={TEXT.CASH_NET} value={cashNet} />
        <Tile label={TEXT.EXPECTED_CASH} value={expectedCash} hint={TEXT.EXPECTED_HINT} accent />
    </dl>
);

export default ShiftFigures;

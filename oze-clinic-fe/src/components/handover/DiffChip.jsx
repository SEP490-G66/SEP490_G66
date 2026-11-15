import { money } from "@/components/reception/receptionUtils";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";

const DiffChip = ({ value }) => {
    if (value == null) return <span className="text-muted">—</span>;
    if (value === 0) return <span className="badge badge-success">{TEXT.MATCH}</span>;
    return value > 0 ? <span className="badge badge-warning">{TEXT.OVER(money(value))}</span> : <span className="badge badge-danger">{TEXT.SHORT(money(-value))}</span>;
};

export default DiffChip;

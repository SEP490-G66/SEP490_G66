import { Link } from "react-router-dom";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";

// Why the write buttons are off; nothing when the shift is open
const ShiftLockAlert = ({ lock }) => {
    if (lock.state === "open") return null;
    if (lock.state === "loading") {
        return (
            <p className="text-caption text-muted" role="status">
                {TEXT.SHIFT_LOADING}
            </p>
        );
    }
    return (
        <div role="alert" className="alert alert-warning flex flex-wrap items-center gap-3">
            <span className="flex-1">{lock.state === "closed" ? TEXT.SHIFT_CLOSED : TEXT.SHIFT_ERROR}</span>
            {lock.state === "closed" ? (
                <Link to={ROUTES.RECEPTION_CASH_HANDOVER} className="btn btn-secondary h-9">
                    {TEXT.OPEN_SHIFT}
                </Link>
            ) : (
                <button type="button" className="btn btn-secondary h-9" onClick={lock.retry}>
                    {TEXT.RETRY}
                </button>
            )}
        </div>
    );
};

export default ShiftLockAlert;

import { Link } from "react-router-dom";
import { cx } from "@/utils/cx";

const CLASS = "btn btn-secondary btn-icon size-9 max-md:size-11";

// Square icon-only action used in table "Thao tác" columns (xem, tải lại, xoá, hoàn tiền).
// Pass `to` for a link or `onClick` for a button; label is read by screen readers and shown as a tooltip.
const IconLinkButton = ({ icon: Icon, label, to, state, onClick, disabled, className }) =>
    to ? (
        <Link to={to} state={state} className={cx(CLASS, className)} aria-label={label} title={label}>
            <Icon className="size-4" aria-hidden="true" />
        </Link>
    ) : (
        <button type="button" className={cx(CLASS, className)} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
            <Icon className="size-4" aria-hidden="true" />
        </button>
    );

export default IconLinkButton;

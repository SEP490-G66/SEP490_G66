import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cx } from "@/utils/cx";

const BackLink = ({ to, state, label, className }) => (
    <Link to={to} state={state} aria-label={label} title={label} className={cx("btn btn-secondary btn-icon shrink-0", className)}>
        <ChevronLeft className="size-4" aria-hidden="true" />
    </Link>
);

export default BackLink;

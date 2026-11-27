import { ddmm } from "@/utils/calendar";
import { SCHEDULE_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

// "Buổi chờ xếp giờ": the toggle button of the toolbar, with the number of sessions waiting for a time
export const PendingSessionsButton = ({ count, open, onToggle }) => (
    <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cx(
            "inline-flex items-center gap-2 rounded-full border py-1.5 pl-3.5 pr-1.5 text-body-sm font-semibold",
            open ? "border-primary bg-primary text-on-primary" : "border-primary-soft bg-primary-softer text-primary hover:border-primary",
        )}
    >
        {TEXT.PENDING_BUTTON}
        <span className={cx("num grid min-w-5 place-items-center rounded-full px-1.5 text-caption font-bold", open ? "bg-canvas text-primary" : "bg-primary text-on-primary")}>
            {count ?? "…"}
        </span>
    </button>
);

// The sessions themselves, one chip each: patient, "B2/3", service, doctor, planned date. Picking one shows on the grid only
// the cells of that session's doctor where it fits. sessions: getPendingPlanSessions; status: loading | ready | error.
export const PendingSessionsList = ({ status, sessions, pickedId, onPick, onRetry }) => {
    if (status === "loading") return <p className="mt-3 text-body-sm text-muted">{TEXT.PENDING_LOADING}</p>;
    if (status === "error")
        return (
            <p role="alert" className="mt-3 text-body-sm text-danger">
                {TEXT.PENDING_ERROR}{" "}
                <button type="button" className="btn-link" onClick={onRetry}>
                    {TEXT.RETRY}
                </button>
            </p>
        );
    if (!sessions.length) return <p className="mt-3 text-body-sm text-muted">{TEXT.PENDING_EMPTY}</p>;
    return (
        <ul className="mt-3 flex flex-wrap gap-2">
            {sessions.map((session) => {
                const picked = session.stageId === pickedId;
                return (
                    <li key={session.stageId}>
                        <button
                            type="button"
                            aria-pressed={picked}
                            onClick={() => onPick(picked ? null : session)}
                            className={cx(
                                "rounded-full border px-3 py-1.5 text-left text-body-sm",
                                picked ? "border-primary bg-primary-soft ring-1 ring-primary" : "border-border bg-canvas hover:border-primary",
                            )}
                        >
                            <b className="font-semibold text-ink">{session.patientName}</b>{" "}
                            <span className="num rounded-full bg-primary-soft px-1.5 text-[11px] font-semibold text-primary">
                                {TEXT.SESSION_TAG(session.stageNumber, session.totalStages)}
                            </span>
                            <small className="ml-1.5 text-caption text-muted">
                                {[session.serviceName || session.stageName, session.doctorName, session.scheduledDate && TEXT.PENDING_DUE(ddmm(session.scheduledDate))]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </small>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};

// The bar under the toolbar while a session is picked: what is being booked, and "Bỏ chọn"
export const PickBar = ({ session, message, onClear }) => (
    <div role="status" className="flex flex-wrap items-center gap-2.5 rounded-xl bg-primary px-4 py-2.5 text-body-sm text-on-primary">
        <span className="min-w-0 flex-1">
            {TEXT.PICK_BAR(session.patientName, TEXT.SESSION_OF(session.stageNumber, session.totalStages), session.serviceName || session.stageName, session.doctorName)}
            {message && <span className="block text-caption opacity-90">{message}</span>}
        </span>
        <button type="button" onClick={onClear} className="rounded-full bg-canvas px-3 py-1 font-semibold text-primary">
            {TEXT.UNPICK}
        </button>
    </div>
);

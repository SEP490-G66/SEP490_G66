// Card shown instead of an exam step that cannot be done yet: why, what to do, and the way on — either
// actionLabel + onAction (a button) or a ready-made action (a link, a busy button).
const StepBlockedCard = ({ title, text, actionLabel, onAction, action }) => (
    <div className="card-app flex flex-col items-center gap-3 px-6 py-14 text-center">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-muted">{text}</p>
        {action ??
            (actionLabel && (
                <button type="button" className="btn btn-secondary" onClick={onAction}>
                    {actionLabel}
                </button>
            ))}
    </div>
);

export default StepBlockedCard;

// Card shown instead of an exam step that cannot be done yet: why, what to do, and a button back to the step that unblocks it.
const StepBlockedCard = ({ title, text, actionLabel, onAction }) => (
    <div className="card-app flex flex-col items-center gap-3 py-14 text-center">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-muted">{text}</p>
        <button type="button" className="btn btn-secondary" onClick={onAction}>
            {actionLabel}
        </button>
    </div>
);

export default StepBlockedCard;

const LoadMoreButton = ({ loading, error, onClick, label, retryLabel, errorText }) => (
    <div className="flex flex-col items-center gap-2 border-t border-border px-5 py-3">
        {error && (
            <p role="alert" className="text-body-sm text-danger">
                {errorText}
            </p>
        )}
        <button
            type="button"
            className="btn btn-secondary"
            aria-busy={loading ? "true" : undefined}
            aria-disabled={loading ? "true" : undefined}
            onClick={() => {
                if (!loading) onClick();
            }}
        >
            {loading && <span className="btn-spinner" aria-hidden />}
            {error ? retryLabel : label}
        </button>
    </div>
);

export default LoadMoreButton;

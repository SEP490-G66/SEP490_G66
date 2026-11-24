import { cx } from "@/utils/cx";

const TONES = {
    warning: "alert alert-warning",
    success: "alert alert-success",
    info: "alert alert-info",
    neutral: "rounded-md bg-surface-tint px-4 py-3 text-body-sm text-body",
};

// Short message strip under a card or inside a form (Figma "Notice"). Put the key phrase in <strong>.
const Notice = ({ tone = "neutral", live = false, className, children }) => (
    <p role={live ? "status" : undefined} className={cx(TONES[tone] ?? TONES.neutral, "[&_strong]:font-semibold", className)}>
        {children}
    </p>
);

export default Notice;

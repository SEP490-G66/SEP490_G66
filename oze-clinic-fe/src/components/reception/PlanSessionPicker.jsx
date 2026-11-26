import { cx } from "@/utils/cx";
import { formatDate } from "@/utils/format";
import { RECEPTION_BOOKING_TEXT as TEXT } from "@/utils/messages";

const NAME = "reception-booking-plan-session";

// "Buổi điều trị theo kế hoạch" in the "Đặt lịch hộ" dialog: book the visit for the next session of a plan,
// or as a visit outside the plans. sessions: getBookablePlanSessions. value: stageId or null.
const PlanSessionPicker = ({ status, sessions, value, onChange }) => {
    if (status === "loading") return <p className="help-text">{TEXT.PLAN_LOADING}</p>;
    if (status === "error") return <p className="help-text">{TEXT.PLAN_LOAD_ERROR}</p>;
    if (!sessions.length) return null;

    const options = [
        ...sessions.map((session) => ({
            value: session.stageId,
            title: `Buổi ${session.number}/${session.total} · ${session.name || "Buổi điều trị"}`,
            detail: [session.planName, session.doctorName, session.scheduledDate && `dự kiến ${formatDate(session.scheduledDate)}`].filter(Boolean).join(" · "),
        })),
        { value: null, title: TEXT.PLAN_NONE, detail: null },
    ];
    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="label mb-1">{TEXT.PLAN_SECTION}</legend>
            <p className="help-text mt-0">{TEXT.PLAN_HELP}</p>
            {options.map((option) => {
                const checked = option.value === value;
                return (
                    <label
                        key={option.value ?? "none"}
                        className={cx(
                            "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors duration-150",
                            checked ? "border-primary bg-primary-softer" : "border-border hover:bg-surface-tint",
                        )}
                    >
                        <input type="radio" name={NAME} className="mt-1 size-4 accent-primary" checked={checked} onChange={() => onChange(option.value)} />
                        <span className="min-w-0">
                            <span className="block font-semibold text-ink">{option.title}</span>
                            {option.detail && <span className="num block text-body-sm text-body">{option.detail}</span>}
                        </span>
                    </label>
                );
            })}
        </fieldset>
    );
};

export default PlanSessionPicker;

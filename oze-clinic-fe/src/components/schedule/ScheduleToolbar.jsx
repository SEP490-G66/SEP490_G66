import { ChevronLeft, ChevronRight } from "lucide-react";
import { ddmm, dmy, weekdayIndex } from "@/utils/calendar";
import { SCHEDULE_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

// Date bar of the appointment grid: calendar leaf (opens the date picker), the day title, ‹ Hôm nay ›, and the 7 days of the week.
// strip: { [day]: { text, full } } — what each day chip says under its date.
// actions: shown at the end of the top row ("Buổi chờ xếp giờ"); children: shown under the day strip
const ScheduleToolbar = ({ day, today, days, strip, dayCount, onChange, actions = null, children = null }) => {
    const openPicker = (event) => {
        try {
            event.currentTarget.showPicker?.();
        } catch {
            // Some browsers refuse showPicker outside a direct click; the native input still opens on its own
        }
    };
    const when = day === today ? TEXT.WHEN_TODAY : day < today ? TEXT.WHEN_PAST : "";

    return (
        <section className="rounded-xl border border-border bg-canvas px-4 pb-3 pt-3.5">
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                    <label
                        title={TEXT.PICK_DATE}
                        className="relative flex h-13 w-12 shrink-0 cursor-pointer flex-col overflow-hidden rounded-lg border border-primary bg-canvas text-center hover:ring-3 hover:ring-primary-soft"
                    >
                        <i className="bg-primary py-0.5 text-[10.5px] font-bold not-italic tracking-wide text-on-primary">{TEXT.MONTH_SHORT(Number(day.slice(5, 7)))}</i>
                        <b className="num grid flex-1 place-items-center font-heading text-title text-ink">{day.slice(8)}</b>
                        <input
                            type="date"
                            aria-label={TEXT.PICK_DATE}
                            value={day}
                            onClick={openPicker}
                            onChange={(e) => e.target.value && onChange(e.target.value)}
                            className="absolute inset-0 cursor-pointer opacity-0"
                        />
                    </label>
                    <div>
                        <h2 className="font-heading text-heading-3 text-ink">{TEXT.DAY_TITLE(TEXT.WEEKDAYS[weekdayIndex(day)], dmy(day))}</h2>
                        <p className="text-body-sm text-muted">{TEXT.DAY_SUB(when, dayCount)}</p>
                    </div>
                </div>
                <div role="group" aria-label={TEXT.PICK_DATE} className="inline-flex overflow-hidden rounded-full border border-border bg-canvas">
                    <StepButton label={TEXT.PREV_DAY} onClick={() => onChange(days.prev)}>
                        <ChevronLeft className="size-4" aria-hidden="true" />
                    </StepButton>
                    <button
                        type="button"
                        onClick={() => onChange(today)}
                        className="border-x border-border px-3.5 py-1.5 text-body-sm font-semibold text-primary hover:bg-primary-softer"
                    >
                        {TEXT.TODAY}
                    </button>
                    <StepButton label={TEXT.NEXT_DAY} onClick={() => onChange(days.next)}>
                        <ChevronRight className="size-4" aria-hidden="true" />
                    </StepButton>
                </div>
                {actions && <div className="ml-auto">{actions}</div>}
            </div>
            <div role="tablist" aria-label={TEXT.DAYS_OF_WEEK} className="mt-3.5 grid grid-cols-[repeat(7,64px)] gap-2 overflow-x-auto pb-0.5 sm:grid-cols-7">
                {days.week.map((key, i) => {
                    const selected = key === day;
                    const past = key < today;
                    const info = strip[key];
                    return (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-label={`${TEXT.WEEKDAYS[i]} ${ddmm(key)}${info?.text ? `, ${info.text}` : ""}`}
                            onClick={() => onChange(key)}
                            className={cx(
                                "relative flex flex-col gap-px rounded-lg border px-1.5 py-2 text-center",
                                selected ? "border-primary bg-primary text-on-primary shadow-sm" : "border-border bg-canvas hover:border-primary",
                            )}
                        >
                            {key === today && <i aria-hidden="true" className="absolute right-2 top-1.5 size-1.5 rounded-full bg-warning-solid" />}
                            <small className={cx("text-caption font-medium", selected ? "text-on-primary" : past ? "text-placeholder" : "text-muted")}>
                                {TEXT.WEEKDAYS_SHORT[i]}
                            </small>
                            <b className={cx("num font-heading text-title", selected ? "text-on-primary" : past ? "text-placeholder" : "text-ink")}>{key.slice(8)}</b>
                            <span className={cx("truncate text-caption", selected ? "text-on-primary" : info?.full ? "font-semibold text-danger" : "text-muted")}>
                                {info?.text ?? " "}
                            </span>
                        </button>
                    );
                })}
            </div>
            {children}
        </section>
    );
};

const StepButton = ({ label, onClick, children }) => (
    <button type="button" aria-label={label} onClick={onClick} className="grid place-items-center px-3 py-1.5 text-ink hover:bg-primary-softer hover:text-primary">
        {children}
    </button>
);

export default ScheduleToolbar;

import { useState } from "react";
import { Link } from "react-router-dom";
import { slotOf } from "@/utils/checkIn";
import { DASHBOARD_TEXT as TEXT } from "@/utils/messages";
import { CHART_STATES, hourColumns, totalOf } from "@/utils/receptionDashboard";
import { ROUTES } from "@/utils/routes";
import { cx } from "@/utils/cx";

const COLUMN_CLASS = "group flex min-w-0 flex-col items-center justify-end rounded-lg focus-visible:outline-none";

const ariaOf = (label, counts) => {
    const total = totalOf(counts);
    const parts = CHART_STATES.filter((s) => counts[s.key])
        .map((s) => `${counts[s.key]} ${TEXT.CHART_STATES[s.key].toLowerCase()}`)
        .join(", ");
    return TEXT.COLUMN_LABEL(label, total, parts);
};

// col: { label, counts, now, onClick?, to?, state? } — a button, a link, or a plain column
const Column = ({ col, max }) => {
    const total = totalOf(col.counts);
    const body = (
        <>
            <span className="num mb-1 text-caption font-semibold text-ink">{total}</span>
            <span className="flex w-full flex-1 items-end justify-center">
                <span
                    className={cx(
                        "flex w-full max-w-16 flex-col-reverse overflow-hidden rounded-t-md [&>span+span]:border-b-2 [&>span+span]:border-canvas",
                        "group-hover:outline-2 group-hover:outline-offset-2 group-hover:outline-primary group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary",
                        col.now && "ring-2 ring-primary-soft",
                    )}
                    style={{ height: `${(total / max) * 100}%`, minHeight: total ? 4 : 0 }}
                >
                    {CHART_STATES.filter((s) => col.counts[s.key]).map((s) => (
                        <span key={s.key} title={`${TEXT.CHART_STATES[s.key]}: ${col.counts[s.key]}`} style={{ height: `${(col.counts[s.key] / total) * 100}%`, background: s.color }} />
                    ))}
                </span>
            </span>
        </>
    );
    const props = { role: "listitem", "aria-label": ariaOf(col.label, col.counts), className: COLUMN_CLASS };
    if (col.onClick)
        return (
            <button type="button" {...props} onClick={col.onClick}>
                {body}
            </button>
        );
    if (col.to)
        return (
            <Link {...props} to={col.to} state={col.state}>
                {body}
            </Link>
        );
    return <div {...props}>{body}</div>;
};

// days: from weekDays(); nowHour: the clinic's current hour, highlighted on today's hourly view
const AppointmentsChart = ({ days, nowHour }) => {
    const [view, setView] = useState(null);
    const day = view == null ? null : days[view];

    const cols = day
        ? hourColumns(day.items).map((h) => {
              const slots = [...new Set(h.items.map(slotOf).filter(Boolean))];
              return {
                  key: h.hour,
                  label: h.label,
                  counts: h.counts,
                  now: day.today && h.hour === nowHour,
                  // Check-in only lists today; a single slot in that hour presets its filter
                  to: day.today ? ROUTES.RECEPTION_CHECK_IN : null,
                  state: slots.length === 1 ? { slot: slots[0] } : undefined,
              };
          })
        : days.map((d, i) => ({ key: d.key, label: d.short, aria: d.full, counts: d.counts, now: d.today, onClick: () => setView(i) }));
    const max = Math.max(...cols.map((c) => totalOf(c.counts)), 1);

    return (
        <section aria-labelledby="dash-chart" className="flex min-w-0 flex-col rounded-xl border border-border bg-canvas shadow-xs">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4.5 pt-3.5">
                <h2 id="dash-chart" className="text-body font-semibold text-ink">
                    {day ? TEXT.HOUR_TITLE(day.full) : TEXT.WEEK_TITLE}
                </h2>
                {day && (
                    <button type="button" className="text-body-sm text-primary hover:underline" onClick={() => setView(null)}>
                        {TEXT.BACK_TO_WEEK}
                    </button>
                )}
            </div>
            {!day && <p className="px-4.5 pt-0.5 text-caption text-muted">{TEXT.WEEK_HINT}</p>}
            <div className="flex min-h-65 flex-1 flex-col">
                {cols.length ? (
                    <>
                        <div role="list" className="grid min-h-50 flex-1 auto-cols-fr grid-flow-col items-stretch gap-[clamp(6px,1.2vw,18px)] px-4.5 pt-3.5">
                            {cols.map((c) => (
                                <Column key={c.key} col={{ ...c, label: c.aria ?? c.label }} max={max} />
                            ))}
                        </div>
                        <div aria-hidden="true" className="grid auto-cols-fr grid-flow-col gap-[clamp(6px,1.2vw,18px)] border-t border-border px-4.5 pt-1.5 pb-2.5">
                            {cols.map((c) => (
                                <span key={c.key} className={cx("num min-w-0 text-center text-caption", c.now ? "font-bold text-primary" : "text-muted")}>
                                    {c.label}
                                </span>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="m-auto px-6 py-10 text-center text-body-sm text-muted">{TEXT.NO_HOURS}</p>
                )}
            </div>
            <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5 border-t border-border px-4.5 pt-2.5 pb-3.5 text-caption">
                {CHART_STATES.map((s) => (
                    <li key={s.key} className="inline-flex items-center gap-1.5">
                        <i className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
                        {TEXT.CHART_STATES[s.key]}
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default AppointmentsChart;

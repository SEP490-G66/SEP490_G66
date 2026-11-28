import { Link } from "react-router-dom";
import { DASHBOARD_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import { cx } from "@/utils/cx";

// rooms: [{ key, tab, name, staff, ended, endAt, wait }]
const RoomQueueBars = ({ rooms }) => {
    const max = Math.max(...rooms.map((r) => r.wait), 1);
    return (
        <section aria-labelledby="dash-rooms" className="flex min-w-0 flex-col rounded-xl border border-border bg-canvas shadow-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-2.5 px-4.5 pt-3.5">
                <h2 id="dash-rooms" className="text-body font-semibold text-ink">
                    {TEXT.ROOMS_TITLE}
                </h2>
                <Link to={ROUTES.RECEPTION_QUEUE} className="text-body-sm whitespace-nowrap text-primary hover:underline">
                    {TEXT.ROOMS_LINK}
                </Link>
            </div>
            {rooms.length ? (
                <ul className="flex flex-1 flex-col justify-around gap-2.5 px-4.5 pt-3.5 pb-4">
                    {rooms.map((r) => (
                        <li key={r.key}>
                            <Link
                                to={ROUTES.RECEPTION_QUEUE}
                                state={{ tab: r.tab, room: r.key }}
                                aria-label={TEXT.ROOM_BAR_LABEL(r.name, r.wait)}
                                className="grid grid-cols-[minmax(120px,190px)_1fr_48px] items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-primary-softer focus-visible:bg-primary-softer focus-visible:outline-none"
                            >
                                <span className="min-w-0 text-body-sm font-semibold text-ink">
                                    {r.name}
                                    <span className={cx("block text-caption font-normal", r.ended ? "text-danger" : "text-muted")}>
                                        {r.ended ? `${r.staff} · ${TEXT.ROOM_ENDED_AT(r.endAt)}` : r.staff}
                                    </span>
                                </span>
                                <span className="flex h-3.5 overflow-hidden rounded-full bg-surface-muted">
                                    <span className="h-full bg-primary" style={{ width: `${(r.wait / max) * 100}%` }} />
                                </span>
                                <span className={cx("num text-right text-body font-bold", r.wait ? "text-ink" : "text-placeholder")}>{r.wait}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="m-auto px-6 py-10 text-center text-body-sm text-muted">{TEXT.ROOMS_EMPTY}</p>
            )}
        </section>
    );
};

export default RoomQueueBars;

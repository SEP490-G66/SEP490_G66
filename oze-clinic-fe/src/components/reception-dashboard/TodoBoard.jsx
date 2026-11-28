import { Fragment } from "react";
import { Link } from "react-router-dom";
import { DASHBOARD_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

// One colour per group, in order
const GROUP_COLORS = ["var(--color-danger-solid)", "var(--color-warning-solid)", "#7FA8EE"];

// groups: [{ key, items: [{ key, count, to, state }] }]; labels come from TEXT.TODO_GROUPS / TEXT.TODO_ITEMS
const TodoBoard = ({ groups }) => {
    const max = Math.max(...groups.flatMap((g) => g.items.map((t) => t.count)), 1);
    return (
        <section aria-labelledby="dash-todo" className="rounded-xl border border-border bg-canvas shadow-xs lg:col-span-2">
            <h2 id="dash-todo" className="px-4.5 pt-3.5 text-body font-semibold text-ink">
                {TEXT.TODO_BOARD_TITLE}
            </h2>
            <div className="flex flex-col gap-1.5 px-4.5 pt-3 pb-4">
                {groups.map((g, i) => (
                    <Fragment key={g.key}>
                        {i > 0 && <div className="mb-1.5 h-1.5 border-b border-dashed border-border" aria-hidden="true" />}
                        {g.items.map((t) => {
                            const [label, sub, page] = TEXT.TODO_ITEMS[t.key];
                            return (
                                <Link
                                    key={t.key}
                                    to={t.to}
                                    state={t.state}
                                    aria-label={TEXT.TODO_ROW_LABEL(label, t.count, page)}
                                    className="-mx-1.5 grid grid-cols-2 items-center gap-3.5 rounded-lg p-1.5 hover:bg-primary-softer focus-visible:bg-primary-softer focus-visible:outline-none md:grid-cols-[minmax(180px,260px)_1fr_minmax(100px,150px)]"
                                >
                                    <span className={cx("text-body-sm font-medium", t.count ? "text-ink" : "text-placeholder")}>
                                        {label}
                                        {sub && <small className="block text-caption font-normal text-muted">{sub}</small>}
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 min-w-1 rounded" style={{ width: `${(t.count / max) * 100}%`, background: GROUP_COLORS[i] }} />
                                        <span className={cx("num font-bold", t.count ? "text-ink" : "text-placeholder")}>{t.count}</span>
                                    </span>
                                    <span className="hidden truncate text-caption text-primary md:block">{page}</span>
                                </Link>
                            );
                        })}
                    </Fragment>
                ))}
            </div>
            <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5 border-t border-border px-4.5 pt-2.5 pb-3.5 text-caption">
                {groups.map((g, i) => (
                    <li key={g.key} className="inline-flex items-center gap-1.5">
                        <i className="size-2.5 rounded-[3px]" style={{ background: GROUP_COLORS[i] }} aria-hidden="true" />
                        {TEXT.TODO_GROUPS[g.key]}
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default TodoBoard;

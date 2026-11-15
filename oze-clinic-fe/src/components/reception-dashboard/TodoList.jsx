import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/reception/shared";
import { DASHBOARD_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

// items: [{ key, count, to, state }]
const TodoList = ({ items }) => (
    <Card title={TEXT.TODO_TITLE}>
        <ul className="divide-y divide-border">
            {items.map((item) => {
                const [title, desc] = TEXT.TODO[item.key];
                return (
                    <li key={item.key}>
                        <Link to={item.to} state={item.state} className={cx("flex items-center gap-3 px-5 py-3 hover:bg-surface-tint", !item.count && "opacity-60")}>
                            <span
                                className={cx(
                                    "num grid size-8 shrink-0 place-items-center rounded-lg text-body-sm font-bold",
                                    item.count ? "bg-warning-soft text-warning" : "bg-surface-muted text-muted",
                                )}
                            >
                                {item.count}
                            </span>
                            <span className="min-w-0 flex-1">
                                <b className="block text-body-sm text-ink">{title}</b>
                                <small className="block text-caption text-muted">{desc}</small>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                        </Link>
                    </li>
                );
            })}
        </ul>
    </Card>
);

export default TodoList;

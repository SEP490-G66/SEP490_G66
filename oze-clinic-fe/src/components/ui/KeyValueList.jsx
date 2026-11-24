import { cx } from "@/utils/cx";

// "Label    value" rows, as in "Thông tin lịch hẹn" / "Thông tin khám".
// items: [{ label, value, hint, tone: "danger" | "strong" }]; empty values are skipped. columns: 1 or 2.
const KeyValueList = ({ items, columns = 1, className }) => {
    const shown = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
    return (
        <dl className={cx("grid gap-x-8 gap-y-3 text-body-sm", columns === 2 && "md:grid-cols-2", className)}>
            {shown.map((item) => (
                <div key={item.label} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 max-sm:grid-cols-1 max-sm:gap-0.5">
                    <dt className="text-muted">{item.label}</dt>
                    <dd className={cx("text-ink", item.tone === "strong" && "font-semibold", item.tone === "danger" && "font-semibold text-danger")}>
                        {item.value}
                        {item.hint && <span className="ml-1 text-caption text-muted">{item.hint}</span>}
                    </dd>
                </div>
            ))}
        </dl>
    );
};

export default KeyValueList;

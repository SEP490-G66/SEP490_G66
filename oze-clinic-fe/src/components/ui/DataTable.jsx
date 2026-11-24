import { cx } from "@/utils/cx";

const SKELETON_ROW_COUNT = 5;

// Generic table that turns into cards when its container is narrow (.table-stack, see styles/index.css).
// columns: [{ key, label, align: "right" | "center", render(row, index), primary, block, actions, hideStack, optional, className }]
//   primary   = card title on narrow screens (no label)
//   block     = label above a long value on narrow screens
//   actions   = buttons cell (no label, pinned to the bottom of the card)
//   hideStack = hidden on narrow screens (e.g. the row number)
// rows are rendered as-is; rowKey picks the React key; rowClassName(row) can highlight a row.
const isBlank = (value) => value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

const DataTable = ({ columns: allColumns, rows = [], rowKey = "id", rowClassName, caption, labelledBy, loading = false, empty, footer, className }) => {
    // optional: true = the column is dropped when no row has a value for column.key (data the API does not send yet)
    const columns = allColumns.filter((column) => !column.optional || loading || rows.some((row) => !isBlank(row[column.key])));
    const keyOf = (row, index) => (typeof rowKey === "function" ? rowKey(row, index) : (row[rowKey] ?? index));
    const showEmpty = !loading && rows.length === 0 && empty;

    return (
        <div className={cx("table-wrap", className)}>
            <table className="table table-stack" aria-labelledby={labelledBy} aria-busy={loading || undefined}>
                {caption && <caption className="sr-only">{caption}</caption>}
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key} scope="col" className={cx(column.align === "right" && "text-right", column.align === "center" && "text-center")}>
                                {column.actions && !column.label ? <span className="sr-only">Thao tác</span> : column.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading &&
                        Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                            <tr key={index} aria-hidden="true">
                                {columns.map((column) => (
                                    <td key={column.key}>
                                        <div className="skeleton h-4 w-full max-w-32" />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    {showEmpty && (
                        <tr>
                            <td colSpan={columns.length} className="py-8 text-center text-muted">
                                {empty}
                            </td>
                        </tr>
                    )}
                    {!loading &&
                        rows.map((row, index) => (
                            <tr key={keyOf(row, index)} className={rowClassName?.(row, index)}>
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        data-label={column.primary || column.actions || !column.label ? undefined : column.label}
                                        data-primary={column.primary || undefined}
                                        data-block={column.block || undefined}
                                        data-actions={column.actions || undefined}
                                        data-hide-stack={column.hideStack || undefined}
                                        className={cx(column.align === "right" && "text-right", column.align === "center" && "text-center", column.className)}
                                    >
                                        {column.render ? column.render(row, index) : row[column.key]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                </tbody>
            </table>
            {footer && <div className="table-footer">{footer}</div>}
        </div>
    );
};

export default DataTable;

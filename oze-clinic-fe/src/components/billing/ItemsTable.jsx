import { money } from "@/components/reception/receptionUtils";
import { lineTotal } from "@/utils/billing";
import { BILLING_TEXT as TEXT } from "@/utils/messages";

const ItemsTable = ({ items, showTooth = true }) => {
    const columns = showTooth ? TEXT.ITEM_COLUMNS : TEXT.DETAIL_COLUMNS;
    const right = (label) => [TEXT.ITEM_COLUMNS[3], TEXT.ITEM_COLUMNS[4], TEXT.ITEM_COLUMNS[5]].includes(label);
    if (!items.length) return <p className="py-4 text-body-sm text-muted">{TEXT.NO_ITEMS}</p>;
    return (
        <div className="table-wrap overflow-x-auto">
            <table className="table [&_td]:px-3 [&_td]:align-top [&_th]:px-3 [&_th]:whitespace-nowrap">
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th key={c} className={right(c) ? "text-right" : undefined}>
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr key={item.key}>
                            <td data-primary className="text-ink">
                                {item.name}
                            </td>
                            {showTooth && <td data-label={columns[1]}>{item.tooth ?? "—"}</td>}
                            <td data-label={TEXT.ITEM_COLUMNS[2]} className="whitespace-nowrap">
                                {item.doctor ?? "—"}
                            </td>
                            <td data-label={TEXT.ITEM_COLUMNS[3]} className="num text-right">
                                {item.quantity}
                            </td>
                            <td data-label={TEXT.ITEM_COLUMNS[4]} className="num whitespace-nowrap text-right">
                                {money(item.unitPrice)}
                            </td>
                            <td data-label={TEXT.ITEM_COLUMNS[5]} className="num whitespace-nowrap text-right text-ink">
                                {money(lineTotal(item))}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ItemsTable;

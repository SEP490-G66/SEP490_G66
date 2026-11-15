import RowMenu from "@/components/ui/RowMenu";
import { DASHBOARD_TEXT as TEXT } from "@/utils/messages";

// primary: { label, onClick } | null; items: menu items, null draws a divider
const RowActions = ({ name, primary, items }) => (
    <div className="flex items-center justify-end gap-2">
        {primary && (
            <button type="button" className="btn btn-primary h-8 px-3" onClick={primary.onClick}>
                {primary.label}
            </button>
        )}
        {items.length > 0 && <RowMenu label={TEXT.MORE_ACTIONS(name)} items={items} />}
    </div>
);

export default RowActions;

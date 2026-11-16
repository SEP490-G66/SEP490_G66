import RowMenu from "@/components/ui/RowMenu";
import { DASHBOARD_TEXT as TEXT } from "@/utils/messages";

// primary: { label, onClick, ariaLabel?, id? } | null; items: menu items, null draws a divider.
// id marks the primary button (data-row-action) so a page can move focus to it after the list reloads.
const RowActions = ({ name, primary, items }) => (
    <div className="flex items-center justify-end gap-2">
        {primary && (
            <button
                type="button"
                className="btn btn-primary h-8 px-3 pointer-coarse:h-11"
                onClick={primary.onClick}
                aria-label={primary.ariaLabel}
                data-row-action={primary.id}
            >
                {primary.label}
            </button>
        )}
        {items.length > 0 && <RowMenu label={TEXT.MORE_ACTIONS(name)} items={items} />}
    </div>
);

export default RowActions;

import { useId, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { cx } from "@/utils/cx";

// items: [{ label, onSelect, danger }], null draws a divider
const RowMenu = ({ label, items }) => {
    const [open, setOpen] = useState(false);
    const menuId = useId();
    const buttonRef = useRef(null);
    const close = (focusButton) => {
        setOpen(false);
        if (focusButton) buttonRef.current?.focus();
    };
    const move = (event) => {
        const list = [...event.currentTarget.querySelectorAll("[role=menuitem]")];
        const index = list.indexOf(document.activeElement);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            list[(index + step + list.length) % list.length]?.focus();
        }
        if (event.key === "Escape") {
            event.stopPropagation();
            close(true);
        }
    };
    return (
        <div
            className="relative inline-block"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
            }}
        >
            <button
                ref={buttonRef}
                type="button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen((v) => !v)}
                className="grid size-8 place-items-center rounded-md border border-border-strong bg-canvas text-body hover:text-ink pointer-coarse:size-11"
            >
                <Ellipsis className="size-4" aria-hidden="true" />
            </button>
            {open && (
                <div
                    id={menuId}
                    role="menu"
                    aria-label={label}
                    onKeyDown={move}
                    className="absolute right-0 top-full z-30 mt-1 min-w-52 rounded-lg border border-border bg-canvas py-1 shadow-lg"
                >
                    {items.map((item, index) =>
                        item ? (
                            <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                tabIndex={-1}
                                autoFocus={index === 0}
                                onClick={() => {
                                    close(false);
                                    item.onSelect();
                                }}
                                className={cx(
                                    "block w-full px-3 py-2 text-left text-body-sm hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none",
                                    item.danger ? "text-danger" : "text-ink",
                                )}
                            >
                                {item.label}
                            </button>
                        ) : (
                            <hr key={`d${index}`} className="my-1 border-border" />
                        ),
                    )}
                </div>
            )}
        </div>
    );
};

export default RowMenu;

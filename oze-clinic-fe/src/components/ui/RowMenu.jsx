import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ellipsis } from "lucide-react";
import { cx } from "@/utils/cx";

const MENU_ROOM = 260;

// items: [{ label, onSelect, danger }], null draws a divider.
// The menu is portalled to <body> and fixed to the viewport, so neither a scrolling table box nor a sticky cell clips or covers it.
const RowMenu = ({ label, items }) => {
    const menuId = useId();
    const buttonRef = useRef(null);
    const [place, setPlace] = useState(null);
    const open = Boolean(place);
    const placeOf = () => {
        const box = buttonRef.current.getBoundingClientRect();
        const up = window.innerHeight - box.bottom < MENU_ROOM && box.top > MENU_ROOM;
        return { right: Math.max(8, window.innerWidth - box.right), ...(up ? { bottom: window.innerHeight - box.top + 4 } : { top: box.bottom + 4 }) };
    };
    const setOpen = (value) => setPlace(value ? placeOf() : null);
    const close = (focusButton) => {
        setOpen(false);
        if (focusButton) buttonRef.current?.focus();
    };
    useEffect(() => {
        if (!open) return undefined;
        // Follow the button while the page or the table box scrolls.
        const follow = () => buttonRef.current && setPlace(placeOf());
        window.addEventListener("resize", follow);
        window.addEventListener("scroll", follow, true);
        return () => {
            window.removeEventListener("resize", follow);
            window.removeEventListener("scroll", follow, true);
        };
    }, [open]);
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
                const to = event.relatedTarget;
                if (!event.currentTarget.contains(to) && to?.closest?.("[role=menu]")?.id !== menuId) setOpen(false);
            }}
        >
            <button
                ref={buttonRef}
                type="button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen(!open)}
                className="grid size-8 place-items-center rounded-md border border-border-strong bg-canvas text-body hover:text-ink pointer-coarse:size-11"
            >
                <Ellipsis className="size-4" aria-hidden="true" />
            </button>
            {open &&
                createPortal(
                    <div
                        id={menuId}
                        role="menu"
                        aria-label={label}
                        onKeyDown={move}
                        style={place}
                        className="fixed z-50 min-w-52 rounded-lg border border-border bg-canvas py-1 shadow-lg"
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
                    </div>,
                    document.body,
                )}
        </div>
    );
};

export default RowMenu;

import { useId, useState } from "react";
import { CHECK_IN_TEXT as TEXT } from "@/utils/messages";

const ServiceCell = ({ names }) => {
    const [open, setOpen] = useState(false);
    const popupId = useId();
    if (!names.length) return null;
    const close = (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    };
    return (
        <div
            className="relative"
            onBlur={close}
            onKeyDown={(event) => {
                if (event.key === "Escape" && open) {
                    event.stopPropagation();
                    setOpen(false);
                }
            }}
        >
            <span className="text-body">{names[0]}</span>
            {names.length > 1 && (
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={popupId}
                    aria-label={TEXT.MORE_SERVICES(names.length)}
                    onClick={() => setOpen((v) => !v)}
                    className="num ml-1.5 inline-flex cursor-pointer rounded-full bg-surface-muted px-2 align-middle text-caption font-semibold text-body hover:text-ink"
                >
                    +{names.length - 1}
                </button>
            )}
            {open && (
                <div
                    id={popupId}
                    role="dialog"
                    aria-label={TEXT.SERVICES_TITLE}
                    tabIndex={-1}
                    className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-border bg-canvas p-3 shadow-lg"
                >
                    <p className="mb-1.5 text-caption font-semibold text-muted">{TEXT.SERVICES_TITLE}</p>
                    <ul className="space-y-1 text-body-sm text-ink">
                        {names.map((name) => (
                            <li key={name}>{name}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ServiceCell;

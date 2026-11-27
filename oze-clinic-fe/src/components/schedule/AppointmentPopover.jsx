import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { phoneText } from "@/components/reception/receptionUtils";
import { hhmm } from "@/utils/calendar";
import { serviceNames } from "@/utils/checkIn";
import { SCHEDULE_TEXT as TEXT } from "@/utils/messages";
import { STATE_DOT, STATE_TEXT } from "@/utils/roomSchedule";
import { cx } from "@/utils/cx";

const WIDTH = 300;
const GAP = 8;

// Small detail panel next to an appointment card. Closes on Esc, a click outside, or when the page scrolls under it.
// actions: [{ label, to?, onClick?, primary? }] — the page that handles each state is reached by a link, nothing changes here
const AppointmentPopover = ({ appointment: a, anchor, state, roomName, actions, onClose }) => {
    const titleId = useId();
    const panel = useRef(null);
    const [position, setPosition] = useState(null);

    useLayoutEffect(() => {
        const r = anchor.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        const left = r.right + GAP + WIDTH <= vw ? r.right + GAP : Math.max(GAP, r.left - GAP - WIDTH);
        const height = panel.current?.offsetHeight ?? 0;
        const top = Math.max(GAP, Math.min(r.top, vh - height - GAP));
        setPosition({ left, top });
    }, [anchor]);

    useEffect(() => {
        panel.current?.querySelector("a, button:not([data-close])")?.focus();
        const onKey = (e) => e.key === "Escape" && onClose(true);
        const onDown = (e) => !panel.current?.contains(e.target) && !anchor.contains(e.target) && onClose(false);
        const onScroll = (e) => !panel.current?.contains(e.target) && onClose(false);
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onDown);
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onDown);
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onScroll);
        };
    }, [anchor, onClose]);

    const fields = [
        [TEXT.FIELDS.time, `${hhmm(a.timeSlotStart)} – ${hhmm(a.timeSlotEnd)}`],
        [TEXT.FIELDS.service, serviceNames(a).join(", ") || "—"],
        [TEXT.FIELDS.room, roomName || "—"],
        [TEXT.FIELDS.doctor, a.doctorName || "—"],
        [TEXT.FIELDS.phone, phoneText(a.patientPhoneNumber) || "—"],
        [TEXT.FIELDS.code, a.patientCode || "—"],
    ];

    return (
        <div
            ref={panel}
            role="dialog"
            aria-labelledby={titleId}
            style={{ width: WIDTH, left: position?.left ?? -9999, top: position?.top ?? 0 }}
            className="fixed z-40 rounded-xl border border-border bg-canvas px-4 py-3.5 shadow-lg"
        >
            <div className="mb-1 flex items-start gap-2">
                <h3 id={titleId} className="flex-1 font-heading text-[15px] font-bold text-ink">
                    {a.patientName}
                </h3>
                <button type="button" data-close aria-label={TEXT.CLOSE} onClick={() => onClose(true)} className="text-muted hover:text-ink">
                    <X className="size-4" aria-hidden="true" />
                </button>
            </div>
            <span className={cx("inline-flex items-center gap-1.5 text-caption font-semibold", STATE_TEXT[state])}>
                <i aria-hidden="true" className={cx("size-2 rounded-full", STATE_DOT[state])} />
                {TEXT.STATUS[state]}
            </span>
            <dl className="my-3 grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-caption">
                {fields.map(([label, value]) => (
                    <div key={label} className="contents">
                        <dt className="text-muted">{label}</dt>
                        <dd className="text-ink">{value}</dd>
                    </div>
                ))}
            </dl>
            <div className="flex flex-wrap gap-2">
                {actions.map((action) => {
                    const className = cx("btn h-8 px-3 text-label", action.primary ? "btn-primary" : "btn-secondary");
                    return action.to ? (
                        <Link key={action.label} to={action.to} className={className}>
                            {action.label}
                        </Link>
                    ) : (
                        <button key={action.label} type="button" onClick={action.onClick} className={className}>
                            {action.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default AppointmentPopover;

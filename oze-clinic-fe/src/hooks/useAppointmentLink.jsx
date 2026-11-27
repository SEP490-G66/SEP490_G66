import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

const HIGHLIGHT_MS = 2_500;

// A link from another screen names one appointment: "?appointment=123" (the appointment grid links this way).
// Once the row is in the list, reveal(row, index) runs once so the page can switch tab / page to it; then the row
// (marked with data-appointment-row={id}) scrolls into view and is highlighted for a moment.
// Returns { linkedId, highlightId }.
const useAppointmentLink = (rows, { idOf = (row) => row.id, reveal } = {}) => {
    const [params] = useSearchParams();
    const linkedId = Number(params.get("appointment")) || null;
    const handled = useRef(null);
    const [highlightId, setHighlightId] = useState(null);

    const index = linkedId ? rows.findIndex((row) => idOf(row) === linkedId) : -1;

    useEffect(() => {
        if (!linkedId || index < 0 || handled.current === linkedId) return;
        handled.current = linkedId;
        reveal?.(rows[index], index);
        setHighlightId(linkedId);
    }, [linkedId, index, rows, reveal]);

    useEffect(() => {
        if (!highlightId) return undefined;
        const frame = requestAnimationFrame(() => document.querySelector(`[data-appointment-row="${highlightId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
        const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(timer);
        };
    }, [highlightId]);

    return { linkedId, highlightId };
};

export default useAppointmentLink;

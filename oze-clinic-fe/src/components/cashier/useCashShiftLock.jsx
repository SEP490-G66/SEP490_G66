import { useCallback, useEffect, useState } from "react";
import { checkShift } from "@/services/cashierService";

// Whether money may be written now: "loading" | "open" | "closed" | "error". Every write button stays off unless "open";
// the service checks the shift again right before each write.
const useCashShiftLock = () => {
    const [state, setState] = useState("loading");
    const [version, setVersion] = useState(0);

    useEffect(() => {
        let active = true;
        checkShift().then((result) => {
            if (!active) return;
            if (result.success) setState("open");
            else setState(result.reason === "closed" ? "closed" : "error");
        });
        return () => {
            active = false;
        };
    }, [version]);

    const retry = useCallback(() => {
        setState("loading");
        setVersion((v) => v + 1);
    }, []);

    return { state, open: state === "open", retry };
};

export default useCashShiftLock;

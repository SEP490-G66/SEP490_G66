import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { ROUTES } from "@/utils/routes";
import { safeListSearch } from "@/utils/patientRecord";

export const usePatientRecordNav = ({ failed = false } = {}) => {
    const location = useLocation();
    const navType = useNavigationType();
    const navigate = useNavigate();
    const [navEvent, setNavEvent] = useState(() => ({ location, kind: "enter", loadKey: 1 }));
    let current = navEvent;
    if (navEvent.location !== location) {
        const kind = navType === "POP" ? "pop" : location.state?.self ? "self" : "enter";
        const loadKey = kind === "self" && !failed ? navEvent.loadKey : navEvent.loadKey + 1;
        current = { location, kind, loadKey };
        setNavEvent(current);
    }
    const onList = location.pathname === ROUTES.RECEPTION_PATIENTS;
    const listSearch = onList ? location.search : safeListSearch(location.state?.listSearch);
    const navigateSelf = useCallback(
        (url, { replace = false, extra } = {}) => navigate(url, { replace, state: { ...extra, listSearch, self: true } }),
        [navigate, listSearch],
    );
    const linkState = useCallback((extra) => ({ ...extra, listSearch }), [listSearch]);
    return { loadKey: current.loadKey, kind: current.kind, navigateSelf, linkState, listSearch, location };
};

export const useFocusOnEnter = (loadKey, kind) => {
    const h1Ref = useRef(null);
    const done = useRef(0);
    useEffect(() => {
        if (kind === "enter" && done.current !== loadKey) {
            done.current = loadKey;
            h1Ref.current?.focus();
        }
    }, [loadKey, kind]);
    return h1Ref;
};

export const usePageTitle = (title) => {
    useEffect(() => {
        if (!title) return undefined;
        const previous = document.title;
        document.title = title;
        return () => {
            document.title = previous;
        };
    }, [title]);
};

export const useLoadGuard = (loadKey) => {
    const keyRef = useRef(loadKey);
    const mountedRef = useRef(false);
    useLayoutEffect(() => {
        keyRef.current = loadKey;
    }, [loadKey]);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);
    return useCallback((key) => mountedRef.current && keyRef.current === key, []);
};

export const useDialogSession = (loadKey) => {
    const seq = useRef(0);
    const mountedRef = useRef(false);
    useLayoutEffect(() => {
        seq.current += 1;
    }, [loadKey]);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            seq.current += 1;
        };
    }, []);
    const open = useCallback(() => {
        seq.current += 1;
        return seq.current;
    }, []);
    const close = useCallback(() => {
        seq.current += 1;
    }, []);
    const isAlive = useCallback((token) => mountedRef.current && seq.current === token, []);
    return useMemo(() => ({ open, close, isAlive }), [open, close, isAlive]);
};

export const useLeaveGuard = (active) => {
    useEffect(() => {
        if (!active) return undefined;
        const handler = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [active]);
};

export const useDebounced = (delay) => {
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    const cancel = useCallback(() => {
        clearTimeout(timer.current);
        timer.current = null;
    }, []);
    const schedule = useCallback(
        (fn) => {
            clearTimeout(timer.current);
            timer.current = setTimeout(() => {
                timer.current = null;
                fn();
            }, delay);
        },
        [delay],
    );
    return { schedule, cancel };
};

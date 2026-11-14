import { toast } from "react-toastify";
import { getSessionToken, isSameSessionUser, subscribeToSession } from "@/services/sessionStore";
import { requestNavigate } from "./errorHandler";

export const WAIT_MS = 30000;

const toastIds = new Set();
let subscribed = false;
let lastToken = null;
let toastSeq = 0;

const makeStore = () => {
    const map = new Map();
    return {
        set(key, value, owner = getSessionToken()) {
            ensureSubscribed();
            if (!owner || !isSameSessionUser(owner, getSessionToken())) return;
            map.set(String(key), { ...value, owner });
        },
        get(key) {
            ensureSubscribed();
            const entry = map.get(String(key));
            if (!entry || !isSameSessionUser(entry.owner, getSessionToken())) return null;
            return entry;
        },
        take(key) {
            const entry = this.get(key);
            map.delete(String(key));
            return entry;
        },
        remove(key, check) {
            const entry = map.get(String(key));
            if (entry && (!check || check(entry))) map.delete(String(key));
        },
        entries() {
            ensureSubscribed();
            const token = getSessionToken();
            return [...map.entries()].filter(([, entry]) => isSameSessionUser(entry.owner, token));
        },
        clear() {
            map.clear();
        },
    };
};

export const drafts = makeStore();
export const carry = makeStore();
export const saving = makeStore();

const resetAll = () => {
    drafts.clear();
    carry.clear();
    saving.clear();
    toastIds.forEach((id) => toast.dismiss(id));
    toastIds.clear();
};

function ensureSubscribed() {
    if (subscribed || typeof window === "undefined") return;
    subscribed = true;
    lastToken = getSessionToken();
    subscribeToSession(() => {
        const token = getSessionToken();
        if (!token || !isSameSessionUser(lastToken, token)) resetAll();
        lastToken = token;
    });
    toast.onChange((item) => {
        if (item.status === "removed") toastIds.delete(item.id);
    });
}

export const isOwnerSignedIn = (owner) => Boolean(owner) && isSameSessionUser(owner, getSessionToken());

export const latestDraft = () => {
    const list = drafts.entries().sort((a, b) => b[1].at - a[1].at);
    return { entry: list[0] ?? null, others: Math.max(0, list.length - 1) };
};

export const notifyPatientRecord = (owner, { text, links = [] }, { error = false } = {}) => {
    ensureSubscribed();
    if (!isOwnerSignedIn(owner)) return;
    toastSeq += 1;
    const toastId = `patient-record-${toastSeq}`;
    toastIds.add(toastId);
    const sticky = error || links.length > 0;
    const content = (
        <div>
            <p>{text}</p>
            {links.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-3">
                    {links.map((link) => (
                        <button
                            key={link.label}
                            type="button"
                            className="text-label font-semibold text-primary underline"
                            onClick={() => {
                                toast.dismiss(toastId);
                                requestNavigate(link.url, link.state);
                            }}
                        >
                            {link.label}
                        </button>
                    ))}
                </p>
            )}
        </div>
    );
    const options = { toastId, role: error ? "alert" : "status", autoClose: sticky ? false : undefined };
    if (error) toast.error(content, options);
    else toast.success(content, options);
};

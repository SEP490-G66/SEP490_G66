import api from "./api";

// "Now" for business screens comes from the backend (GET /api/clinic/now), not the device clock: a wrong device clock
// cannot shift the clinic day, and a fake time set on a test server (Clinic:FakeNow) reaches the screens too.
// At startup we keep the gap between the server and this device; later, now = device clock + gap.
// When the server time is frozen (FakeNowMode Frozen) the screens hold that moment still as well.
// Security timing (token expiry, request timeouts, cache TTLs) keeps using the device clock.

const SYNC_TIMEOUT_MS = 3000;

let offsetMs = 0;
let frozenAtMs = null;

export const serverNowMs = () => frozenAtMs ?? Date.now() + offsetMs;

export const serverNow = () => new Date(serverNowMs());

// Reads the server clock once; when it cannot be reached, the device clock is used
export const syncServerClock = async () => {
    try {
        const sentAt = Date.now();
        const response = await api.get("/api/clinic/now", { timeout: SYNC_TIMEOUT_MS });
        const receivedAt = Date.now();
        const data = response?.data?.data;
        const serverMs = Date.parse(data?.utcNow);
        if (Number.isNaN(serverMs)) return;
        frozenAtMs = data.isFrozen ? serverMs : null;
        // The server read its clock about halfway through the round trip
        offsetMs = serverMs - (sentAt + receivedAt) / 2;
    } catch {
        offsetMs = 0;
        frozenAtMs = null;
    }
};

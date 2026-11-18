import crypto from "node:crypto";
import { expect } from "@playwright/test";
import { ACCOUNTS } from "./ui";

// Calls made outside the screens: pre-conditions through the BE, the simulator's demo controls (device off, next capture
// fails) and the simulator's webhook. Development values of oze-clinic-be (appsettings.Development.json) and
// oze-xray-simulator (appsettings.json).
const API_URL = process.env.VITE_API_URL ?? "http://localhost:5080";
const SIMULATOR_URL = process.env.SIMULATOR_URL ?? "http://localhost:5026";
const SIMULATOR_KEY = process.env.SIMULATOR_API_KEY ?? "oze-xray-sim-secret-key-2026";
const WEBHOOK_SECRET = process.env.SIMULATOR_WEBHOOK_SECRET ?? "oze-sim-webhook-secret-2026";

export const PANO_DEVICE = "XR-PANO-01";
export const IO_DEVICE = "XR-IO-01";

// Bearer header of one of the sample accounts
export const authHeaders = async (request, account) => {
    const response = await request.post(`${API_URL}/api/auth/login`, { data: { identifier: account.email, password: account.password } });
    expect(response.ok(), `sign-in of ${account.email}`).toBeTruthy();
    return { Authorization: `Bearer ${(await response.json()).data.token}` };
};

export const api = async (request, method, path, headers, data) => {
    const response = await request.fetch(`${API_URL}${path}`, { method, headers, data });
    const body = await response.json().catch(() => null);
    return { status: response.status(), body };
};

// Two patients at the X-ray room with one Panoramic order each, nobody started imaging them yet (the newest ones).
// The doctor adds a Cephalometric order to A (no device takes it) and a Periapical order to B (intraoral sensor).
export const prepareOrders = async (request) => {
    const tech = await authHeaders(request, ACCOUNTS.technician);
    const doctor = await authHeaders(request, ACCOUNTS.doctor);
    const queue = (await api(request, "GET", "/api/imaging-requests/queue", tech)).body.data;

    const byPatient = new Map();
    for (const row of queue) byPatient.set(row.patientId, [...(byPatient.get(row.patientId) ?? []), row]);
    const candidates = [...byPatient.values()]
        .filter((rows) => rows.length === 1 && rows[0].imagingType === "Panoramic" && rows[0].requestStatus === "Pending")
        .map((rows) => rows[0])
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    expect(candidates.length, "two patients waiting at the X-ray room with one Panoramic order").toBeGreaterThanOrEqual(2);
    const [a, b] = candidates.slice(-2);

    const addOrder = async (order, imagingType, targetArea) => {
        const examinationId = (await api(request, "GET", `/api/imaging-requests/${order.id}`, doctor)).body.data.examinationId;
        const created = await api(request, "POST", `/api/examinations/${examinationId}/imaging-requests`, doctor, {
            imagingType,
            targetArea,
            clinicalIndication: "Playwright ISIT",
        });
        expect(created.status, `add ${imagingType} for ${order.patientName}: ${created.body?.message}`).toBe(200);
        return created.body.data.id;
    };

    return {
        patientA: a.patientName,
        panoA: a.id,
        cephA: await addOrder(a, "Cephalometric", "Sọ nghiêng"),
        patientB: b.patientName,
        panoB: b.id,
        periB: await addOrder(b, "Periapical X-ray", "Răng 36"),
    };
};

// ---------------------------------------------------------------- simulator demo controls

const simulator = (request, method, path, data) =>
    request.fetch(`${SIMULATOR_URL}${path}`, { method, headers: { "X-Api-Key": SIMULATOR_KEY }, data });

export const deviceState = async (request, deviceId) => (await (await simulator(request, "GET", `/api/v1/devices/${deviceId}`)).json()).state;

export const setDeviceState = async (request, deviceId, state) => {
    const response = await simulator(request, "POST", `/api/v1/demo/devices/${deviceId}/state`, { state, reason: "Playwright ISIT" });
    expect(response.ok(), `${deviceId} → ${state}: ${await response.text()}`).toBeTruthy();
};

// Back to READY from any state (OFFLINE / ERROR go through INITIALIZING)
export const makeReady = async (request, deviceId) => {
    const state = await deviceState(request, deviceId);
    if (state === "READY") return;
    if (state === "OFFLINE" || state === "ERROR") await setDeviceState(request, deviceId, "INITIALIZING");
    await setDeviceState(request, deviceId, "READY");
};

export const failNextCapture = async (request, failureCode, failureMessage) => {
    const response = await simulator(request, "POST", "/api/v1/demo/faults/next-capture", { failureCode, failureMessage });
    expect(response.ok(), "inject the capture failure").toBeTruthy();
};

export const clearFaults = async (request) => {
    await simulator(request, "DELETE", "/api/v1/demo/faults");
};

// ---------------------------------------------------------------- the simulator's webhook to the BE

// signature: undefined = signed with the shared secret, null = no header, a string = sent as it is
export const sendWebhook = async (request, rawBody, signature) => {
    const headers = { "Content-Type": "application/json", "X-Sim-Event-Id": `pw-${Date.now()}` };
    const signed = `sha256=${crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex")}`;
    if (signature !== null) headers["X-Sim-Signature"] = signature ?? signed;
    const response = await request.post(`${API_URL}/api/webhooks/imaging-simulator`, { headers, data: rawBody });
    return { status: response.status(), body: await response.json().catch(() => null) };
};

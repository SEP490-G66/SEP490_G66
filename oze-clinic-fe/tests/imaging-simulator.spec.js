import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, expectMessage, imagingQueue, login, openMenu, selectImagingPatient, uploadAndComplete } from "./helpers/ui";
import {
    IO_DEVICE,
    PANO_DEVICE,
    api,
    authHeaders,
    clearFaults,
    deviceState,
    failNextCapture,
    makeReady,
    prepareOrders,
    sendWebhook,
    setDeviceState,
} from "./helpers/simulator";

// Integration test of module 2 "Imaging Simulator" (sheet Integration_Test_ImagingSimulator, ISIT01-14).
// KTV Bảo captures the orders of BS. Khoa on the X-ray simulator (oze-xray-simulator, http://localhost:5026) from the
// "Chụp chiếu" screen; the BE starts, follows and cancels the capture on the simulator and stores the pictures.
// Patient A: Panoramic (XR-PANO-01) + Cephalometric (no device). Patient B: Periapical (XR-IO-01) + Panoramic.
// One case builds on the one before, so they run in order.

const CEPH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "mock", "xray", "pano_full_adult_01.png");
// Capture (3 s) + processing (3 s) on the simulator, plus the screen polling every second
const CAPTURE_TIMEOUT = 30_000;

test.describe.configure({ mode: "serial" });

const run = { patientA: "", panoA: 0, cephA: 0, patientB: "", panoB: 0, periB: 0, simulationB: "" };

test.beforeAll(async ({ request }) => {
    await clearFaults(request);
    await makeReady(request, PANO_DEVICE);
    await makeReady(request, IO_DEVICE);
    Object.assign(run, await prepareOrders(request));
});

test.afterAll(async ({ request }) => {
    await clearFaults(request);
    await makeReady(request, PANO_DEVICE);
});

// ---------------------------------------------------------------- screen helpers

const orderCard = (page, id) => page.getByRole("region", { name: `Chỉ định IR-${id}` });
const devicePanel = (card) => card.getByRole("region", { name: "Máy chụp" });
const captureBadge = (card, label) => devicePanel(card).getByText(label, { exact: true }).first();

// Opens the patient and calls them in (a patient with an order being imaged is already called in after a reload)
const openPatient = async (page, name) => {
    await selectImagingPatient(page, name);
    const callIn = page.getByRole("button", { name: "Gọi vào chụp" });
    const sendBack = page.getByRole("button", { name: "Trả về hàng chờ" });
    await expect(callIn.or(sendBack).first()).toBeVisible();
    if (await callIn.isVisible()) await callIn.click();
    await expect(sendBack).toBeVisible();
};

// Waits for the device list, so the order card shows the device chosen for it
const expectDevice = async (card, deviceId) => {
    await expect(devicePanel(card).getByRole("combobox")).toHaveValue(deviceId);
};

// "Bắt đầu chụp" with the given number of images; returns the answer of POST captures
const startCapture = async (page, card, imageCount = 1) => {
    await card.getByLabel("Số ảnh").fill(String(imageCount));
    const started = page.waitForResponse((response) => /\/api\/imaging-requests\/\d+\/captures$/.test(response.url()) && response.request().method() === "POST");
    await card.getByRole("button", { name: "Bắt đầu chụp" }).click();
    const response = await started;
    return { status: response.status(), body: await response.json() };
};

const expectCompleted = async (card, imageCount) => {
    await expect(captureBadge(card, "Hoàn tất")).toBeVisible({ timeout: CAPTURE_TIMEOUT });
    await expect(card.getByText(new RegExp(`^Máy đã trả về ${imageCount} ảnh`))).toBeVisible();
    await expect(card.getByRole("button", { name: /^Phóng to Ảnh / })).toHaveCount(imageCount);
};

// "Hoàn thành" of one order after a capture on the device (the BE already completed it when the pictures arrived)
const completeOrder = async (page, card, id) => {
    await card.getByRole("button", { name: "Hoàn thành", exact: true }).click();
    await page.getByRole("dialog", { name: "Xác nhận hoàn thành chụp" }).getByRole("button", { name: "Xác nhận hoàn thành" }).click();
    await expectMessage(page, new RegExp(`Đã gửi kết quả IR-${id} cho `));
};

// ---------------------------------------------------------------- patient A

test.describe("UC01_SelectDevice", () => {
    test("ISIT01 - Device and exposure are suggested for the order type", async ({ page }) => {
        await login(page, ACCOUNTS.technician);
        await openPatient(page, run.patientA);
        const card = orderCard(page, run.panoA);

        await expectDevice(card, PANO_DEVICE);
        await expect(captureBadge(card, "Sẵn sàng")).toBeVisible();
        await expect(devicePanel(card).getByRole("option", { name: new RegExp(`^${IO_DEVICE} .*không chụp được loại này`) })).toBeDisabled();
        await expect(card.getByLabel("Điện áp (kV)")).toHaveValue("70");
        await expect(card.getByLabel("Dòng (mA)")).toHaveValue("10");
        await expect(card.getByLabel("Thời gian phát tia (s)")).toHaveValue("14");
        await expect(card.getByRole("button", { name: "Bắt đầu chụp" })).toBeEnabled();
    });

    test("ISIT03 - Capture cannot start while the device is off", async ({ page, request }) => {
        await setDeviceState(request, PANO_DEVICE, "OFFLINE");
        try {
            await login(page, ACCOUNTS.technician);
            await openPatient(page, run.patientA);
            const card = orderCard(page, run.panoA);

            await expectDevice(card, PANO_DEVICE);
            await expect(card.getByText(`Máy ${PANO_DEVICE} đang ở trạng thái “Đã tắt”, chưa nhận lệnh chụp.`, { exact: false })).toBeVisible();
            await expect(card.getByRole("button", { name: "Bắt đầu chụp" })).toBeDisabled();
        } finally {
            await makeReady(request, PANO_DEVICE);
        }
    });
});

test.describe("UC02_CaptureImages", () => {
    test("ISIT05 - Capture with a number of images out of range", async ({ page }) => {
        await login(page, ACCOUNTS.technician);
        await openPatient(page, run.patientA);
        const card = orderCard(page, run.panoA);
        await expectDevice(card, PANO_DEVICE);

        const started = await startCapture(page, card, 11);
        expect(started.status).toBe(400);
        await expectMessage(page, "Số ảnh phải từ 1 đến 10.");
        await expect(captureBadge(card, "Sẵn sàng")).toBeVisible();
    });

    test("ISIT06 - Exposure out of the usual range is flagged", async ({ page }) => {
        await login(page, ACCOUNTS.technician);
        await openPatient(page, run.patientA);
        const card = orderCard(page, run.panoA);
        await expectDevice(card, PANO_DEVICE);

        await card.getByLabel("Điện áp (kV)").fill("120");
        const warning = card.getByText("Có thông số ngoài khoảng thường dùng.", { exact: false });
        await expect(warning).toBeVisible();
        await card.getByRole("button", { name: "Dùng thông số gợi ý" }).click();
        await expect(card.getByLabel("Điện áp (kV)")).toHaveValue("70");
        await expect(warning).toBeHidden();
    });
});

test.describe("UC03_CancelCapture", () => {
    test("ISIT09 - Cancel a running capture", async ({ page, request }) => {
        await login(page, ACCOUNTS.technician);
        await openPatient(page, run.patientA);
        const card = orderCard(page, run.panoA);
        await expectDevice(card, PANO_DEVICE);

        const started = await startCapture(page, card, 1);
        expect(started.status, started.body.message).toBe(200);
        await expect(captureBadge(card, "Đang chụp")).toBeVisible();
        await card.getByRole("button", { name: "Huỷ chụp" }).click();

        await expect(captureBadge(card, "Sẵn sàng")).toBeVisible();
        await expect(card.getByRole("button", { name: "Bắt đầu chụp" })).toBeVisible();
        await expect.poll(() => deviceState(request, PANO_DEVICE)).toBe("READY");
    });
});

test.describe("UC04_DeviceFailure", () => {
    test("ISIT10 - Device reports an error during the capture", async ({ page, request }) => {
        await failNextCapture(request, "DETECTOR_ERROR", "Detector not responding");
        await login(page, ACCOUNTS.technician);
        await openPatient(page, run.patientA);
        const card = orderCard(page, run.panoA);
        await expectDevice(card, PANO_DEVICE);

        const started = await startCapture(page, card, 1);
        expect(started.status, started.body.message).toBe(200);
        await expect(captureBadge(card, "Lỗi")).toBeVisible({ timeout: CAPTURE_TIMEOUT });
        await expect(card.getByText("Chưa nhận được ảnh từ máy")).toBeVisible();
        await expect(card.getByText(/Detector not responding/)).toBeVisible();
        await expect(card.getByRole("button", { name: "Chụp lại" })).toBeVisible();
    });

    test("ISIT11 - Retake after a device error", async ({ page, request }) => {
        await failNextCapture(request, "DETECTOR_ERROR", "Detector not responding");
        await login(page, ACCOUNTS.technician);
        await openPatient(page, run.patientA);
        const card = orderCard(page, run.panoA);
        await expectDevice(card, PANO_DEVICE);
        await startCapture(page, card, 1);
        await expect(captureBadge(card, "Lỗi")).toBeVisible({ timeout: CAPTURE_TIMEOUT });

        await card.getByRole("button", { name: "Chụp lại" }).click();
        await expectCompleted(card, 1);
        await completeOrder(page, card, run.panoA);
    });
});

test.describe("UC01_SelectDevice", () => {
    test("ISIT02 - Order type without a connected device", async ({ page }) => {
        await login(page, ACCOUNTS.technician);
        await openPatient(page, run.patientA);
        const card = orderCard(page, run.cephA);

        await expect(captureBadge(card, "Không hỗ trợ")).toBeVisible();
        await expect(card.getByText("Chưa có máy kết nối cho loại chụp “Phim sọ nghiêng”.", { exact: false })).toBeVisible();
        await expect(card.getByRole("button", { name: "Bắt đầu chụp" })).toHaveCount(0);

        // The only way left: upload by hand, which also completes the last order of A
        const { id } = await uploadAndComplete(page, CEPH);
        expect(id).toBe(run.cephA);
        await expect(imagingQueue(page).getByRole("button", { name: new RegExp(run.patientA) })).toHaveCount(0);
    });
});

// ---------------------------------------------------------------- patient B

test.describe("UC02_CaptureImages", () => {
    test("ISIT04 - Capture several images on the device", async ({ page }) => {
        await login(page, ACCOUNTS.technician);
        await openPatient(page, run.patientB);
        const card = orderCard(page, run.periB);
        await expectDevice(card, IO_DEVICE);

        const started = await startCapture(page, card, 2);
        expect(started.status, started.body.message).toBe(200);
        run.simulationB = started.body.data.simulationId;
        await expectCompleted(card, 2);
        await expect(card.getByText("Ảnh đã gửi cho bác sĩ.", { exact: false })).toBeVisible();
    });

    test("ISIT07 - Last order captured: the patient goes back to the doctor", async ({ page }) => {
        await login(page, ACCOUNTS.technician);
        await openPatient(page, run.patientB);
        // The Periapical order was completed when its pictures arrived: only the Panoramic one is left
        await expect(orderCard(page, run.periB)).toHaveCount(0);
        const card = orderCard(page, run.panoB);
        await expectDevice(card, PANO_DEVICE);

        await startCapture(page, card, 1);
        await expectCompleted(card, 1);
        await completeOrder(page, card, run.panoB);
        await expect(imagingQueue(page).getByRole("button", { name: new RegExp(run.patientB) })).toHaveCount(0);

        await login(page, ACCOUNTS.doctor);
        await openMenu(page, "Khám bệnh");
        await expect(page.locator("li").filter({ hasText: run.patientB }).getByText("Chụp xong · khám tiếp")).toBeVisible();
    });

    test("ISIT08 - Doctor sees the pictures taken on the device", async ({ page }) => {
        await login(page, ACCOUNTS.doctor);
        await openMenu(page, "Duyệt kết quả chụp");
        const list = page.getByRole("region", { name: "Danh sách kết quả chụp" });
        await list.getByPlaceholder("Tìm bệnh nhân, mã yêu cầu").fill(`IR-${run.periB}`);
        const item = list.getByRole("listitem").filter({ hasText: `IR-${run.periB}` });
        await expect(item).toHaveCount(1);
        await item.getByRole("button").click();
        // The two pictures of ISIT04, one thumbnail each
        await expect(page.getByRole("button", { name: /^Ảnh \d+$/ })).toHaveCount(2);
    });
});

// ---------------------------------------------------------------- webhook of the simulator (no screen)

test.describe("UC05_SimulatorWebhook", () => {
    const completedEvent = () =>
        JSON.stringify({
            eventId: `pw-${Date.now()}`,
            eventType: "CAPTURE_COMPLETED",
            sequence: 99,
            simulationId: run.simulationB,
            orderReference: `IR-${run.periB}`,
            deviceId: IO_DEVICE,
            state: "COMPLETED",
            progress: 100,
            images: [],
            occurredAt: new Date().toISOString(),
        });

    test("ISIT12 - Webhook without a signature is refused", async ({ request }) => {
        const response = await sendWebhook(request, completedEvent(), null);
        expect(response.status).toBe(401);
    });

    test("ISIT13 - Webhook with a wrong signature is refused", async ({ request }) => {
        const response = await sendWebhook(request, completedEvent(), `sha256=${"0".repeat(64)}`);
        expect(response.status).toBe(401);
    });

    test("ISIT14 - Repeated completion event does not store the pictures twice", async ({ request }) => {
        const tech = await authHeaders(request, ACCOUNTS.technician);
        const before = await api(request, "GET", `/api/imaging-requests/${run.periB}/captures/${run.simulationB}`, tech);
        expect(before.body.data.images).toHaveLength(2);

        const response = await sendWebhook(request, completedEvent());
        expect(response.status, response.body?.message).toBe(200);

        const after = await api(request, "GET", `/api/imaging-requests/${run.periB}/captures/${run.simulationB}`, tech);
        expect(after.body.data.status).toBe("COMPLETED");
        expect(after.body.data.images).toHaveLength(2);
    });
});

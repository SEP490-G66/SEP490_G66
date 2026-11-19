import { expect, test } from "@playwright/test";
import { ACCOUNTS, checkInWalkIns, clinicDate, expectMessage, goToExamStep, login, openMenu } from "./helpers/ui";
import { api, authHeaders } from "./helpers/simulator";

// Integration test of module 6 "Queue Calling" (sheet Integration_Test_QueueCalling, QCIT01-13).
// The doctor calls patients of the examination queue ("Gọi vào khám"), reports one absent ("Báo vắng mặt") and lets
// one in ("Bắt đầu khám"); the rules of api/queues call / skip / call-next and the public display board.
// BS. Lê Thu Hà (room "Phòng khám 2") works on three test patients waiting in her queue today ("Bệnh nhân Test …"):
// the ones already there, otherwise new walk-ins checked in for the run. Real patients are never called.

const DOCTOR = { email: "ha.lt@oze.vn", password: "password123" };
const PATIENT = { email: "test@example.com", password: "password123" };
const M = {
    onlyWaiting: "Only a number that is waiting can be called",
    onlyCalled: "Only a number that has been called can be skipped",
    notYourCall: "You can only call your own patients",
    notYourSkip: "You can only skip your own patients",
    notFound: "Queue number not found",
    notToday: "This number is not in today's queue",
};
const TEST_NAME = /^Bệnh nhân Test /;

test.describe.configure({ mode: "serial" });

const h = {};
const run = { a: null, b: null, c: null };

const expectError = (result, status, message) => {
    expect(result.status, JSON.stringify(result.body)).toBe(status);
    expect(result.body.message).toBe(message);
};

// Today's examination queue of BS. Hà as the front desk sees it
const doctorQueue = async (request) => {
    const list = (await api(request, "GET", "/api/queues?queueType=Examination", h.receptionist)).body.data;
    return list.filter((entry) => entry.staffName?.includes("Thu Hà"));
};

// The doctor's shift running now (or started and not ended), started when it is not yet
const startShift = async (request) => {
    const shifts = (await api(request, "GET", "/api/schedules/my", h.doctor)).body.data.filter((item) => item.scheduleDate === clinicDate());
    if (shifts.some((item) => item.actualStartTime && !item.actualEndTime)) return;
    const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    const shift = shifts.find((item) => item.shiftStart.slice(0, 5) <= now && now < item.shiftEnd.slice(0, 5));
    expect(shift, "BS. Thu Hà has a shift running now").toBeTruthy();
    const started = await api(request, "POST", `/api/schedules/my/${shift.id}/start`, h.doctor);
    expect(started.status, started.body?.message).toBe(200);
};

// Ends the examination a test patient left open and sends back a called test patient, so one patient can be called in
const closeOpenTestVisits = async (browser, request) => {
    for (const entry of (await doctorQueue(request)).filter((item) => TEST_NAME.test(item.patientName) && item.status === "CALLED")) {
        await api(request, "POST", `/api/queues/${entry.id}/skip`, h.doctor);
    }
    if (!(await doctorQueue(request)).some((item) => TEST_NAME.test(item.patientName) && item.status === "IN_PROGRESS")) return;
    const page = await browser.newPage();
    await login(page, DOCTOR);
    await openMenu(page, "Khám bệnh");
    // The row reads "<number> <name> Đang khám"
    const open = page.locator("li").filter({ hasText: "Bệnh nhân Test " }).filter({ has: page.getByText("Đang khám", { exact: true }) });
    await open.first().getByRole("button").first().click();
    // Ending needs a diagnosis or a note: the note is on step 2 "Khám & Chẩn đoán"
    await goToExamStep(page);
    const note = page.getByLabel("Mô tả thêm");
    if (!(await note.inputValue())) {
        await note.fill("Kết thúc lượt khám của dữ liệu test.");
        await page.getByRole("button", { name: "Lưu nháp" }).click();
        await expect(page.getByText(/Đã lưu nháp lúc \d{2}:\d{2}/)).toBeVisible();
    }
    await page.getByRole("button", { name: "Kết thúc lượt khám" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Kết thúc lượt khám" });
    await dialog.getByRole("button", { name: "Kết thúc lượt khám" }).click();
    await expect(dialog).toBeHidden();
    await page.close();
};

test.beforeAll(async ({ request, browser }) => {
    h.doctor = await authHeaders(request, DOCTOR);
    h.otherDoctor = await authHeaders(request, ACCOUNTS.doctor);
    h.receptionist = await authHeaders(request, ACCOUNTS.receptionist);
    h.patient = await authHeaders(request, PATIENT);

    await startShift(request);
    await closeOpenTestVisits(browser, request);
    const waitingTests = async () =>
        (await doctorQueue(request)).filter((item) => TEST_NAME.test(item.patientName) && item.status === "WAITING" && item.skipCount === 0);
    if ((await waitingTests()).length < 3) await checkInWalkIns(request, "Thu Hà", 3 - (await waitingTests()).length);
    const waiting = (await waitingTests()).sort((x, y) => x.queueNumber - y.queueNumber);
    expect(waiting.length, "three test patients waiting for BS. Thu Hà").toBeGreaterThanOrEqual(3);
    [run.a, run.b, run.c] = waiting.slice(-3);
});

test.afterAll(async ({ request, browser }) => {
    await closeOpenTestVisits(browser, request);
});

// ---------------------------------------------------------------- UC01 the doctor calls a patient

const queuePanel = (page) => page.getByRole("complementary", { name: /^Hàng chờ · / });
const row = (page, entry) => queuePanel(page).getByRole("listitem").filter({ hasText: entry.patientName });
const openQueue = async (page) => {
    await login(page, DOCTOR);
    await openMenu(page, "Khám bệnh");
    await expect(queuePanel(page)).toBeVisible();
};

test("QCIT01 Waiting patients are listed in the doctor's queue", async ({ page }) => {
    await openQueue(page);
    for (const entry of [run.a, run.b, run.c]) {
        await expect(row(page, entry)).toContainText(String(entry.queueNumber));
        await expect(row(page, entry).getByText("Đang chờ")).toBeVisible();
        await expect(row(page, entry).getByRole("button", { name: "Gọi vào khám" })).toBeEnabled();
    }
});

test("QCIT02 Call a patient into the room", async ({ page }) => {
    await openQueue(page);
    await row(page, run.a).getByRole("button", { name: "Gọi vào khám" }).click();
    await expectMessage(page, new RegExp(`Đã gọi số 0?${run.a.queueNumber} · ${run.a.patientName} vào phòng khám\\.`));
    await expect(row(page, run.a).getByText("Đã gọi", { exact: true })).toBeVisible();
    await expect(row(page, run.a).getByRole("button", { name: "Báo vắng mặt" })).toBeVisible();
    await expect(row(page, run.a).getByRole("button", { name: "Bắt đầu khám" })).toBeVisible();
    // One patient in at a time
    await expect(row(page, run.b).getByRole("button", { name: "Gọi vào khám" })).toBeDisabled();
    await expect(row(page, run.c).getByRole("button", { name: "Gọi vào khám" })).toBeDisabled();
});

test("QCIT03 Report a called patient absent", async ({ page, request }) => {
    await openQueue(page);
    await row(page, run.a).getByRole("button", { name: "Báo vắng mặt" }).click();
    const dialog = page.getByRole("dialog", { name: "Báo vắng mặt" });
    await expect(dialog).toContainText(`Số ${run.a.queueNumber} · ${run.a.patientName}`);
    await dialog.getByRole("button", { name: "Báo vắng mặt" }).click();
    await expectMessage(page, new RegExp(`Đã chuyển số 0?${run.a.queueNumber} · ${run.a.patientName} xuống cuối hàng chờ\\.`));
    await expect(row(page, run.a).getByText("Đang chờ")).toBeVisible();

    const entry = (await doctorQueue(request)).find((item) => item.id === run.a.id);
    expect(entry).toMatchObject({ status: "WAITING", skipCount: 1 });
    // Behind the patients never skipped
    const names = await queuePanel(page).getByRole("listitem").allInnerTexts();
    const position = (name) => names.findIndex((text) => text.includes(name));
    expect(position(run.a.patientName)).toBeGreaterThan(position(run.b.patientName));
    expect(position(run.a.patientName)).toBeGreaterThan(position(run.c.patientName));
});

test("QCIT04 Call a patient and start the examination", async ({ page }) => {
    await openQueue(page);
    await row(page, run.b).getByRole("button", { name: "Gọi vào khám" }).click();
    await expect(row(page, run.b).getByRole("button", { name: "Bắt đầu khám" })).toBeVisible();
    await row(page, run.b).getByRole("button", { name: "Bắt đầu khám" }).click();
    await expect(row(page, run.b).getByText("Đang khám", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Quy trình khám" })).toBeVisible();
});

// ---------------------------------------------------------------- UC02 rules of calling

test("QCIT05 Call a patient who is not waiting", async ({ request }) => {
    expectError(await api(request, "POST", `/api/queues/${run.b.id}/call`, h.doctor), 400, M.onlyWaiting);
});

test("QCIT06 Report absent a patient who was not called", async ({ request }) => {
    expectError(await api(request, "POST", `/api/queues/${run.c.id}/skip`, h.doctor), 400, M.onlyCalled);
});

test("QCIT07 Doctor calls or reports absent another doctor's patient", async ({ request }) => {
    expectError(await api(request, "POST", `/api/queues/${run.c.id}/call`, h.otherDoctor), 403, M.notYourCall);
    expectError(await api(request, "POST", `/api/queues/${run.c.id}/skip`, h.otherDoctor), 403, M.notYourSkip);
});

test("QCIT08 Number that does not exist", async ({ request }) => {
    expectError(await api(request, "POST", "/api/queues/99999999/call", h.doctor), 404, M.notFound);
    expectError(await api(request, "POST", "/api/queues/99999999/skip", h.doctor), 404, M.notFound);
});

test("QCIT09 Number of another day", async ({ request }) => {
    // Numbers are created in order: the one before today's first is from an earlier day
    const today = (await api(request, "GET", "/api/queues", h.receptionist)).body.data;
    const earlier = Math.min(...today.map((item) => item.id)) - 1;
    const result = await api(request, "POST", `/api/queues/${earlier}/call`, h.receptionist);
    test.skip(result.status === 404, "no number from an earlier day");
    expectError(result, 400, M.notToday);
});

test("QCIT10 Patient or anonymous user calls a number", async ({ request }) => {
    expect((await api(request, "POST", `/api/queues/${run.c.id}/call`, h.patient)).status).toBe(403);
    expect((await api(request, "POST", `/api/queues/${run.c.id}/call`, {})).status).toBe(401);
    expect((await api(request, "POST", `/api/queues/${run.c.id}/skip`, {})).status).toBe(401);
});

// ---------------------------------------------------------------- UC03 public display board

test("QCIT11 Display board hides patient details", async ({ request }) => {
    const { status, body } = await api(request, "GET", "/api/queues?queueType=Examination", {});
    expect(status).toBe(200);
    const entry = body.data.find((item) => item.id === run.c.id);
    expect(entry, "the waiting number is on the board").toBeTruthy();
    expect(entry.patientName).not.toBe(run.c.patientName);
    expect(entry.patientName).toMatch(/^(\S\*\*\*\s?)+$/);
    expect(entry.patientName.startsWith("B***")).toBe(true);
    expect(entry.patientCode ?? "").toBe("");
    expect(entry.notes).toBeNull();
    expect(entry.queueNumber).toBe(run.c.queueNumber);
});

test("QCIT12 Staff see full patient details", async ({ request }) => {
    const entry = (await doctorQueue(request)).find((item) => item.id === run.c.id);
    expect(entry.patientName).toBe(run.c.patientName);
    expect(entry.patientCode).toBeTruthy();
});

// ---------------------------------------------------------------- UC04 call the next number

test("QCIT13 Call the next waiting number", async ({ request }) => {
    const waiting = (await doctorQueue(request)).filter((item) => item.status === "WAITING");
    test.skip(!waiting.every((item) => TEST_NAME.test(item.patientName)), "real patients are waiting: call-next would call one");
    // B is being examined: finish it first is not needed, the doctor may call while a number is in the room through the API
    const { status, body } = await api(request, "POST", "/api/queues/call-next?queueType=Examination", h.doctor);
    expect(status, body?.message).toBe(200);
    expect(body.data.id, "C was never skipped, A was: C goes first").toBe(run.c.id);
    expect(body.message).toBe(`Number ${run.c.queueNumber} called successfully.`);
    // Back to waiting, so the run leaves nobody called
    expect((await api(request, "POST", `/api/queues/${run.c.id}/skip`, h.doctor)).status).toBe(200);
});

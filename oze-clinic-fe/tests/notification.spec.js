import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers/ui";
import { api, authHeaders } from "./helpers/simulator";

// Integration test of module 7 "Notification" (sheet Integration_Test_Notification, NTIT01-15).
// In-app notifications of the signed-in user (api/notifications) and the bell in the header, with the live push (SignalR).
// Notifications are made by a public "Đăng ký tư vấn" request, which notifies every receptionist. The test requests
// ("Khách Test NT...") are closed again at the end so they do not stay in the receptionists' call list.

const RECEPTIONIST = ACCOUNTS.receptionist;
const OTHER_RECEPTIONIST = { email: "trang.pt@oze.vn", password: "password123" };
const DOCTOR = ACCOUNTS.doctor;
const PATIENT = { email: "test@example.com", password: "password123" };
const NO_NOTIFICATIONS = { email: "tuan.hm@oze.vn", password: "password123" };
const TITLE = "Có yêu cầu tư vấn mới";
const NOT_FOUND = "Notification not found.";
const EMPTY = "Bạn chưa có thông báo nào.";

test.describe.configure({ mode: "serial" });

const headers = {};
const created = [];
const tag = Date.now().toString().slice(-5);

// A public consultation request; returns { id, name, message } of the notification it makes
const requestConsultation = async (request) => {
    const index = created.length + 1;
    const phone = `09${tag}${String(index).padStart(3, "0")}`;
    const { status, body } = await api(request, "POST", "/api/consultation-requests", {}, { fullName: `Khách Test NT${tag}-${index}`, phoneNumber: phone });
    expect(status, body?.message).toBe(200);
    created.push(body.data.id);
    return { id: body.data.id, message: `${body.data.fullName} (${body.data.phoneNumber}) gửi yêu cầu tư vấn. Gọi lại cho khách.` };
};

const list = async (request, role, query = "") => (await api(request, "GET", `/api/notifications${query}`, headers[role])).body.data;
const unread = async (request, role) => (await api(request, "GET", "/api/notifications/unread-count", headers[role])).body.data.unreadCount;
const readAll = (request, role) => api(request, "POST", "/api/notifications/read-all", headers[role]);

const bell = (page) => page.getByRole("button", { name: /^Thông báo/ });
const panel = (page) => page.getByRole("region", { name: "Thông báo" });
const items = (page) => panel(page).getByRole("listitem");

// Signs in and waits on a light page with the header: the role's dashboard sends many queries at once, which can hold
// back the bell's own calls on a busy machine
const signIn = async (page, account) => {
    await login(page, account);
    await page.goto("/change-password");
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
};

test.beforeAll(async ({ request }) => {
    headers.receptionist = await authHeaders(request, RECEPTIONIST);
    headers.other = await authHeaders(request, OTHER_RECEPTIONIST);
    headers.doctor = await authHeaders(request, DOCTOR);
    headers.patient = await authHeaders(request, PATIENT);
});

test.afterAll(async ({ request }) => {
    for (const id of created) {
        await api(request, "POST", `/api/consultation-requests/${id}/handle`, headers.receptionist, { status: "Closed", note: "Playwright NTIT" });
    }
});

// ---------------------------------------------------------------- UC01 list my notifications

test("NTIT01 User without notifications opens the bell", async ({ page, request }) => {
    headers.none = await authHeaders(request, NO_NOTIFICATIONS);
    test.skip((await list(request, "none")).totalItems > 0, "the manager already has notifications");
    await signIn(page, NO_NOTIFICATIONS);
    await expect(bell(page)).toHaveAccessibleName("Thông báo");
    await bell(page).click();
    await expect(panel(page).getByText(EMPTY)).toBeVisible();
    await expect(panel(page).getByRole("button", { name: "Đánh dấu tất cả đã đọc" })).toBeDisabled();
});

test("NTIT02 A new consultation request notifies the receptionists", async ({ request }) => {
    const before = await unread(request, "receptionist");
    const doctorBefore = (await list(request, "doctor")).totalItems;
    const made = await requestConsultation(request);

    const mine = await list(request, "receptionist");
    expect(mine.items[0]).toMatchObject({ title: TITLE, message: made.message, referenceType: "ConsultationRequest", referenceId: String(made.id), isRead: false, readAt: null });
    expect(mine.unreadCount).toBe(before + 1);
    expect(await unread(request, "receptionist")).toBe(before + 1);
    expect((await list(request, "other")).items[0], "every receptionist").toMatchObject({ title: TITLE, referenceId: String(made.id) });
    expect((await list(request, "doctor")).totalItems, "not the doctors").toBe(doctorBefore);
});

test("NTIT03 Pages of notifications", async ({ request }) => {
    while ((await list(request, "receptionist")).totalItems < 3) await requestConsultation(request);
    const all = await list(request, "receptionist", "?pageSize=50");
    const second = await list(request, "receptionist", "?page=2&pageSize=2");
    expect(second.items.map((item) => item.id)).toEqual(all.items.slice(2, 4).map((item) => item.id));
    expect(second.totalPages).toBe(Math.ceil(all.totalItems / 2));
    const dates = all.items.map((item) => item.createdAt);
    expect([...dates].sort().reverse(), "newest first").toEqual(dates);

    expect((await list(request, "receptionist", "?pageSize=100")).pageSize, "at most 50").toBe(50);
    const defaults = await list(request, "receptionist", "?page=0&pageSize=0");
    expect([defaults.page, defaults.pageSize]).toEqual([1, 20]);
});

test("NTIT04 Only unread notifications", async ({ request }) => {
    const mine = await list(request, "receptionist", "?unreadOnly=true&pageSize=50");
    expect(mine.items.length).toBeGreaterThan(0);
    expect(mine.items.every((item) => !item.isRead)).toBe(true);
    expect(mine.totalItems).toBe(mine.unreadCount);
});

test("NTIT05 Notifications without signing in", async ({ request }) => {
    for (const [method, path] of [["GET", ""], ["GET", "/unread-count"], ["POST", "/1/read"], ["POST", "/read-all"]]) {
        expect((await api(request, method, `/api/notifications${path}`, {})).status, `${method} ${path}`).toBe(401);
    }
});

// ---------------------------------------------------------------- UC02 mark as read

test("NTIT06 Mark one notification as read", async ({ request }) => {
    const before = await list(request, "receptionist");
    const target = before.items.find((item) => !item.isRead);
    const first = await api(request, "POST", `/api/notifications/${target.id}/read`, headers.receptionist);
    expect(first.status).toBe(200);
    expect(first.body.data.unreadCount).toBe(before.unreadCount - 1);
    const item = (await list(request, "receptionist", "?pageSize=50")).items.find((x) => x.id === target.id);
    expect(item.isRead).toBe(true);
    expect(item.readAt).toBeTruthy();

    const again = await api(request, "POST", `/api/notifications/${target.id}/read`, headers.receptionist);
    expect(again.body.data.unreadCount, "reading it again changes nothing").toBe(before.unreadCount - 1);
});

test("NTIT07 Mark another user's notification as read", async ({ request }) => {
    const theirs = (await list(request, "patient")).items[0];
    test.skip(!theirs, "the patient has no notification");
    const { status, body } = await api(request, "POST", `/api/notifications/${theirs.id}/read`, headers.receptionist);
    expect(status).toBe(404);
    expect(body.message).toBe(NOT_FOUND);
    expect((await list(request, "patient")).items[0].isRead, "the patient's notification is unchanged").toBe(theirs.isRead);
});

test("NTIT08 Mark a notification that does not exist", async ({ request }) => {
    const { status, body } = await api(request, "POST", "/api/notifications/999999999/read", headers.receptionist);
    expect(status).toBe(404);
    expect(body.message).toBe(NOT_FOUND);
});

test("NTIT09 Mark all as read", async ({ request }) => {
    const { status, body } = await readAll(request, "receptionist");
    expect(status).toBe(200);
    expect(body.data.unreadCount).toBe(0);
    expect(await unread(request, "receptionist")).toBe(0);
    expect((await list(request, "receptionist", "?unreadOnly=true")).totalItems).toBe(0);
    expect((await list(request, "other")).unreadCount, "other receptionists keep theirs").toBeGreaterThan(0);
});

// ---------------------------------------------------------------- UC03 the bell

test("NTIT10 Bell shows the unread notifications", async ({ page, request }) => {
    await readAll(request, "receptionist");
    const older = await requestConsultation(request);
    const newer = await requestConsultation(request);
    await signIn(page, RECEPTIONIST);
    await expect(bell(page)).toHaveAccessibleName("Thông báo, 2 chưa đọc");
    await bell(page).click();
    await expect(panel(page).getByRole("heading", { name: "Thông báo" })).toBeVisible();
    for (const [index, made] of [newer, older].entries()) {
        await expect(items(page).nth(index)).toContainText(TITLE);
        await expect(items(page).nth(index)).toContainText(made.message);
        await expect(items(page).nth(index)).toContainText("Chưa đọc");
    }
    await expect(items(page).nth(2)).not.toContainText("Chưa đọc");
});

test("NTIT11 New notification arrives while the page is open", async ({ page, request }) => {
    await signIn(page, RECEPTIONIST);
    await expect(bell(page)).toHaveAccessibleName("Thông báo, 2 chưa đọc");
    await page.waitForTimeout(1500); // the live connection is opened after the page loads
    const made = await requestConsultation(request);
    const toast = page.locator(".Toastify").getByText(made.message);
    await expect(toast).toBeVisible();
    await expect(page.locator(".Toastify").getByText(TITLE)).toBeVisible();
    await expect(bell(page)).toHaveAccessibleName("Thông báo, 3 chưa đọc");
    await bell(page).click();
    await expect(items(page).first()).toContainText(made.message);
});

test("NTIT12 Open a notification", async ({ page }) => {
    await signIn(page, RECEPTIONIST);
    await bell(page).click();
    await items(page).first().getByRole("button").click();
    await expect(page).toHaveURL(/\/reception\/consultations/);
    await expect(bell(page)).toHaveAccessibleName("Thông báo, 2 chưa đọc");
    await bell(page).click();
    await expect(items(page).first()).not.toContainText("Chưa đọc");
});

test("NTIT13 Mark all as read on the bell", async ({ page }) => {
    await signIn(page, RECEPTIONIST);
    await bell(page).click();
    await panel(page).getByRole("button", { name: "Đánh dấu tất cả đã đọc" }).click();
    await expect(bell(page)).toHaveAccessibleName("Thông báo");
    await expect(panel(page).getByRole("button", { name: "Đánh dấu tất cả đã đọc" })).toBeDisabled();
    await expect(panel(page).getByText("Chưa đọc")).toHaveCount(0);
});

test("NTIT14 Pages on the bell", async ({ page, request }) => {
    while ((await list(request, "receptionist")).totalItems <= 20) await requestConsultation(request);
    const { totalPages } = await list(request, "receptionist");
    await signIn(page, RECEPTIONIST);
    await bell(page).click();
    const pager = page.getByRole("navigation", { name: "Phân trang thông báo" });
    await expect(pager.getByText(`Trang 1 / ${totalPages}`)).toBeVisible();
    await expect(items(page)).toHaveCount(20);
    await expect(pager.getByRole("button", { name: "Trang trước" })).toBeDisabled();
    await pager.getByRole("button", { name: "Trang sau" }).click();
    await expect(pager.getByText(`Trang 2 / ${totalPages}`)).toBeVisible();
    await expect(items(page).first()).toBeVisible();
    await pager.getByRole("button", { name: "Trang trước" }).click();
    await expect(pager.getByText(`Trang 1 / ${totalPages}`)).toBeVisible();
});

// ---------------------------------------------------------------- UC04 patient

test("NTIT15 Patient opens a notification of an appointment", async ({ page, request }) => {
    const notification = (await list(request, "patient", "?pageSize=50")).items.find((item) => item.referenceType === "Appointment");
    test.skip(!notification, "the patient has no appointment notification");
    await signIn(page, PATIENT);
    await bell(page).click();
    await items(page).filter({ hasText: notification.title }).first().getByRole("button").click();
    await expect(page).toHaveURL(new RegExp(`/appointments/${notification.referenceId}$`));
    const after = (await list(request, "patient", "?pageSize=50")).items.find((item) => item.id === notification.id);
    expect(after.isRead).toBe(true);
});

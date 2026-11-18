import { expect } from "@playwright/test";

// Accounts of the BE sample data (SampleDataSeeder, password "password123").
// BS. Trần Minh Khoa and KTV Phạm Quốc Bảo work the morning shift that the sample data starts for them.
export const ACCOUNTS = {
    doctor: { email: "khoa.tm@oze.vn", password: "password123" },
    technician: { email: "bao.pq@oze.vn", password: "password123" },
    receptionist: { email: "mai.lt@oze.vn", password: "password123" },
};

// Signs in from a clean session, so one test can switch from the doctor to the technician and back
const API_URL = process.env.VITE_API_URL ?? "http://localhost:5080";

// Pre-condition through the BE (what the front desk does at the counter): checks in `count` new walk-in patients for
// the doctor, so every run has patients nobody examined yet. Only adds data. Returns their names; fewer when the BE
// refuses, which it does once the doctor's shifts of the day are over.
export const checkInWalkIns = async (request, doctorName, count) => {
    const signIn = await request.post(`${API_URL}/api/auth/login`, { data: { identifier: ACCOUNTS.receptionist.email, password: ACCOUNTS.receptionist.password } });
    expect(signIn.ok(), "receptionist sign-in").toBeTruthy();
    const headers = { Authorization: `Bearer ${(await signIn.json()).data.token}` };

    const onDuty = await (await request.get(`${API_URL}/api/schedules/doctors-on-duty`, { headers })).json();
    const doctor = onDuty.data.find((item) => item.doctorName.includes(doctorName));
    expect(doctor, `${doctorName} has a shift today`).toBeTruthy();

    const names = [];
    for (let i = 0; i < count; i++) {
        const stamp = `${Date.now()}`.slice(-7) + i;
        const fullName = `Bệnh nhân Test ${stamp.slice(-4)}`;
        const response = await request.post(`${API_URL}/api/appointments/walk-in`, {
            headers,
            data: { fullName, phoneNumber: `09${stamp.padStart(8, "0").slice(-8)}`, gender: "Male", doctorId: doctor.doctorId, note: "Playwright IWIT" },
        });
        if (!response.ok()) {
            console.warn(`Walk-in check-in refused: ${(await response.json()).message}`);
            break;
        }
        names.push(fullName);
    }
    return names;
};

// New patients in the doctor's queue: "Đang chờ" with "Gọi vào khám" (not back from or at the X-ray room)
export const newWaitingPatients = async (page) => {
    await openMenu(page, "Khám bệnh");
    await expect(page.getByText(/^Hàng chờ · /)).toBeVisible();
    await expect(page.locator("li").filter({ has: page.getByRole("button") }).first()).toBeVisible();
    const rows = page
        .locator("li")
        .filter({ has: page.getByText("Đang chờ", { exact: true }) })
        .filter({ has: page.getByRole("button", { name: "Gọi vào khám" }) });
    return (await rows.locator("span.truncate.font-semibold").allInnerTexts()).map((name) => name.trim());
};

export const login = async (page, { email, password }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
    });
    await page.goto("/login");
    await page.locator("#identifier").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
};

export const openMenu = async (page, label) => {
    await page.getByRole("link", { name: label, exact: true }).first().click();
};

// A toast of react-toastify, or an inline notice
export const expectMessage = async (page, text) => {
    await expect(page.getByText(text).first()).toBeVisible();
};

// "yyyy-mm-dd" in the clinic time zone, offset in days from today
export const clinicDate = (offset = 0) => {
    const date = new Date(Date.now() + offset * 86_400_000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);
};

// ---------------------------------------------------------------- doctor: "Khám bệnh"

const queueItem = (page, name) => page.locator("li").filter({ hasText: name }).filter({ has: page.getByRole("button") });

// Opens the doctor's exam on the patient: "Gọi vào khám" then "Bắt đầu khám" in the queue, skipping what is already done.
// Also takes back a patient returned from the X-ray room ("Chụp xong · khám tiếp").
export const startExamination = async (page, name) => {
    await openMenu(page, "Khám bệnh");
    const item = queueItem(page, name);
    await expect(item).toBeVisible();
    if (await item.getByText("Đang khám", { exact: true }).count()) return;
    if (!(await item.getByRole("button", { name: "Bắt đầu khám" }).count())) await item.getByRole("button", { name: "Gọi vào khám" }).click();
    await item.getByRole("button", { name: "Bắt đầu khám" }).click();
    await expect(item.getByText("Đang khám", { exact: true })).toBeVisible();
};

// Step 2 "Khám & Chẩn đoán": "Chuyển sang Khám" from step 1, or the stepper once the step was reached before
export const goToExamStep = async (page) => {
    const next = page.getByRole("button", { name: "Chuyển sang Khám" });
    const order = page.getByRole("button", { name: "+ Chỉ định chụp X-quang" });
    const stepper = page.getByRole("navigation", { name: "Quy trình khám" }).getByRole("button", { name: /Khám & Chẩn đoán/ });
    await expect(next.or(order).or(stepper).first()).toBeVisible();
    if (await order.isVisible()) return;
    if (await next.isVisible()) await next.click();
    else await stepper.click();
    await expect(order).toBeVisible();
};

export const openXrayForm = async (page) => {
    await page.getByRole("button", { name: "+ Chỉ định chụp X-quang" }).click();
    const dialog = page.getByRole("dialog", { name: "Phiếu chỉ định chụp X-quang" });
    await expect(dialog).toBeVisible();
    return dialog;
};

// ---------------------------------------------------------------- technician: "Chụp chiếu"

export const imagingQueue = (page) => page.getByRole("region", { name: "Hàng chờ chụp" });

export const selectImagingPatient = async (page, name) => {
    await openMenu(page, "Chụp chiếu");
    await imagingQueue(page).getByRole("button", { name: new RegExp(name) }).click();
};

// Uploads the file by hand for the first open order and completes it; returns the order id (IR-x) from the message
export const uploadAndComplete = async (page, file) => {
    await page.getByRole("button", { name: "Tải ảnh thủ công" }).first().click();
    const upload = page.getByRole("dialog", { name: "Tải ảnh thủ công" });
    await upload.locator('input[type="file"]').setInputFiles(file);
    await upload.getByRole("button", { name: "Tải lên (1)" }).click();
    await expect(upload).toBeHidden();

    await page.getByRole("button", { name: "Hoàn thành", exact: true }).first().click();
    const confirm = page.getByRole("dialog", { name: "Xác nhận hoàn thành chụp" });
    const done = page.waitForResponse((response) => /\/api\/imaging-requests\/\d+\/complete$/.test(response.url()));
    await confirm.getByRole("button", { name: "Xác nhận hoàn thành" }).click();
    const response = await done;
    expect(response.ok(), `complete the order: ${response.status()} ${await response.text()}`).toBeTruthy();
    const id = Number(response.url().match(/imaging-requests\/(\d+)\/complete/)[1]);
    const toast = page.getByText(new RegExp(`Đã gửi kết quả IR-${id} cho `));
    await expect(toast).toBeVisible();
    return { id, message: await toast.innerText() };
};

// ---------------------------------------------------------------- doctor: "Duyệt kết quả chụp"

export const reviewList = (page) => page.getByRole("region", { name: "Danh sách kết quả chụp" });

export const openReview = async (page, keyword) => {
    await openMenu(page, "Duyệt kết quả chụp");
    await reviewList(page).getByRole("searchbox").or(reviewList(page).getByPlaceholder("Tìm bệnh nhân, mã yêu cầu")).first().fill(keyword);
    const item = reviewList(page).getByRole("listitem").first();
    await item.getByRole("button").click();
    return item;
};

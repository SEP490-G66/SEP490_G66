import { expect, test } from "@playwright/test";
import { checkInWalkIns, clinicDate, expectMessage, goToExamStep, login, openMenu, startExamination } from "./helpers/ui";
import { api, authHeaders } from "./helpers/simulator";

// Integration test of module 3 "Examination Clinical" (sheet Integration_Test_ExaminationClinical, ECIT01-16).
// Step 2 "Khám & Chẩn đoán" of the doctor's examination: reason and symptoms, tooth findings on the dental chart,
// ICD-10 diagnoses, draft save and moving on to the treatment plan. X-ray orders are module 1.
// BS. Phan Ngọc Ánh (afternoon shift, room 1) examines one new walk-in patient; the cases build on each other.

const DOCTOR = { email: "anh.pn@oze.vn", password: "password123" };

test.describe.configure({ mode: "serial" });

const run = { patient: "" };

// The doctor's shift running now, started if it is not yet (from 30 minutes before it until it ends)
const startCurrentShift = async (request) => {
    const headers = await authHeaders(request, DOCTOR);
    const shifts = (await api(request, "GET", "/api/schedules/my", headers)).body.data;
    const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    const shift = shifts.find((item) => item.scheduleDate === clinicDate() && item.shiftStart.slice(0, 5) <= now && now < item.shiftEnd.slice(0, 5));
    expect(shift, "BS. Ngọc Ánh has a shift running now").toBeTruthy();
    if (shift.actualStartTime) return;
    const started = await api(request, "POST", `/api/schedules/my/${shift.id}/start`, headers);
    expect(started.status, started.body?.message).toBe(200);
};

// A doctor examines one patient at a time: ends the examination a test patient left open ("Bệnh nhân Test …"),
// so the next run can call its own patient in. Ending needs a diagnosis or a note: a note is added when missing.
const endOpenTestExam = async (browser) => {
    const page = await browser.newPage();
    await login(page, DOCTOR);
    await openMenu(page, "Khám bệnh");
    await expect(page.getByText(/^Hàng chờ · /)).toBeVisible();
    const open = page.locator("li").filter({ hasText: /^\s*\d*\s*Bệnh nhân Test/ }).filter({ has: page.getByText("Đang khám", { exact: true }) });
    if (await open.count()) {
        await open.first().click();
        const end = page.getByRole("button", { name: "Kết thúc lượt khám" }).first();
        await expect(end).toBeVisible();
        const note = page.getByLabel("Mô tả thêm");
        if ((await note.count()) && !(await note.inputValue())) await note.fill("Kết thúc lượt khám của dữ liệu test.");
        await end.click();
        const dialog = page.getByRole("dialog", { name: "Kết thúc lượt khám" });
        await dialog.getByRole("button", { name: "Kết thúc lượt khám" }).click();
        await expect(dialog).toBeHidden();
    }
    await page.close();
};

test.beforeAll(async ({ request, browser }) => {
    await startCurrentShift(request);
    await endOpenTestExam(browser);
    const [patient] = await checkInWalkIns(request, "Ngọc Ánh", 1);
    expect(patient, "a new walk-in patient for BS. Ngọc Ánh").toBeTruthy();
    run.patient = patient;
});

test.afterAll(async ({ browser }) => {
    await endOpenTestExam(browser);
});

// ---------------------------------------------------------------- screen helpers

const openExam = async (page) => {
    await login(page, DOCTOR);
    await startExamination(page, run.patient);
    await goToExamStep(page);
};

const section = (page, title) => page.getByRole("region", { name: title, exact: true });
const saveDraft = async (page) => {
    await page.getByRole("button", { name: "Lưu nháp" }).click();
    // The step bar says when the draft was last saved (the toast may be gone before it is read)
    await expect(page.getByText(/Đã lưu nháp lúc \d{2}:\d{2}/)).toBeVisible();
    await expect(page.getByText(/Đang lưu nháp|Chưa lưu được nháp/)).toHaveCount(0);
};
const adultChart = async (page) => {
    const adult = page.getByRole("button", { name: "Người lớn (11–48)" });
    if ((await adult.getAttribute("aria-pressed")) !== "true") await adult.click();
};
const tooth = (page, number) => page.getByRole("button", { name: new RegExp(`^Răng ${number}(,|$)`) }).first();
const toothForm = (page, number) => page.getByRole("form", { name: `Ghi nhận răng ${number}` });
const findings = (page) => section(page, "Tình trạng răng hiện tại");
const diagnoses = (page) => section(page, "Chẩn đoán xác định");
const diagnosisDialog = (page, title = "Thêm chẩn đoán") => page.getByRole("dialog", { name: title });
const NEXT = "Hoàn thành & chuyển sang Lập kế hoạch điều trị";

const addFinding = async (page, number, condition, surface, note) => {
    await tooth(page, number).click();
    const form = toothForm(page, number);
    await form.getByLabel(/^Tình trạng/).fill(condition);
    if (surface) await form.getByRole("button", { name: surface }).click();
    if (note) await form.getByLabel("Mô tả tình trạng").fill(note);
    await form.getByRole("button", { name: "Thêm tình trạng" }).click();
};

const fillDiagnosis = async (page, code, teeth = []) => {
    await diagnoses(page).getByRole("button", { name: "+ Thêm chẩn đoán" }).click();
    const dialog = diagnosisDialog(page);
    await dialog.getByLabel(/^Mã ICD-10/).fill(code);
    for (const number of teeth) {
        await dialog.getByLabel("Răng liên quan").fill(String(number));
        await dialog.getByLabel("Răng liên quan").press("Enter");
    }
    await dialog.getByRole("button", { name: "Thêm chẩn đoán" }).click();
    return dialog;
};

// ---------------------------------------------------------------- UC01 symptoms

test.describe("UC01_RecordSymptoms", () => {
    test("ECIT01 - Record reason, symptoms and description", async ({ page }) => {
        await openExam(page);
        await page.getByLabel("Lý do khám").fill("Đau răng hàm dưới bên trái 3 ngày");
        await page.getByRole("button", { name: "Đau răng", exact: true }).click();
        await page.getByLabel("Mô tả thêm").fill("Ê buốt khi uống lạnh, gõ dọc răng 36 đau.");
        await saveDraft(page);

        await expect(page.getByRole("button", { name: "Đau răng", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByText("1 đã chọn")).toBeVisible();
    });

    test("ECIT02 - Reason longer than 500 characters is cut", async ({ page }) => {
        await openExam(page);
        await page.getByLabel("Lý do khám").fill("A".repeat(510));
        await expect(page.getByLabel("Lý do khám")).toHaveValue("A".repeat(500));
        await page.getByLabel("Lý do khám").fill("Đau răng hàm dưới bên trái 3 ngày");
        await saveDraft(page);
    });
});

// ---------------------------------------------------------------- UC02 tooth findings

test.describe("UC02_ToothFindings", () => {
    test("ECIT03 - Add a finding to a permanent tooth", async ({ page }) => {
        await openExam(page);
        await adultChart(page);
        await addFinding(page, 36, "Sâu răng", "O · nhai", "Lỗ sâu sâu ngà");

        await expectMessage(page, "Đã thêm ghi nhận răng 36.");
        await expect(findings(page).getByText("Sâu răng").first()).toBeVisible();
        await expect(page.getByRole("button", { name: "Răng 36, 1 ghi nhận" }).first()).toBeVisible();
        await saveDraft(page);
    });

    test("ECIT04 - Add a finding without a condition", async ({ page }) => {
        await openExam(page);
        await adultChart(page);
        await tooth(page, 37).click();
        await toothForm(page, 37).getByRole("button", { name: "Thêm tình trạng" }).click();

        await expect(toothForm(page, 37).getByText("Nhập tình trạng của răng.")).toBeVisible();
        await expect(page.getByRole("button", { name: /^Răng 37,/ })).toHaveCount(0);
    });

    test("ECIT05 - Edit a finding", async ({ page }) => {
        await openExam(page);
        await findings(page).getByRole("button", { name: "Sửa: Sâu răng răng 36" }).click();
        const dialog = page.getByRole("dialog", { name: "Sửa ghi nhận răng 36" });
        await dialog.getByLabel(/^Tình trạng/).fill("Sâu răng mặt nhai");
        await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();

        await expectMessage(page, "Đã cập nhật ghi nhận răng 36.");
        await expect(findings(page).getByText("Sâu răng mặt nhai").first()).toBeVisible();
        await saveDraft(page);
    });

    test("ECIT06 - Record a primary tooth replaced by a permanent one", async ({ page }) => {
        await openExam(page);
        await page.getByRole("button", { name: /^Trẻ em/ }).click();
        await tooth(page, 55).click();
        const form = toothForm(page, 55);
        await form.getByLabel(/^Tình trạng/).fill("Răng sữa đã rụng");
        await form.getByLabel("Răng này đã được thay bằng răng vĩnh viễn").check();
        await form.getByRole("button", { name: "Thêm tình trạng" }).click();

        await expectMessage(page, "Đã thêm ghi nhận răng 55.");
        await expect(form.getByText(/Đã thay răng vĩnh viễn/)).toBeVisible();
        await saveDraft(page);
    });

    test("ECIT07 - Delete a finding", async ({ page }) => {
        await openExam(page);
        await findings(page).getByRole("button", { name: "Xoá: Răng sữa đã rụng răng 55" }).click();

        await expectMessage(page, 'Đã xoá "Răng sữa đã rụng" của răng 55.');
        await expect(findings(page).getByText("Răng sữa đã rụng")).toHaveCount(0);
        await saveDraft(page);
    });
});

// ---------------------------------------------------------------- UC03 diagnoses

test.describe("UC03_Diagnosis", () => {
    test("ECIT08 - Next step needs a diagnosis", async ({ page }) => {
        await openExam(page);
        await expect(page.getByRole("button", { name: NEXT })).toBeDisabled();
        await expect(page.getByText(/Cần ít nhất một chẩn đoán xác định/)).toBeVisible();
    });

    test("ECIT09 - Add a diagnosis without an ICD-10 code", async ({ page }) => {
        await openExam(page);
        const dialog = await fillDiagnosis(page, "");
        await expect(dialog.getByText("Nhập mã ICD-10.")).toBeVisible();
    });

    test("ECIT10 - Add a diagnosis with an unknown ICD-10 code", async ({ page }) => {
        await openExam(page);
        const dialog = await fillDiagnosis(page, "Z99.9");
        await expect(dialog.getByText("Không có mã này trong danh mục ICD-10 nha khoa.")).toBeVisible();
    });

    test("ECIT11 - Related tooth number out of range", async ({ page }) => {
        await openExam(page);
        await diagnoses(page).getByRole("button", { name: "+ Thêm chẩn đoán" }).click();
        const dialog = diagnosisDialog(page);
        await dialog.getByLabel("Răng liên quan").fill("99");
        await dialog.getByRole("button", { name: "Thêm răng" }).click();
        await expect(dialog.getByText("Số răng không hợp lệ (11–48 hoặc 51–85).")).toBeVisible();
    });

    test("ECIT12 - Add a valid diagnosis", async ({ page }) => {
        await openExam(page);
        await fillDiagnosis(page, "K02.1", [36]);

        await expectMessage(page, "Đã thêm chẩn đoán K02.1.");
        await expect(diagnoses(page).getByText("K02.1").first()).toBeVisible();
        await expect(page.getByRole("button", { name: NEXT })).toBeEnabled();
        await saveDraft(page);
    });

    test("ECIT13 - Add the same diagnosis twice", async ({ page }) => {
        await openExam(page);
        const dialog = await fillDiagnosis(page, "K02.1");
        await expect(dialog.getByText("Chẩn đoán K02.1 đã có trong danh sách.")).toBeVisible();
    });

    test("ECIT14 - Edit and delete a diagnosis", async ({ page }) => {
        await openExam(page);
        await fillDiagnosis(page, "K04.0");
        await expectMessage(page, "Đã thêm chẩn đoán K04.0.");

        await diagnoses(page).getByRole("button", { name: "Sửa: chẩn đoán K04.0" }).click();
        const edit = diagnosisDialog(page, "Sửa chẩn đoán");
        await edit.getByLabel("Mô tả chi tiết").fill("Viêm tủy răng 36");
        await edit.getByRole("button", { name: "Lưu thay đổi" }).click();
        await expectMessage(page, "Đã cập nhật chẩn đoán K04.0.");

        await diagnoses(page).getByRole("button", { name: "Xoá: chẩn đoán K04.0" }).click();
        await expectMessage(page, "Đã xoá chẩn đoán K04.0.");
        await expect(diagnoses(page).getByText("K04.0")).toHaveCount(0);
        await saveDraft(page);
    });
});

// ---------------------------------------------------------------- UC04 draft and next step

test.describe("UC04_SaveAndProceed", () => {
    test("ECIT15 - Saved examination is kept after reopening", async ({ page }) => {
        await openExam(page);

        await expect(page.getByLabel("Lý do khám")).toHaveValue("Đau răng hàm dưới bên trái 3 ngày");
        await expect(page.getByRole("button", { name: "Đau răng", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByLabel("Mô tả thêm")).toHaveValue("Ê buốt khi uống lạnh, gõ dọc răng 36 đau.");
        await expect(findings(page).getByText("Sâu răng mặt nhai").first()).toBeVisible();
        await expect(findings(page).getByText("Răng sữa đã rụng")).toHaveCount(0);
        await expect(diagnoses(page).getByText("K02.1").first()).toBeVisible();
        await expect(diagnoses(page).getByText("K04.0")).toHaveCount(0);
    });

    test("ECIT16 - Complete the clinical step", async ({ page }) => {
        await openExam(page);
        await page.getByRole("button", { name: NEXT }).click();

        await expect(page.getByRole("heading", { name: "Lập kế hoạch điều trị" }).first()).toBeVisible();
    });
});

import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
    ACCOUNTS,
    checkInWalkIns,
    clinicDate,
    expectMessage,
    goToExamStep,
    imagingQueue,
    login,
    newWaitingPatients,
    openMenu,
    openReview,
    openXrayForm,
    reviewList,
    selectImagingPatient,
    startExamination,
    uploadAndComplete,
} from "./helpers/ui";

// Integration test of module 1 "Imaging Workflow" (sheet Integration_Test_ImagingWorkflow, IWIT01-17).
// Runs against the real BE with the sample data: the front desk checks in two new walk-in patients (A, B) for BS. Khoa
// (morning shift started), BS. Khoa orders X-rays for them, KTV Bảo images them and BS. Khoa reviews the results.
// One case builds on the one before, so they run in order.

const PANO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "mock", "xray", "pano_full_adult_01.png");

test.describe.configure({ mode: "serial" });

// Shared along the run
const run = { patientA: "", patientB: "", orderA: 0, ordersB: [], typeB: "" };

// Two patients nobody examined yet: checked in now by the front desk, or (outside the shift hours, when the BE refuses a
// walk-in) the new patients already waiting in BS. Khoa's queue
test.beforeAll(async ({ request, browser }) => {
    let patients = await checkInWalkIns(request, "Khoa", 2);
    if (patients.length < 2) {
        const page = await browser.newPage();
        await login(page, ACCOUNTS.doctor);
        const waiting = (await newWaitingPatients(page)).filter((name) => !patients.includes(name));
        patients = [...patients, ...waiting].slice(0, 2);
        await page.close();
    }
    expect(patients, "two new patients in BS. Khoa's queue").toHaveLength(2);
    [run.patientA, run.patientB] = patients;
});

test.describe("UC01_CreateImagingRequest", () => {
    test("IWIT01 - Send an X-ray order with valid data", async ({ page }) => {
        await login(page, ACCOUNTS.doctor);
        await startExamination(page, run.patientA);
        await goToExamStep(page);
        const form = await openXrayForm(page);
        await form.getByLabel("Phim toàn cảnh (Panorama)").check();
        await form.getByLabel("Vùng / răng").fill("Toàn hàm");
        await form.getByLabel("Chụp yêu cầu").fill("Đánh giá răng khôn");
        await form.getByRole("button", { name: "Gửi chỉ định" }).click();

        await expectMessage(page, "Đã gửi 1 yêu cầu chụp tới kỹ thuật viên. Bệnh nhân sang phòng chụp, chụp xong sẽ quay lại đầu hàng chờ.");
        await expect(form).toBeHidden();
        await expect(page.locator("li").filter({ hasText: run.patientA }).getByText("Đang đi chụp")).toBeVisible();
    });

    test("IWIT03 - Send an X-ray order without choosing an imaging type", async ({ page }) => {
        await login(page, ACCOUNTS.doctor);
        await startExamination(page, run.patientB);
        await goToExamStep(page);
        const form = await openXrayForm(page);
        await form.getByLabel("Vùng / răng").fill("Răng 36");
        await form.getByRole("button", { name: "Gửi chỉ định" }).click();

        await expect(form.getByText("Chọn ít nhất một loại chụp.")).toBeVisible();
        await expect(form).toBeVisible();
    });

    test("IWIT04 - Send an X-ray order without target area", async ({ page }) => {
        await login(page, ACCOUNTS.doctor);
        await startExamination(page, run.patientB);
        await goToExamStep(page);
        const form = await openXrayForm(page);
        await form.getByLabel("Phim toàn cảnh (Panorama)").check();
        await form.getByRole("button", { name: "Gửi chỉ định" }).click();

        await expect(form.getByText("Nhập vùng hoặc răng cần chụp.")).toBeVisible();
        await expect(form).toBeVisible();
    });

    test("IWIT05 - Send an X-ray order with target area longer than 200 characters", async ({ page }) => {
        await login(page, ACCOUNTS.doctor);
        await startExamination(page, run.patientB);
        await goToExamStep(page);
        const form = await openXrayForm(page);
        await form.getByLabel("Phim quanh chóp").check();
        await form.getByLabel("Vùng / răng").fill("R".repeat(201));
        await form.getByRole("button", { name: "Gửi chỉ định" }).click();

        await expectMessage(page, "Target area is invalid. Please check again.");
        await expect(form).toBeVisible();
    });

    test("IWIT06 - Target area is filled from the selected tooth", async ({ page }) => {
        await login(page, ACCOUNTS.doctor);
        await startExamination(page, run.patientB);
        await goToExamStep(page);
        // A patient without a birth date gets the child chart (51–85): switch to the adult one
        const adult = page.getByRole("button", { name: "Người lớn (11–48)" });
        if ((await adult.getAttribute("aria-pressed")) !== "true") await adult.click();
        await page.getByRole("button", { name: /^Răng 36(,|$)/ }).first().click();
        const form = await openXrayForm(page);

        await expect(form.getByLabel("Vùng / răng")).toHaveValue("Răng 36");
        await expect(form.getByText(/BS\. /)).toBeVisible();
        await form.getByRole("button", { name: "Huỷ" }).click();
    });

    test("IWIT02 - Send an X-ray order with two imaging types", async ({ page }) => {
        await login(page, ACCOUNTS.doctor);
        await startExamination(page, run.patientB);
        await goToExamStep(page);
        const form = await openXrayForm(page);
        await form.getByLabel("Phim quanh chóp").check();
        await form.getByLabel("Phim toàn cảnh (Panorama)").check();
        await form.getByLabel("Vùng / răng").fill("Răng 36");
        await form.getByRole("button", { name: "Gửi chỉ định" }).click();

        await expectMessage(page, "Đã gửi 2 yêu cầu chụp tới kỹ thuật viên. Bệnh nhân sang phòng chụp, chụp xong sẽ quay lại đầu hàng chờ.");
        await expect(page.locator("li").filter({ hasText: run.patientB }).getByText("Đang đi chụp")).toBeVisible();
    });
});

test.describe("UC02_TechnicianProcessOrder", () => {
    test("IWIT07 - Technician views the imaging queue", async ({ page }) => {
        await login(page, ACCOUNTS.technician);
        await openMenu(page, "Chụp chiếu");
        const itemA = imagingQueue(page).getByRole("button", { name: new RegExp(run.patientA) });
        await expect(itemA).toContainText("Phim toàn cảnh (Panorama) · Toàn hàm");
        await expect(imagingQueue(page).getByRole("button", { name: new RegExp(run.patientB) })).toContainText("2 chỉ định");

        await itemA.click();
        await expect(page.getByText("Bấm Gọi vào chụp khi bệnh nhân sẵn sàng.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Gọi vào chụp" })).toBeEnabled();
    });

    test("IWIT09 - Technician cannot complete an order without images", async ({ page }) => {
        await login(page, ACCOUNTS.technician);
        await selectImagingPatient(page, run.patientA);
        await page.getByRole("button", { name: "Gọi vào chụp" }).click();

        await expect(page.getByRole("button", { name: "Hoàn thành", exact: true })).toBeDisabled();
        await expect(page.getByText("Chưa có ảnh. Chụp hoặc tải ảnh thủ công để hoàn thành.")).toBeVisible();
    });

    test("IWIT08 - Technician completes an order by uploading images by hand", async ({ page }) => {
        await login(page, ACCOUNTS.technician);
        await selectImagingPatient(page, run.patientA);
        await page.getByRole("button", { name: "Gọi vào chụp" }).click();
        const { id, message } = await uploadAndComplete(page, PANO);
        run.orderA = id;

        expect(message).toMatch(new RegExp(`^Đã gửi kết quả IR-${id} cho .+\\.$`));
        await expect(imagingQueue(page).getByRole("button", { name: new RegExp(run.patientA) })).toHaveCount(0);

        // The doctor gets the patient back at the top of the queue
        await login(page, ACCOUNTS.doctor);
        await openMenu(page, "Khám bệnh");
        await expect(page.locator("li").filter({ hasText: run.patientA }).getByText("Chụp xong · khám tiếp")).toBeVisible();
    });
});

test.describe("UC03_ReviewImagingResult", () => {
    test("IWIT10 - Doctor views and filters the review list", async ({ page }) => {
        await login(page, ACCOUNTS.doctor);
        await openMenu(page, "Duyệt kết quả chụp");
        const tabs = page.getByRole("group", { name: "Lọc theo trạng thái" });
        for (const tab of ["Tất cả", "Chờ duyệt", "Cần chụp lại", "Đã duyệt", "Đã huỷ"]) {
            await expect(tabs.getByRole("button", { name: new RegExp(`^${tab}`) })).toBeVisible();
        }
        await tabs.getByRole("button", { name: /^Chờ duyệt/ }).click();
        await reviewList(page).getByPlaceholder("Tìm bệnh nhân, mã yêu cầu").fill(run.patientA);

        const items = reviewList(page).getByRole("listitem");
        await expect(items).toHaveCount(1);
        await expect(items.first()).toContainText(run.patientA);
        await expect(items.first()).toContainText(`IR-${run.orderA}`);
        await expect(items.first()).toContainText("Chờ duyệt");
    });

    test("IWIT13 - Doctor requests a retake without reason", async ({ page }) => {
        await login(page, ACCOUNTS.doctor);
        await openReview(page, `IR-${run.orderA}`);
        await page.getByRole("button", { name: "Yêu cầu chụp lại" }).click();
        const dialog = page.getByRole("dialog", { name: "Yêu cầu chụp lại" });
        await dialog.getByRole("button", { name: "Gửi yêu cầu chụp lại" }).click();

        await expect(dialog.getByText("Nhập lý do chụp lại.")).toBeVisible();
        await dialog.getByRole("button", { name: "Huỷ" }).click();
        await expect(reviewList(page).getByRole("listitem").first()).toContainText("Chờ duyệt");
    });

    test("IWIT12 - Doctor requests a retake", async ({ page }) => {
        await login(page, ACCOUNTS.doctor);
        await openReview(page, `IR-${run.orderA}`);
        await page.getByRole("button", { name: "Yêu cầu chụp lại" }).click();
        const dialog = page.getByRole("dialog", { name: "Yêu cầu chụp lại" });
        await dialog.getByLabel("Lý do").fill("Ảnh mờ vùng răng 36");
        await dialog.getByRole("button", { name: "Gửi yêu cầu chụp lại" }).click();

        await expectMessage(page, `Đã gửi yêu cầu chụp lại IR-${run.orderA} cho KTV.`);
        await expect(page.getByText("Lý do chụp lại:")).toBeVisible();
        await expect(page.getByText("Ảnh mờ vùng răng 36")).toBeVisible();
        await expect(reviewList(page).getByRole("listitem").first()).toContainText("Cần chụp lại");

        // The order goes back to the technician
        await login(page, ACCOUNTS.technician);
        await openMenu(page, "Chụp chiếu");
        await expect(imagingQueue(page).getByRole("button", { name: new RegExp(run.patientA) })).toContainText("Toàn hàm");
    });

    test("IWIT11 - Doctor approves an imaging result", async ({ page }) => {
        await test.step("Pre-condition: the technician completes both orders of patient B", async () => {
            await login(page, ACCOUNTS.technician);
            await selectImagingPatient(page, run.patientB);
            await page.getByRole("button", { name: "Gọi vào chụp" }).click();
            run.ordersB.push((await uploadAndComplete(page, PANO)).id);
            run.ordersB.push((await uploadAndComplete(page, PANO)).id);
        });

        await login(page, ACCOUNTS.doctor);
        const item = await openReview(page, `IR-${run.ordersB[0]}`);
        run.typeB = (await item.innerText()).includes("Phim quanh chóp") ? "Phim quanh chóp" : "Phim toàn cảnh (Panorama)";
        await page.getByRole("button", { name: "Duyệt kết quả" }).click();
        const dialog = page.getByRole("dialog", { name: "Duyệt kết quả chụp?" });
        await dialog.getByRole("button", { name: "Duyệt kết quả" }).click();

        await expectMessage(page, `Đã duyệt kết quả IR-${run.ordersB[0]}.`);
        await expect(reviewList(page).getByRole("listitem").first()).toContainText("Đã duyệt");
        await expect(page.getByRole("button", { name: "Duyệt kết quả" })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Yêu cầu chụp lại" })).toBeDisabled();
    });
});

test.describe("UC04_ImagingHistory", () => {
    test("IWIT15 - Technician searches imaging history", async ({ page }) => {
        await login(page, ACCOUNTS.technician);
        await openMenu(page, "Lịch sử chụp chiếu");
        // One filter at a time, waiting for the list like a user does: a filter changed while the list is still
        // loading can show the answer of the earlier request (useAsync keeps whichever response comes last)
        // Runs one filter change and waits until the list request carrying it (`param` in the query) has answered
        const keyword = `keyword=IR-${run.ordersB[0]}`;
        const apply = async (change, param) => {
            const loaded = page.waitForResponse((response) => {
                const url = decodeURIComponent(response.url());
                return url.includes("/api/imaging-history?") && url.includes(keyword) && url.includes(param);
            });
            await change();
            await loaded;
            await expect(page.locator("table")).toHaveAttribute("aria-busy", "false");
        };
        await apply(() => page.getByPlaceholder("Tên, mã bệnh nhân hoặc mã chỉ định").fill(`IR-${run.ordersB[0]}`), keyword);
        await apply(() => page.getByLabel("Trạng thái").selectOption({ label: "Hoàn tất" }), "status=Completed");
        await apply(() => page.getByLabel("Loại chụp").selectOption({ label: run.typeB }), "imagingType=");
        await apply(() => page.getByLabel("Từ ngày").fill(clinicDate()), `from=${clinicDate()}`);
        // "đến" is today already: choosing today again sends no new request
        await page.getByLabel("Đến ngày").fill(clinicDate());

        const rows = page.locator("table tbody tr");
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText(run.patientB);
        await expect(rows.first()).toContainText(run.typeB);
        await expect(rows.first()).toContainText("Răng 36");
        await expect(rows.first()).toContainText("Tải thủ công");
        await expect(rows.first()).toContainText("Hoàn tất");

        await page.getByPlaceholder("Tên, mã bệnh nhân hoặc mã chỉ định").fill("KHONG-CO-LUOT-CHUP-NAY");
        await expect(page.getByText("Không tìm thấy lượt chụp phù hợp")).toBeVisible();
    });

    test("IWIT16 - Technician views the detail of an imaging", async ({ page }) => {
        await login(page, ACCOUNTS.technician);
        await openMenu(page, "Lịch sử chụp chiếu");
        const searched = page.waitForResponse((response) => response.url().includes(`/api/imaging-history?keyword=IR-${run.ordersB[0]}`));
        await page.getByPlaceholder("Tên, mã bệnh nhân hoặc mã chỉ định").fill(`IR-${run.ordersB[0]}`);
        await searched;
        await expect(page.locator("table")).toHaveAttribute("aria-busy", "false");
        await expect(page.locator("table tbody tr")).toHaveCount(1);
        const row = page.locator("table tbody tr").filter({ hasText: run.patientB }).first();
        await row.getByRole("button", { name: "Xem chi tiết" }).click();

        const dialog = page.getByRole("dialog", { name: "Chi tiết chụp chiếu" });
        await expect(dialog).toContainText(`IR-${run.ordersB[0]} · ${run.patientB}`);
        await expect(dialog).toContainText("Chỉ định của bác sĩ");
        await expect(dialog).toContainText("Răng 36");
        await expect(dialog).toContainText("Tải ảnh thủ công");
        await expect(dialog.getByRole("img").first()).toBeVisible();
    });

    test("IWIT17 - Date range cannot be reversed", async ({ page }) => {
        await login(page, ACCOUNTS.technician);
        await openMenu(page, "Lịch sử chụp chiếu");
        const from = page.getByLabel("Từ ngày");
        const to = page.getByLabel("Đến ngày");
        await from.fill(clinicDate(-3));

        // The date picker only offers days from "Từ" on in "đến", and days up to "đến" in "Từ"
        await expect(to).toHaveAttribute("min", clinicDate(-3));
        await expect(from).toHaveAttribute("max", clinicDate());
    });
});

// Last, as it ends the examination of patient B
test.describe("UC03_ReviewImagingResult (examination ended)", () => {
    test("IWIT14 - Doctor requests a retake after the examination has ended", async ({ page }) => {
        await login(page, ACCOUNTS.doctor);
        await test.step("Pre-condition: the doctor ends the examination of patient B", async () => {
            // Both orders done: the patient is back at the top of the doctor's queue
            await openMenu(page, "Khám bệnh");
            await expect(
                page.locator("li").filter({ hasText: run.patientB }),
                "patient B is back from the X-ray room once both orders are completed",
            ).toContainText("Chụp xong · khám tiếp");
            await startExamination(page, run.patientB);
            // Ending needs a diagnosis or a clinical note
            await goToExamStep(page);
            await page.getByLabel("Mô tả thêm").fill("Đã chụp phim, bệnh nhân hẹn quay lại sau.");
            await page.getByRole("button", { name: "Lưu nháp" }).click();
            await expectMessage(page, "Đã lưu nháp.");
            await page.getByRole("button", { name: "Kết thúc lượt khám" }).first().click();
            await page.getByRole("dialog", { name: "Kết thúc lượt khám" }).getByRole("button", { name: "Kết thúc lượt khám" }).click();
            await expect(page.getByRole("dialog", { name: "Kết thúc lượt khám" })).toBeHidden();
        });

        await openReview(page, `IR-${run.ordersB[1]}`);
        await page.getByRole("button", { name: "Yêu cầu chụp lại" }).click();
        const dialog = page.getByRole("dialog", { name: "Yêu cầu chụp lại" });
        await dialog.getByLabel("Lý do").fill("Cần chụp thêm góc nghiêng");
        await dialog.getByRole("button", { name: "Gửi yêu cầu chụp lại" }).click();

        await expectMessage(page, "Lượt khám đã kết thúc nên không gửi chụp lại được.");
        await expect(reviewList(page).getByRole("listitem").first()).toContainText("Chờ duyệt");
    });
});

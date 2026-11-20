import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers/ui";
import { api, authHeaders } from "./helpers/simulator";

// Integration test of module 4 "Medical Record Read" (sheet Integration_Test_MedicalRecordRead, MRIT01-17).
// Read only: the doctor's view of a patient's record and of one visit (api/medical-records/patients|examinations),
// and the patient's own "Sổ khám bệnh" (/medical-record). Uses the sample patient account Nguyễn Văn A (BN000123),
// examined by BS. Trần Minh Khoa and BS. Lê Thu Hà; BS. Ngô Văn Đức never saw this patient.

const PATIENT = { email: "test@example.com", password: "password123" };
const DOCTOR = ACCOUNTS.doctor;
const NO_ACCESS_DOCTOR = { email: "duc.nv@oze.vn", password: "password123" };
const ACCESS_DENIED = "You do not have permission to view this patient's medical record";

test.describe.configure({ mode: "serial" });

// Filled from the BE before the tests: the patient, the visits in the book, and visits of each doctor
const data = { patientId: 0, book: [], films: [], chart: [],ownVisit: 0, otherDoctorVisit: 0, inProgressVisit: 0 };
const headers = {};

test.beforeAll(async ({ request }) => {
    headers.doctor = await authHeaders(request, DOCTOR);
    headers.noAccess = await authHeaders(request, NO_ACCESS_DOCTOR);
    headers.patient = await authHeaders(request, PATIENT);
    headers.receptionist = await authHeaders(request, ACCOUNTS.receptionist);

    const book = await api(request, "GET", "/api/medical-records/my", headers.patient);
    expect(book.status, book.body?.message).toBe(200);
    data.book = book.body.data.examinations;
    data.films = book.body.data.films;
    data.chart = [...book.body.data.chart, ...book.body.data.toothFindings];
    expect(data.book.length, "the patient has finished visits").toBeGreaterThanOrEqual(2);

    // The patient id is on the visit detail
    const detail = await api(request, "GET", `/api/medical-records/examinations/${data.book[0].id}`, headers.doctor);
    expect(detail.status, detail.body?.message).toBe(200);
    data.patientId = detail.body.data.patientId;

    const record = (await api(request, "GET", `/api/medical-records/patients/${data.patientId}`, headers.doctor)).body.data;
    data.ownVisit = record.examinations.find((item) => item.doctorName.includes("Minh Khoa") && item.examinationStatus !== "InProgress")?.id;
    data.otherDoctorVisit = record.examinations.find((item) => !item.doctorName.includes("Minh Khoa"))?.id;
    data.inProgressVisit = record.examinations.find((item) => item.examinationStatus === "InProgress")?.id ?? 0;
    expect(data.ownVisit && data.otherDoctorVisit, "visits of BS. Khoa and of another doctor").toBeTruthy();
});

// ---------------------------------------------------------------- UC01 doctor: patient record

test("MRIT01 Doctor who examined the patient reads the record", async ({ request }) => {
    const { status, body } = await api(request, "GET", `/api/medical-records/patients/${data.patientId}`, headers.doctor);
    expect(status).toBe(200);
    expect(body.data.patientCode).toBe("BN000123");
    expect(body.data.fullName).toBe("Nguyễn Văn A");
    expect(body.data.medicalProfiles.map((item) => item.title)).toEqual(expect.arrayContaining(["Penicillin", "Tăng huyết áp"]));
    const dates = body.data.examinations.map((item) => item.appointmentDate);
    expect(dates.length).toBeGreaterThanOrEqual(2);
    expect([...dates].sort().reverse(), "newest visit first").toEqual(dates);
});

test("MRIT02 Doctor who never saw the patient is refused", async ({ request }) => {
    const { status, body } = await api(request, "GET", `/api/medical-records/patients/${data.patientId}`, headers.noAccess);
    expect(status).toBe(403);
    expect(body.message).toBe(ACCESS_DENIED);
});

test("MRIT03 Record of a patient that does not exist", async ({ request }) => {
    const { status, body } = await api(request, "GET", "/api/medical-records/patients/999999", headers.doctor);
    expect(status).toBe(404);
    expect(body.message).toBe("Patient not found");
});

test("MRIT04 Patient and receptionist cannot use the doctor's record", async ({ request }) => {
    for (const role of ["patient", "receptionist"]) {
        const { status } = await api(request, "GET", `/api/medical-records/patients/${data.patientId}`, headers[role]);
        expect(status, role).toBe(403);
    }
});

test("MRIT05 Record without signing in", async ({ request }) => {
    expect((await api(request, "GET", `/api/medical-records/patients/${data.patientId}`, {})).status).toBe(401);
    expect((await api(request, "GET", "/api/medical-records/my", {})).status).toBe(401);
});

// ---------------------------------------------------------------- UC02 doctor: one visit

test("MRIT06 Doctor reads a visit they examined", async ({ request }) => {
    const { status, body } = await api(request, "GET", `/api/medical-records/examinations/${data.ownVisit}`, headers.doctor);
    expect(status).toBe(200);
    expect(body.data.patientId).toBe(data.patientId);
    expect(body.data.doctorName).toContain("Minh Khoa");
    expect(body.data.diagnoses.length).toBeGreaterThan(0);
    expect(body.data.diagnoses[0].isPrimary, "primary diagnosis first").toBe(true);
    expect(body.data.images.some((image) => image.reviewStatus === "Rejected"), "rejected images are hidden").toBe(false);
});

test("MRIT07 Doctor reads another doctor's visit of their patient", async ({ request }) => {
    const { status, body } = await api(request, "GET", `/api/medical-records/examinations/${data.otherDoctorVisit}`, headers.doctor);
    expect(status).toBe(200);
    expect(body.data.doctorName).not.toContain("Minh Khoa");
});

test("MRIT08 Visit that does not exist", async ({ request }) => {
    const { status, body } = await api(request, "GET", "/api/medical-records/examinations/99999999", headers.doctor);
    expect(status).toBe(404);
    expect(body.message).toBe("Examination not found");
});

test("MRIT09 Doctor without access reads a visit", async ({ request }) => {
    const { status, body } = await api(request, "GET", `/api/medical-records/examinations/${data.ownVisit}`, headers.noAccess);
    expect(status).toBe(403);
    expect(body.message).toBe(ACCESS_DENIED);
});

// ---------------------------------------------------------------- UC03 patient: "Sổ khám bệnh"

const visitList = (page) => page.getByRole("list").filter({ has: page.getByRole("button", { name: /\d{2}\/\d{2}\/\d{4}/ }) });
const visitButtons = (page) => visitList(page).getByRole("button");
const sheetTitle = (page) => page.getByRole("heading", { level: 2, name: /^Phiếu khám #\d+/ });
const ddmmyyyy = (iso) => iso.split("-").reverse().join("/");

const openBook = async (page, path = "/medical-record") => {
    await login(page, PATIENT);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: "Sổ khám bệnh" })).toBeVisible();
};

test("MRIT10 Patient opens the medical book", async ({ page }) => {
    await openBook(page);
    await expect(visitButtons(page)).toHaveCount(data.book.length);
    const newest = data.book[0];
    await expect(sheetTitle(page)).toContainText(ddmmyyyy(newest.date));
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByText("PHIẾU KHÁM BỆNH")).toBeVisible();
    await expect(panel.getByText(newest.chiefComplaint)).toBeVisible();
    await expect(panel.getByText(newest.diagnoses[0]).first()).toBeVisible();
    await expect(panel.getByText(newest.doctorName).first()).toBeVisible();
});

test("MRIT11 A visit still under examination is not in the book", async ({ page }) => {
    test.skip(!data.inProgressVisit, "the patient has no open visit");
    expect(data.book.map((item) => item.id)).not.toContain(data.inProgressVisit);
    await openBook(page, `/medical-record/${data.inProgressVisit}`);
    await expect(page.getByText("Không tìm thấy phiếu khám")).toBeVisible();
});

test("MRIT12 Patient opens an older visit", async ({ page }) => {
    await openBook(page);
    const older = data.book[1];
    await visitButtons(page).filter({ hasText: ddmmyyyy(older.date) }).click();
    await expect(page).toHaveURL(new RegExp(`/medical-record/${older.id}`));
    await expect(sheetTitle(page)).toContainText(ddmmyyyy(older.date));
    await expect(page.getByRole("tabpanel").getByText(older.chiefComplaint)).toBeVisible();
});

test("MRIT13 Search the visits", async ({ page }) => {
    await openBook(page);
    const search = page.getByRole("textbox", { name: "Tìm dịch vụ, chẩn đoán" });
    await search.fill("cao răng");
    await expect(visitButtons(page)).toHaveCount(data.book.filter((item) => [...item.services, ...item.diagnoses].some((text) => /cao răng/i.test(text))).length);
    await search.fill("zzz không có");
    await expect(page.getByText("Không có phiếu khám để hiển thị")).toBeVisible();
    await page.getByRole("button", { name: "Xóa tìm kiếm", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(visitButtons(page)).toHaveCount(data.book.length);
});

test("MRIT14 Sort oldest first", async ({ page }) => {
    await openBook(page);
    await page.getByRole("button", { name: "Mới nhất trước" }).click();
    await page.getByText("Cũ nhất trước", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Cũ nhất trước" })).toBeVisible();
    await expect(visitButtons(page).first()).toContainText(ddmmyyyy(data.book.at(-1).date));
});

test("MRIT15 Plan, film and tooth chart tabs of a visit", async ({ page }) => {
    await openBook(page);
    const visit = data.book[0];
    const tabs = [
        ["Kế hoạch điều trị", "tab=plan", visit.treatmentPlanIds.length ? null : "Phiếu này không thuộc kế hoạch điều trị nào"],
        ["Phim và tài liệu", "tab=film", data.films.some((film) => film.examinationId === visit.id) ? null : "Buổi này không chụp phim"],
        ["Sơ đồ răng", "tab=teeth", data.chart.length ? null : "Chưa có ghi nhận răng nào tới buổi này"],
    ];
    for (const [tab, query, text] of tabs) {
        await page.getByRole("tab", { name: tab }).click();
        await expect(page).toHaveURL(new RegExp(query));
        await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
        await expect(sheetTitle(page)).toContainText(ddmmyyyy(visit.date));
        if (text) await expect(page.getByRole("tabpanel").getByText(text).first()).toBeVisible();
    }
});

test("MRIT16 Medical history tab", async ({ page }) => {
    await openBook(page);
    await page.getByRole("tab", { name: "Tiền sử" }).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByRole("heading", { name: "Tiền sử (bác sĩ ghi nhận)" })).toBeVisible();
    await expect(panel.getByText("Penicillin")).toBeVisible();
    await expect(panel.getByText("Tăng huyết áp")).toBeVisible();
    await panel.getByRole("button", { name: /^Dị ứng/ }).click();
    await expect(panel.getByText("Penicillin")).toBeHidden();
});

test("MRIT17 Visit that does not exist in the book", async ({ page }) => {
    await openBook(page, "/medical-record/999999");
    await expect(page.getByText("Không tìm thấy phiếu khám")).toBeVisible();
    await page.getByRole("button", { name: "Về danh sách phiếu khám" }).click();
    await expect(page).toHaveURL(/\/medical-record$/);
    await expect(visitButtons(page)).toHaveCount(data.book.length);
});

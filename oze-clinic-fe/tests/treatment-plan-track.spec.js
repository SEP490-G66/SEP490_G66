import { expect, test } from "@playwright/test";
import { ACCOUNTS, clinicDate, login } from "./helpers/ui";
import { api, authHeaders } from "./helpers/simulator";

// Integration test of module 5 "Treatment Plan Track" (sheet Integration_Test_TreatmentPlanTrack, TPIT01-20).
// Carrying out an agreed plan stage by stage: start, update (notes, actual cost, next date), complete, progress, and
// cancelling a plan part way, plus what the front desk sees of it (patient detail, tab "Kế hoạch điều trị").
// BS. Trần Minh Khoa plans on the examination of the test patient "Bệnh nhân Test 001" still open from an earlier
// run; each run makes its own plans there and leaves them Completed / Cancelled, so the next run can plan again.

const PATIENT_NAME = "Bệnh nhân Test 001";
const NO_ACCESS_DOCTOR = { email: "duc.nv@oze.vn", password: "password123" };
const FILLING = 9; // "Trám răng"
const SCALING = 2; // "Lấy cao răng"
const M = {
    notApproved: "Cannot start treatment because the plan is not approved.",
    earlierStage: "Cannot start this stage because an earlier stage is not completed.",
    notScheduled: "Cannot start this stage because it is not scheduled.",
    notInProgress: "Cannot update or complete this stage because it is not in progress.",
    stageNotFound: "Treatment stage not found.",
    planNotFound: "Treatment plan not found.",
    invalidCost: "Actual cost is invalid. Please check again.",
    notesRequired: "Please enter a note when the actual cost differs from the estimated cost.",
    dateInvalid: "Scheduled date is invalid. Please check again.",
    noAccess: "You do not have access to this patient's treatment plan",
    stillInProgress: "A treatment stage is still in progress. Please complete it before cancelling the plan.",
};

test.describe.configure({ mode: "serial" });

const h = {};
const run = { stamp: `${Date.now()}`.slice(-5), patientId: 0, examinationId: 0, plan: null, planB: null };
const stage = (plan, number) => plan.stages.find((item) => item.stageNumber === number);
const planPath = (plan, rest = "") => `/api/TreatmentPlans/${plan.treatmentPlanId}${rest}`;

const expectError = (result, status, message) => {
    expect(result.status, JSON.stringify(result.body)).toBe(status);
    expect(result.body.message).toBe(message);
};

// Draft with one "Trám răng" (400.000) and one "Lấy cao răng" (300.000) stage, proposed, and agreed at the front desk
const agreedPlan = async (request, label, { approve = true } = {}) => {
    const created = await api(request, "POST", `/api/examinations/${run.examinationId}/treatment-plans`, h.doctor, {
        planName: `Playwright TPIT ${label} ${run.stamp}`,
        description: null,
        stages: [
            { serviceId: FILLING, stageName: "Trám răng 36", description: null, estimatedCost: 400000, scheduledDate: clinicDate(1) },
            { serviceId: SCALING, stageName: "Lấy cao răng toàn hàm", description: null, estimatedCost: 300000, scheduledDate: clinicDate(8) },
        ],
    });
    expect(created.status, created.body?.message).toBe(200);
    const proposed = await api(request, "POST", planPath(created.body.data, "/propose"), h.doctor);
    expect(proposed.status, proposed.body?.message).toBe(200);
    if (!approve) return proposed.body.data;
    const approved = await api(request, "POST", planPath(created.body.data, "/approve"), h.receptionist);
    expect(approved.status, approved.body?.message).toBe(200);
    return approved.body.data;
};

// Closes the plans an interrupted run left open on the examination (one open plan per examination)
const closeOpenPlans = async (request) => {
    const list = (await api(request, "GET", `/api/patients/${run.patientId}/treatment-plans?includeClosed=true`, h.receptionist)).body.data;
    for (const summary of list.filter((item) => ["Draft", "Proposed", "Approved", "InProgress"].includes(item.status))) {
        const plan = (await api(request, "GET", `/api/TreatmentPlans/${summary.id}`, h.doctor)).body.data;
        if (plan.status === "Draft") {
            await api(request, "DELETE", planPath(plan), h.doctor);
            continue;
        }
        for (const item of plan.stages.filter((entry) => entry.stageStatus === "InProgress")) {
            await api(request, "POST", planPath(plan, `/stages/${item.id}/complete`), h.doctor, { notes: "Đóng dữ liệu test" });
        }
        await api(request, "POST", planPath(plan, "/cancel"), h.doctor, { reason: "Đóng dữ liệu test" });
    }
};

test.beforeAll(async ({ request }) => {
    h.doctor = await authHeaders(request, ACCOUNTS.doctor);
    h.receptionist = await authHeaders(request, ACCOUNTS.receptionist);
    h.noAccess = await authHeaders(request, NO_ACCESS_DOCTOR);

    const found = await api(request, "GET", `/api/patients?SearchKeyword=${encodeURIComponent(PATIENT_NAME)}`, h.receptionist);
    run.patientId = found.body.data.items.find((item) => item.fullName === PATIENT_NAME)?.id;
    expect(run.patientId, PATIENT_NAME).toBeTruthy();
    const record = (await api(request, "GET", `/api/medical-records/patients/${run.patientId}`, h.doctor)).body.data;
    run.examinationId = record.examinations.find((item) => item.examinationStatus === "InProgress" && item.doctorName.includes("Minh Khoa"))?.id;
    expect(run.examinationId, "an open examination of BS. Khoa on the test patient").toBeTruthy();

    await closeOpenPlans(request);
});

test.afterAll(async ({ request }) => {
    await closeOpenPlans(request);
});

// ---------------------------------------------------------------- UC01 start a stage

test("TPIT01 Start a stage of a plan the patient has not agreed to", async ({ request }) => {
    const plan = await agreedPlan(request, "A", { approve: false });
    expectError(await api(request, "POST", planPath(plan, `/stages/${stage(plan, 1).id}/start`), h.doctor), 400, M.notApproved);
    const approved = await api(request, "POST", planPath(plan, "/approve"), h.receptionist);
    expect(approved.status).toBe(200);
    run.plan = approved.body.data;
    expect(run.plan.status).toBe("Approved");
});

test("TPIT02 Start the second stage before the first", async ({ request }) => {
    expectError(await api(request, "POST", planPath(run.plan, `/stages/${stage(run.plan, 2).id}/start`), h.doctor), 400, M.earlierStage);
});

test("TPIT03 Start a stage that is not in the plan", async ({ request }) => {
    expectError(await api(request, "POST", planPath(run.plan, "/stages/99999999/start"), h.doctor), 404, M.stageNotFound);
    expectError(await api(request, "POST", "/api/TreatmentPlans/99999999/stages/1/start", h.doctor), 404, M.planNotFound);
});

test("TPIT04 Start the first stage", async ({ request }) => {
    const { status, body } = await api(request, "POST", planPath(run.plan, `/stages/${stage(run.plan, 1).id}/start`), h.doctor);
    expect(status, body?.message).toBe(200);
    expect(body.message).toBe("Start treatment stage success!");
    expect(body.data.status, "plan starts on its first stage").toBe("InProgress");
    expect(stage(body.data, 1).stageStatus).toBe("InProgress");
    expect(body.data.nextStage.id, "the stage in progress is the next one").toBe(stage(run.plan, 1).id);
    run.plan = body.data;
});

test("TPIT05 Start a stage already in progress", async ({ request }) => {
    expectError(await api(request, "POST", planPath(run.plan, `/stages/${stage(run.plan, 1).id}/start`), h.doctor), 400, M.notScheduled);
});

// ---------------------------------------------------------------- UC02 update the stage in progress

test("TPIT06 Negative actual cost", async ({ request }) => {
    expectError(await api(request, "PATCH", planPath(run.plan, `/stages/${stage(run.plan, 1).id}`), h.doctor, { actualCost: -1, notes: "x" }), 400, M.invalidCost);
});

test("TPIT07 Actual cost differs from the estimate without a note", async ({ request }) => {
    expectError(await api(request, "PATCH", planPath(run.plan, `/stages/${stage(run.plan, 1).id}`), h.doctor, { actualCost: 450000 }), 400, M.notesRequired);
});

test("TPIT08 Next stage date in the past", async ({ request }) => {
    expectError(
        await api(request, "PATCH", planPath(run.plan, `/stages/${stage(run.plan, 1).id}`), h.doctor, { notes: "Trám thêm mặt nhai", nextStageScheduledDate: clinicDate(-1) }),
        400,
        M.dateInvalid,
    );
});

test("TPIT09 Update a stage that is not started", async ({ request }) => {
    expectError(await api(request, "PATCH", planPath(run.plan, `/stages/${stage(run.plan, 2).id}`), h.doctor, { notes: "x" }), 400, M.notInProgress);
});

test("TPIT10 Update notes, actual cost and next stage date", async ({ request }) => {
    const { status, body } = await api(request, "PATCH", planPath(run.plan, `/stages/${stage(run.plan, 1).id}`), h.doctor, {
        notes: "Trám thêm mặt nhai",
        actualCost: 450000,
        nextStageScheduledDate: clinicDate(10),
    });
    expect(status, body?.message).toBe(200);
    expect(stage(body.data, 1)).toMatchObject({ stageStatus: "InProgress", notes: "Trám thêm mặt nhai", actualCost: 450000 });
    expect(String(stage(body.data, 2).scheduledDate).slice(0, 10)).toBe(clinicDate(10));
    run.plan = body.data;
});

// ---------------------------------------------------------------- UC03 complete a stage and follow the progress

test("TPIT11 Complete a stage that is not in progress", async ({ request }) => {
    expectError(await api(request, "POST", planPath(run.plan, `/stages/${stage(run.plan, 2).id}/complete`), h.doctor), 400, M.notInProgress);
});

test("TPIT12 Complete the first stage", async ({ request }) => {
    const { status, body } = await api(request, "POST", planPath(run.plan, `/stages/${stage(run.plan, 1).id}/complete`), h.doctor);
    expect(status, body?.message).toBe(200);
    expect(body.message).toBe("Complete treatment stage success!");
    const done = stage(body.data, 1);
    expect(done.stageStatus).toBe("Completed");
    expect(String(done.actualDate).slice(0, 10)).toBe(clinicDate());
    expect(done.actualCost, "kept from the update").toBe(450000);
    expect(body.data.status).toBe("InProgress");
    run.plan = body.data;
});

test("TPIT13 Doctor reads the progress", async ({ request }) => {
    const { status, body } = await api(request, "GET", planPath(run.plan, "/progress"), h.doctor);
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ totalStages: 2, completedStages: 1, cancelledStages: 0, progressPercent: 50, completedCost: 450000 });
    expect(body.data.nextStage.id).toBe(stage(run.plan, 2).id);
});

test("TPIT14 Doctor without access reads the progress", async ({ request }) => {
    expectError(await api(request, "GET", planPath(run.plan, "/progress"), h.noAccess), 403, M.noAccess);
});

test("TPIT15 Front desk sees the progress on the patient detail", async ({ page }) => {
    await login(page, ACCOUNTS.receptionist);
    await page.goto(`/reception/patients/${run.patientId}?tab=plans`);
    const card = page.getByRole("listitem").filter({ hasText: run.plan.planName });
    await expect(card).toBeVisible();
    await expect(card.getByText("Đang điều trị")).toBeVisible();
    await expect(card).toContainText("1 / 2 giai đoạn");
    await expect(card).toContainText(`Tiếp theo: Lấy cao răng toàn hàm · ${clinicDate(10).split("-").reverse().join("/")}`);
});

test("TPIT16 Complete the last stage", async ({ request }) => {
    const second = stage(run.plan, 2).id;
    expect((await api(request, "POST", planPath(run.plan, `/stages/${second}/start`), h.doctor)).status).toBe(200);
    const { status, body } = await api(request, "POST", planPath(run.plan, `/stages/${second}/complete`), h.doctor, { notes: null, actualCost: 300000 });
    expect(status, body?.message).toBe(200);
    expect(body.data).toMatchObject({ status: "Completed", completedStages: 2, progressPercent: 100, completedCost: 750000 });
    expect(body.data.nextStage).toBeNull();
    // A finished plan takes no more stages
    expectError(await api(request, "POST", planPath(run.plan, `/stages/${second}/start`), h.doctor), 400, M.notApproved);
});

// ---------------------------------------------------------------- UC04 stop a plan part way

test("TPIT17 Cancel a plan while a stage is in progress", async ({ request }) => {
    run.planB = await agreedPlan(request, "B");
    const started = await api(request, "POST", planPath(run.planB, `/stages/${stage(run.planB, 1).id}/start`), h.doctor);
    expect(started.status).toBe(200);
    expectError(await api(request, "POST", planPath(run.planB, "/cancel"), h.doctor, { reason: "Bệnh nhân chuyển nơi khác" }), 400, M.stillInProgress);
});

test("TPIT18 Cancel a plan without a reason", async ({ request }) => {
    const done = await api(request, "POST", planPath(run.planB, `/stages/${stage(run.planB, 1).id}/complete`), h.doctor);
    expect(done.status, done.body?.message).toBe(200);
    // A blank reason is refused by the request validation ([Required]) before the service checks it
    const refused = await api(request, "POST", planPath(run.planB, "/cancel"), h.doctor, { reason: "  " });
    expect(refused.status, JSON.stringify(refused.body)).toBe(400);
    expect(JSON.stringify(refused.body)).toMatch(/[Rr]eason/);
    const plan = await api(request, "GET", planPath(run.planB, "/progress"), h.doctor);
    expect(plan.body.data.status, "the plan is not cancelled").toBe("InProgress");
});

test("TPIT19 Cancel a plan part way", async ({ request }) => {
    const { status, body } = await api(request, "POST", planPath(run.planB, "/cancel"), h.doctor, { reason: "Bệnh nhân chuyển nơi khác" });
    expect(status, body?.message).toBe(200);
    expect(body.data).toMatchObject({ status: "Cancelled", cancellationReason: "Bệnh nhân chuyển nơi khác", completedStages: 1, cancelledStages: 1, progressPercent: 100 });
    expect(stage(body.data, 1).stageStatus, "the completed stage stays as history").toBe("Completed");
    expect(stage(body.data, 2).stageStatus).toBe("Cancelled");
    expectError(await api(request, "POST", planPath(run.planB, `/stages/${stage(run.planB, 2).id}/start`), h.doctor), 400, M.notApproved);
});

test("TPIT20 Front desk sees the finished and cancelled plans", async ({ page }) => {
    await login(page, ACCOUNTS.receptionist);
    await page.goto(`/reception/patients/${run.patientId}?tab=plans`);
    const finished = page.getByRole("listitem").filter({ hasText: run.plan.planName });
    await expect(finished.getByText("Hoàn tất")).toBeVisible();
    await expect(finished).toContainText("2 / 2 giai đoạn");
    const cancelled = page.getByRole("listitem").filter({ hasText: run.planB.planName });
    await expect(cancelled.getByText("Đã hủy", { exact: true })).toBeVisible();
    await expect(cancelled).toContainText("1 / 1 giai đoạn · 1 đã hủy");
});

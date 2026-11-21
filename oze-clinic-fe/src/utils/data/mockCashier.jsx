// TEMPORARY (cashier pages, FE-first): sample data of the cashier pages, kept in localStorage until the backend has the
// payment-option / deposit / period API. Remove this file and the localStorage key when the pages move to the API.
// Dates are relative to today so the "Hôm nay" filter always has rows.

export const CASHIER_MOCK_KEY = "oze.cashier.mock";
export const CASHIER_MOCK_VERSION = 1;

const OPTION = { FULL: "FULL", PERIODS: "PERIODS", DEPOSIT: "DEPOSIT" };

const period = (id, seq, offsetDays, planAmount, extraAmount, finished) => ({
    id,
    seq,
    appointmentId: 5000 + id,
    offsetDays,
    planAmount,
    extraAmount,
    finished,
});

const PATIENTS = [
    { id: 1, code: "BN0001", name: "Nguyễn Minh Anh", phone: "+84901234567" },
    { id: 2, code: "BN0002", name: "Trần Quốc Bảo", phone: "+84912345678" },
    { id: 3, code: "BN0003", name: "Lê Thu Hà", phone: "+84987654321" },
    { id: 4, code: "BN0004", name: "Phạm Gia Huy", phone: "+84933221100" },
    { id: 5, code: "BN0005", name: "Hoàng Thị Mai", phone: "+84977889900" },
    { id: 6, code: "BN0006", name: "Đỗ Văn Nam", phone: "+84966554433" },
    { id: 7, code: "BN0007", name: "Vũ Thanh Tâm", phone: "+84944332211" },
    { id: 8, code: "BN0008", name: "Bùi Ngọc Lan", phone: "+84922113344" },
    { id: 9, code: "BN0009", name: "Phan Minh Khoa", phone: "+84911002233" },
];

const PLANS = [
    // Theo đợt, buổi hôm nay đã xong, chưa thu
    {
        id: 101,
        patientId: 1,
        name: "Cấy ghép Implant răng 36",
        planPrice: 24000000,
        option: OPTION.PERIODS,
        depositRate: null,
        periods: [period(1, 1, 0, 4000000, 0, true), period(2, 2, 14, 14000000, 0, false), period(3, 3, 75, 6000000, 0, false)],
    },
    // Đặt cọc, nộp thiếu cọc, đợt 1 có phát sinh, đợt 2 xong hôm nay
    {
        id: 102,
        patientId: 2,
        name: "Niềng răng mắc cài kim loại",
        planPrice: 30000000,
        option: OPTION.DEPOSIT,
        depositRate: 0.3,
        periods: [period(4, 1, -5, 6000000, 500000, true), period(5, 2, 0, 8000000, 0, true), period(6, 3, 40, 16000000, 0, false)],
    },
    // Chưa chọn phương án, buổi đầu đã xong
    {
        id: 103,
        patientId: 3,
        name: "Bọc răng sứ 11, 21",
        planPrice: 12000000,
        option: null,
        depositRate: null,
        periods: [period(7, 1, 0, 5000000, 0, true), period(8, 2, 10, 7000000, 0, false)],
    },
    // Toàn bộ, đã thu một phần, đợt 1 có phát sinh
    {
        id: 104,
        patientId: 4,
        name: "Điều trị tủy và phục hình răng 46",
        planPrice: 8000000,
        option: OPTION.FULL,
        depositRate: null,
        periods: [period(9, 1, -3, 4000000, 600000, true), period(10, 2, 7, 4000000, 0, false)],
    },
    // Đặt cọc đủ, cọc trừ hết vào phát sinh của đợt 1
    {
        id: 106,
        patientId: 6,
        name: "Phục hình hàm tháo lắp",
        planPrice: 10000000,
        option: OPTION.DEPOSIT,
        depositRate: 0.3,
        periods: [period(11, 1, -10, 1000000, 3000000, true), period(12, 2, 0, 2000000, 0, true), period(13, 3, 20, 7000000, 0, false)],
    },
    // Theo đợt, đợt 2 đang chờ xác nhận chuyển khoản
    {
        id: 107,
        patientId: 7,
        name: "Trám và điều trị nha chu",
        planPrice: 6000000,
        option: OPTION.PERIODS,
        depositRate: null,
        periods: [period(14, 1, -20, 3000000, 0, true), period(15, 2, -1, 3000000, 0, true)],
    },
    // Đặt cọc, các đợt đã trả bằng tiền, cọc thừa cần hoàn
    {
        id: 108,
        patientId: 8,
        name: "Tẩy trắng và trám thẩm mỹ",
        planPrice: 5000000,
        option: OPTION.DEPOSIT,
        depositRate: 0.3,
        periods: [period(16, 1, -30, 2000000, 0, true), period(17, 2, -2, 3000000, 0, true)],
    },
    // Đã thanh toán hết
    {
        id: 109,
        patientId: 9,
        name: "Nhổ răng khôn 38",
        planPrice: 2000000,
        option: OPTION.PERIODS,
        depositRate: null,
        periods: [period(18, 1, -6, 2000000, 0, true)],
    },
];

const visit = (id, patientId, offsetDays, time, services) => ({ id, patientId, appointmentId: 7000 + id, offsetDays, time, services });

const VISITS = [
    // Cùng ngày với đợt 1 của kế hoạch Implant, khác lượt hẹn
    visit(201, 1, 0, "09:30", [{ id: 1, name: "Chụp X-quang toàn cảnh", amount: 400000 }]),
    // Không khám hôm nay, còn nợ: A 500k đã thu 300k, B chưa thu
    visit(202, 5, -2, "14:00", [
        { id: 2, name: "Lấy cao răng, đánh bóng", amount: 500000 },
        { id: 3, name: "Khám tổng quát", amount: 100000 },
    ]),
];

const receipt = (id, patientId, offsetDays, time, method, status, lines) => ({
    id,
    patientId,
    offsetDays,
    time,
    method,
    status,
    ref: method === "CASH" ? null : `FT${id}0000`,
    note: null,
    receivedBy: "Nguyễn Thị Lan",
    lines,
});

const RECEIPTS = [
    receipt(301, 2, -6, "10:15", "CASH", "CONFIRMED", [{ kind: "DEPOSIT", planId: 102, amount: 5000000 }]),
    receipt(302, 4, -12, "09:05", "BANK_TRANSFER", "CONFIRMED", [{ kind: "FULL", planId: 104, amount: 5000000 }]),
    receipt(303, 5, -2, "14:40", "CASH", "CONFIRMED", [{ kind: "VISIT_SERVICE", visitId: 202, serviceId: 2, amount: 300000 }]),
    receipt(304, 6, -12, "08:30", "CASH", "CONFIRMED", [{ kind: "DEPOSIT", planId: 106, amount: 3000000 }]),
    receipt(305, 7, -20, "16:00", "CASH", "CONFIRMED", [{ kind: "PERIOD", planId: 107, periodId: 14, amount: 3000000 }]),
    receipt(306, 7, -1, "11:20", "BANK_TRANSFER", "PENDING", [{ kind: "PERIOD", planId: 107, periodId: 15, amount: 3000000 }]),
    receipt(307, 8, -30, "15:00", "CASH", "CONFIRMED", [{ kind: "PERIOD", planId: 108, periodId: 16, amount: 2000000 }]),
    receipt(308, 8, -25, "09:40", "CASH", "CONFIRMED", [{ kind: "DEPOSIT", planId: 108, amount: 1500000 }]),
    receipt(309, 8, -2, "10:00", "QR_TRANSFER", "CONFIRMED", [{ kind: "PERIOD", planId: 108, periodId: 17, amount: 3000000 }]),
    receipt(310, 9, -6, "17:10", "CASH", "CONFIRMED", [{ kind: "PERIOD", planId: 109, periodId: 18, amount: 2000000 }]),
];

const addDays = (today, days) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

// Plain data with real dates; ids keep counting from nextId
export const buildCashierSeed = (today) => ({
    version: CASHIER_MOCK_VERSION,
    nextId: 1000,
    patients: structuredClone(PATIENTS),
    plans: PLANS.map(({ periods, ...plan }) => ({
        ...plan,
        periods: periods.map(({ offsetDays, ...p }) => ({ ...p, date: addDays(today, offsetDays) })),
    })),
    visits: VISITS.map(({ offsetDays, time, ...v }) => ({ ...v, startAt: `${addDays(today, offsetDays)}T${time}`, services: structuredClone(v.services) })),
    receipts: RECEIPTS.map(({ offsetDays, time, ...r }) => ({ ...r, createdAt: `${addDays(today, offsetDays)}T${time}`, lines: structuredClone(r.lines) })),
});

import {
    Briefcase,
    Building2,
    CalendarDays,
    ChartColumn,
    ClipboardList,
    CreditCard,
    FileText,
    Heart,
    HeartHandshake,
    History,
    Landmark,
    LayoutDashboard,
    Rows3,
    ScanLine,
    Shield,
    Stethoscope,
    User,
    Users,
    Wallet,
} from "lucide-react";
import { USER_ROLES } from "./messages";
import { ROUTES, getDoctorExamStepRoute } from "./routes";

// Sidebar tree per role. A node is either
//   a link:  { key, label, icon, to, badge?, end? }   (end: lit only on that exact path, not the pages below it)
//   a group: { key, label, icon, children: [{ key, label, to, badge? }] }
// badge names a count the sidebar looks up (see useSidebarBadges in Sidebar.jsx); 0 shows nothing.
// A new page also needs its path in ROUTES / ROLE_ROUTES (utils/routes.jsx).

export const SIDEBAR_BADGES = {
    PENDING_LEAVES: "pendingLeaves",
    PENDING_REFUNDS: "pendingRefunds",
};

const DASHBOARD_LINK = { key: "dashboard", label: "Tổng quan", icon: LayoutDashboard, to: ROUTES.DASHBOARD };

const WORK_GROUP = {
    key: "work",
    label: "Công việc",
    icon: Briefcase,
    children: [{ key: "work-schedule", label: "Lịch làm việc", to: ROUTES.WORK_SCHEDULE }],
};

const ACCOUNT_GROUP = {
    key: "account",
    label: "Cá nhân",
    icon: User,
    children: [
        { key: "profile", label: "Hồ sơ cá nhân", to: ROUTES.PROFILE },
        { key: "change-password", label: "Đổi mật khẩu", to: ROUTES.CHANGE_PASSWORD },
    ],
};

const SIDEBAR_MENU = {
    [USER_ROLES.CLINIC_MANAGER]: [
        { key: "reports", label: "Báo cáo", icon: ChartColumn, to: ROUTES.DASHBOARD },
        {
            key: "operations",
            label: "Vận hành",
            icon: Building2,
            children: [
                { key: "work-shifts", label: "Phân ca", to: ROUTES.ADMIN_WORK_SHIFTS },
                { key: "leave-requests", label: "Đơn xin nghỉ", to: ROUTES.ADMIN_LEAVE_REQUESTS, badge: SIDEBAR_BADGES.PENDING_LEAVES },
                { key: "refunds", label: "Duyệt hoàn tiền", to: ROUTES.ADMIN_REFUNDS, badge: SIDEBAR_BADGES.PENDING_REFUNDS },
                { key: "debts", label: "Công nợ", to: ROUTES.ADMIN_DEBTS },
                { key: "reconciliation", label: "Đối soát cuối ngày", to: ROUTES.ADMIN_RECONCILIATION },
            ],
        },
        {
            key: "catalog",
            label: "Danh mục",
            icon: Users,
            children: [
                { key: "services", label: "Dịch vụ", to: ROUTES.ADMIN_SERVICES },
                { key: "rooms", label: "Phòng", to: ROUTES.ADMIN_ROOMS },
                { key: "accounts", label: "Tài khoản & nhân sự", to: ROUTES.ADMIN_STAFF },
            ],
        },
        {
            key: "system",
            label: "Hệ thống",
            icon: Shield,
            children: [
                { key: "system-logs", label: "Nhật ký hệ thống", to: ROUTES.ADMIN_SYSTEM_LOGS },
                { key: "settings", label: "Cấu hình hệ thống", to: ROUTES.ADMIN_SETTINGS },
            ],
        },
    ],
    [USER_ROLES.DOCTOR]: [
        DASHBOARD_LINK,
        { key: "work-schedule", label: "Lịch làm việc", icon: CalendarDays, to: ROUTES.WORK_SCHEDULE },
        // The queue sits on the exam page; end keeps it unlit on the exam steps below
        { key: "queue", label: "Hàng chờ", icon: Rows3, to: ROUTES.DOCTOR_EXAMINATION, end: true },
        { key: "patients", label: "Hồ sơ bệnh án", icon: FileText, to: ROUTES.DOCTOR_PATIENTS },
        {
            key: "examination",
            label: "Khám & Điều trị",
            icon: Stethoscope,
            children: [
                { key: "diagnosis", label: "Khám & chẩn đoán", to: getDoctorExamStepRoute(1) },
                { key: "plan", label: "Lập kế hoạch điều trị", to: getDoctorExamStepRoute(2) },
                { key: "treatment", label: "Điều trị", to: getDoctorExamStepRoute(3) },
                { key: "prescription", label: "Kê đơn thuốc", to: getDoctorExamStepRoute(4) },
            ],
        },
        { ...ACCOUNT_GROUP, label: "Tài khoản" },
    ],
    // No overview page: the technician works from the imaging queue (also where /dashboard leads, see DashboardPage)
    [USER_ROLES.DENTAL_IMAGING_TECHNICIAN]: [
        { key: "imaging", label: "Chụp chiếu", icon: ScanLine, to: ROUTES.TECHNICIAN_IMAGING_REQUESTS },
        { key: "imaging-history", label: "Lịch sử chụp chiếu", icon: History, to: ROUTES.TECHNICIAN_IMAGING_RESULTS },
        WORK_GROUP,
        ACCOUNT_GROUP,
    ],
    [USER_ROLES.RECEPTIONIST]: [
        DASHBOARD_LINK,
        { key: "queue", label: "Hàng chờ", icon: ClipboardList, to: ROUTES.RECEPTION_QUEUE },
        {
            key: "appointments",
            label: "Lịch hẹn",
            icon: CalendarDays,
            children: [
                { key: "schedule", label: "Quản lý lịch hẹn", to: ROUTES.RECEPTION_SCHEDULE },
                { key: "check-in", label: "Check-in hôm nay", to: ROUTES.RECEPTION_CHECK_IN },
                { key: "confirm-appointments", label: "Xác nhận lịch hẹn", to: ROUTES.RECEPTION_APPOINTMENTS },
            ],
        },
        {
            key: "patients",
            label: "Bệnh nhân",
            icon: Users,
            children: [
                { key: "patient-list", label: "Hồ sơ bệnh nhân", to: ROUTES.RECEPTION_PATIENTS },
            ],
        },
        {
            key: "customer-care",
            label: "CSKH",
            icon: HeartHandshake,
            children: [
                { key: "consultations", label: "Yêu cầu tư vấn", to: ROUTES.RECEPTION_CONSULTATIONS },
                { key: "follow-ups", label: "Nhắc tái khám", to: ROUTES.RECEPTION_FOLLOW_UPS },
            ],
        },
        {
            key: "finance",
            label: "Thu ngân",
            icon: Wallet,
            children: [
                { key: "payments", label: "Danh sách thanh toán", to: ROUTES.RECEPTION_PAYMENTS },
                { key: "deposits", label: "Đặt cọc dịch vụ", to: ROUTES.RECEPTION_DEPOSITS },
                { key: "periods", label: "Thanh toán theo đợt", to: ROUTES.RECEPTION_PERIODS },
                { key: "collect", label: "Ghi nhận thu tiền", to: ROUTES.RECEPTION_COLLECT },
            ],
        },
        {
            key: "finance-management",
            label: "Quản lý tài chính",
            icon: Landmark,
            children: [
                { key: "invoice-list", label: "Hóa đơn", to: ROUTES.RECEPTION_INVOICE_LIST },
                { key: "debts", label: "Công nợ", to: ROUTES.RECEPTION_DEBTS },
                { key: "refunds", label: "Hoàn tiền", to: ROUTES.RECEPTION_REFUNDS },
            ],
        },
        {
            ...WORK_GROUP,
            children: [
                ...WORK_GROUP.children,
                { key: "cash-handover", label: "Phiếu giao ca", to: ROUTES.RECEPTION_CASH_HANDOVER },
                { key: "reconciliation", label: "Đối soát cuối ngày", to: ROUTES.RECEPTION_RECONCILIATION },
            ],
        },
        ACCOUNT_GROUP,
    ],
    [USER_ROLES.PATIENT]: [
        DASHBOARD_LINK,
        {
            key: "appointments",
            label: "Lịch khám",
            icon: CalendarDays,
            children: [
                { key: "book-appointment", label: "Đặt lịch khám", to: ROUTES.BOOK_APPOINTMENT },
                { key: "my-appointments", label: "Lịch hẹn sắp tới", to: ROUTES.APPOINTMENTS },
            ],
        },
        {
            key: "health",
            label: "Sức khoẻ",
            icon: Heart,
            children: [
                { key: "medical-history", label: "Lịch sử khám", to: ROUTES.MEDICAL_RECORD },
                { key: "treatment-plans", label: "Kế hoạch điều trị", to: ROUTES.TREATMENT_PLANS },
                { key: "documents", label: "Cung cấp tài liệu", to: ROUTES.DOCUMENTS },
            ],
        },
        {
            key: "billing",
            label: "Thanh toán",
            icon: CreditCard,
            children: [
                { key: "payment-history", label: "Lịch sử thanh toán", to: ROUTES.PAYMENT_HISTORY },
                { key: "refund-requests", label: "Yêu cầu hoàn tiền", to: ROUTES.REFUND_REQUESTS },
            ],
        },
        { ...ACCOUNT_GROUP, label: "Tài khoản" },
    ],
};

export const getSidebarMenu = (role) => (Object.hasOwn(SIDEBAR_MENU, role) ? SIDEBAR_MENU[role] : []);

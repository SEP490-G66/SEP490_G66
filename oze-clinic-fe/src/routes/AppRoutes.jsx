import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import MainLayout from "../layouts/MainLayout";
import ForgotPasswordPage from "../pages/common/ForgotPasswordPage";
import HomePage from "../pages/common/homepage/HomePage";
import Register from "../pages/common/Register";
import ResetPasswordPage from "../pages/common/ResetPasswordPage";
import SignInPage from "../pages/common/SignInPage";
import VerifyOtpPage from "../pages/common/VerifyOtpPage";
import AboutUs from "../pages/common/homepage/AboutUs";
import ContactPage from "../pages/common/ContactPage";
import PrivacyPolicyPage from "../pages/common/PrivacyPolicyPage";
import TermsOfUsePage from "../pages/common/TermsOfUsePage";
import ServiceDetail from "../pages/common/ServiceDetail";
import ArticleDetail from "../pages/common/ArticleDetail";
import ServiceList from "../pages/common/ServiceList";
import DoctorList from "../pages/common/DoctorList";
import SearchResults from "../pages/common/SearchResults";
import GuestBookAppointment from "../pages/common/GuestBookAppointment";
import DashboardPage from "../pages/common/DashboardPage";
import ProfilePage from "../pages/common/ProfilePage";
import ChangePasswordPage from "../pages/common/ChangePasswordPage";
import ComingSoonPage from "../pages/common/ComingSoonPage";
import ReceptionCheckIn from "../pages/receptionist/ReceptionCheckIn";
import ReceptionInvoices from "../pages/receptionist/ReceptionInvoices";
import ReceptionDebts from "../pages/receptionist/ReceptionDebts";
import ReceptionRefunds from "../pages/receptionist/ReceptionRefunds";
import ReceptionReconciliation from "../pages/receptionist/ReceptionReconciliation";
import ReceptionPatients from "../pages/receptionist/ReceptionPatients";
import ReceptionSchedule from "../pages/receptionist/ReceptionSchedule";
import ReceptionPatientDetail from "../pages/receptionist/ReceptionPatientDetail";
import ReceptionPatientForm from "../pages/receptionist/ReceptionPatientForm";
import ReceptionConsultations from "../pages/receptionist/ReceptionConsultations";
import DailyReconciliation from "../pages/admin/DailyReconciliation";
import ReceptionConfirm from "../pages/receptionist/ReceptionConfirm";
import ReceptionFollowUps from "../pages/receptionist/ReceptionFollowUps";
import ReceptionChangeRequests from "../pages/receptionist/ReceptionChangeRequests";
import ReceptionQueue from "../pages/receptionist/ReceptionQueue";
import CashHandover from "../pages/receptionist/CashHandover";
import CashHandoverDetail from "../pages/receptionist/CashHandoverDetail";
import CashierPayments from "../pages/receptionist/CashierPayments";
import CashierAccount from "../pages/receptionist/CashierAccount";
import CashierPaymentOption from "../pages/receptionist/CashierPaymentOption";
import CashierDeposits from "../pages/receptionist/CashierDeposits";
import CashierPeriods from "../pages/receptionist/CashierPeriods";
import CashierCollect from "../pages/receptionist/CashierCollect";
import WorkSchedule from "../pages/common/WorkSchedule";
import MyAppointments from "../pages/patient/MyAppointments";
import AppointmentDetail from "../pages/patient/AppointmentDetail";
import MedicalHistory from "../pages/patient/MedicalHistory";
import VisitDetail from "../pages/patient/VisitDetail";
import TreatmentPlans from "../pages/patient/TreatmentPlans";
import TreatmentPlanDetail from "../pages/patient/TreatmentPlanDetail";
import PatientDocuments from "../pages/patient/PatientDocuments";
import BookAppointment from "../pages/patient/BookAppointment";
import InstallmentDetail from "../pages/patient/InstallmentDetail";
import InvoiceDetailPage from "../pages/patient/InvoiceDetailPage";
import PaymentHistory from "../pages/patient/PaymentHistory";
import RefundRequests from "../pages/patient/RefundRequests";
import AuditLogManagement from "../pages/admin/AuditLogManagement";
import DebtManagement from "../pages/admin/DebtManagement";
import LeaveRequestManagement from "../pages/admin/LeaveRequestManagement";
import RefundRequestManagement from "../pages/admin/RefundRequestManagement";
import RoomManagement from "../pages/admin/RoomManagement";
import ServiceManagement from "../pages/admin/ServiceManagement";
import StaffManagement from "../pages/admin/StaffManagement";
import WorkShiftManagement from "../pages/admin/WorkShiftManagement";
import SystemSettings from "../pages/admin/SystemSettings";
import DoctorPatientRecordPage from "../pages/doctor/DoctorPatientRecordPage";
import DoctorPatientsPage from "../pages/doctor/DoctorPatientsPage";
import DoctorQueuePage from "../pages/doctor/DoctorQueuePage";
import ExaminationPage from "../pages/doctor/examination/ExaminationPage";
import ImagingReviewPage from "../pages/doctor/ImagingReviewPage";
import ImagingCapturePage from "../pages/imagingTechnician/ImagingCapturePage";
import ImagingHistoryPage from "../pages/imagingTechnician/ImagingHistoryPage";
import GlobalException from "../pages/globalException/GlobalException";
import GlobalErrorListener from "../components/error/GlobalErrorListener";
import useSession from "../hooks/useSession";
import { ROUTES, ROLE_ROUTES, getErrorRoute } from "../utils/routes";
import RequireRole from "./RequireRole";

// Placeholder for pages not built yet. Error pages never render inside a layout, so it goes to /error/404.
const NOT_FOUND = <Navigate to={getErrorRoute(404)} replace />;

const routes = [
    {
        path: ROUTES.HOME,
        element: <HomePage />
    },
    {
        path: ROUTES.SIGN_IN,
        element: <SignInPage />
    },
    {
        path: ROUTES.REGISTER,
        element: <Register />
    },
    {
        path: ROUTES.ABOUT_US,
        element: <AboutUs />
    },
    {
        path: ROUTES.CONTACT,
        element: <ContactPage />
    },
    {
        path: ROUTES.PRIVACY_POLICY,
        element: <PrivacyPolicyPage />
    },
    {
        path: ROUTES.TERMS_OF_USE,
        element: <TermsOfUsePage />
    },
    {
        path: ROUTES.SERVICES,
        element: <ServiceList />
    },
    {
        path: ROUTES.DOCTORS,
        element: <DoctorList />
    },
    {
        path: ROUTES.SEARCH,
        element: <SearchResults />
    },
    {
        path: ROUTES.SERVICE_DETAIL,
        element: <ServiceDetail />
    },
    {
        path: ROUTES.ARTICLE_DETAIL,
        element: <ArticleDetail />
    },
    {
        path: ROUTES.FORGOT_PASSWORD,
        element: <ForgotPasswordPage />
    },
    {
        path: ROUTES.VERIFY_OTP,
        element: <VerifyOtpPage />
    },
    {
        path: ROUTES.RESET_PASSWORD,
        element: <ResetPasswordPage />
    }
]

// Error pages are full screen, outside any layout.
const errorRoutes = [
    {
        path: ROUTES.ERROR,
        element: <GlobalException />
    },
    {
        path: "*",
        element: <GlobalException code={404} />
    }
]

const sessionRoutes = [
    {
        path: ROUTES.BOOK_APPOINTMENT,
        element: <GuestBookAppointment />
    }
]

const sharedRoutes = [
    {
        path: ROUTES.DASHBOARD,
        element: <DashboardPage />
    },
    {
        path: ROUTES.PROFILE,
        element: <ProfilePage />
    },
    {
        path: ROUTES.PROFILE_VERIFY_OTP,
        element: <VerifyOtpPage />
    },
    {
        path: ROUTES.CHANGE_PASSWORD,
        element: <ChangePasswordPage />
    }
]

// Role pages (ROLE_ROUTES) that are built so far.
const ROLE_PAGES = {
    // Receptionist sidebar pages open the counter workspace on the matching tab
    [ROUTES.RECEPTION_APPOINTMENTS]: <ReceptionConfirm />,
    [ROUTES.RECEPTION_CHECK_IN]: <ReceptionCheckIn />,
    [ROUTES.RECEPTION_SCHEDULE]: <ReceptionSchedule />,
    [ROUTES.RECEPTION_INVOICES]: <Navigate to={ROUTES.RECEPTION_PAYMENTS} replace />,
    [ROUTES.RECEPTION_QUEUE]: <ReceptionQueue />,
    [ROUTES.RECEPTION_FOLLOW_UPS]: <ReceptionFollowUps />,
    [ROUTES.RECEPTION_CHANGE_REQUESTS]: <ReceptionChangeRequests />,
    [ROUTES.RECEPTION_DEBTS]: <ReceptionDebts />,
    [ROUTES.RECEPTION_INVOICE_LIST]: <ReceptionInvoices />,
    [ROUTES.RECEPTION_REFUNDS]: <ReceptionRefunds />,
    [ROUTES.RECEPTION_RECONCILIATION]: <ReceptionReconciliation />,
    [ROUTES.RECEPTION_PAYMENTS]: (
        <Routes>
            <Route index element={<CashierPayments />} />
            <Route path=":patientId" element={<CashierAccount />} />
            <Route path=":patientId/plans/:planId/option" element={<CashierPaymentOption />} />
            <Route path="*" element={NOT_FOUND} />
        </Routes>
    ),
    [ROUTES.RECEPTION_DEPOSITS]: <CashierDeposits />,
    [ROUTES.RECEPTION_PERIODS]: <CashierPeriods />,
    [ROUTES.RECEPTION_COLLECT]: <CashierCollect />,
    [ROUTES.RECEPTION_PATIENTS]: (
        <Routes>
            <Route index element={<ReceptionPatients />} />
            <Route path="new" element={<ReceptionPatientForm />} />
            <Route path=":patientId" element={<ReceptionPatientDetail />} />
            <Route path=":patientId/edit" element={<ReceptionPatientForm />} />
            <Route path="*" element={NOT_FOUND} />
        </Routes>
    ),
    [ROUTES.RECEPTION_CONSULTATIONS]: <ReceptionConsultations />,
    [ROUTES.RECEPTION_CASH_HANDOVER]: (
        <Routes>
            <Route index element={<CashHandover />} />
            <Route path=":sessionId" element={<CashHandoverDetail />} />
            <Route path="*" element={NOT_FOUND} />
        </Routes>
    ),
    [ROUTES.WORK_SCHEDULE]: <WorkSchedule />,
    [ROUTES.APPOINTMENTS]: (
        <Routes>
            <Route index element={<MyAppointments />} />
            <Route path=":appointmentId" element={<AppointmentDetail />} />
            <Route path="*" element={NOT_FOUND} />
        </Routes>
    ),
    [ROUTES.BOOK_APPOINTMENT]: (
        <Routes>
            <Route index element={<BookAppointment />} />
            <Route path="*" element={NOT_FOUND} />
        </Routes>
    ),
    [ROUTES.MEDICAL_RECORD]: (
        <Routes>
            <Route index element={<MedicalHistory />} />
            <Route path=":examinationId" element={<VisitDetail />} />
            <Route path="*" element={NOT_FOUND} />
        </Routes>
    ),
    [ROUTES.TREATMENT_PLANS]: (
        <Routes>
            <Route index element={<TreatmentPlans />} />
            <Route path=":planId" element={<TreatmentPlanDetail />} />
            <Route path="*" element={NOT_FOUND} />
        </Routes>
    ),
    [ROUTES.DOCUMENTS]: <PatientDocuments />,
    // Plans paid in instalments now live in the "Trả theo đợt" tab of Lịch sử thanh toán; the detail keeps this path.
    [ROUTES.PAYMENT_DEBTS]: (
        <Routes>
            <Route index element={<Navigate to={`${ROUTES.PAYMENT_HISTORY}?tab=installments`} replace />} />
            <Route path=":debtId" element={<InstallmentDetail />} />
            <Route path="*" element={NOT_FOUND} />
        </Routes>
    ),
    [ROUTES.PAYMENT_HISTORY]: (
        <Routes>
            <Route index element={<PaymentHistory />} />
            <Route path=":invoiceId" element={<InvoiceDetailPage />} />
            <Route path="*" element={NOT_FOUND} />
        </Routes>
    ),
    [ROUTES.REFUND_REQUESTS]: (
        <Routes>
            <Route index element={<RefundRequests />} />
            <Route path="*" element={NOT_FOUND} />
        </Routes>
    ),
    [ROUTES.DOCTOR_QUEUE]: <DoctorQueuePage />,
    [ROUTES.DOCTOR_PATIENTS]: (
        <Routes>
            <Route index element={<DoctorPatientsPage />} />
            <Route path=":patientId" element={<DoctorPatientRecordPage />} />
            <Route path="*" element={NOT_FOUND} />
        </Routes>
    ),
    [ROUTES.DOCTOR_EXAMINATION]: <ExaminationPage />,
    [ROUTES.DOCTOR_IMAGING_REVIEWS]: <ImagingReviewPage />,
    [ROUTES.TECHNICIAN_IMAGING_REQUESTS]: <ImagingCapturePage />,
    [ROUTES.TECHNICIAN_IMAGING_RESULTS]: <ImagingHistoryPage />,
    [ROUTES.ADMIN_ROOMS]: <RoomManagement />,
    [ROUTES.ADMIN_SERVICES]: <ServiceManagement />,
    [ROUTES.ADMIN_STAFF]: <StaffManagement />,
    [ROUTES.ADMIN_WORK_SHIFTS]: <WorkShiftManagement />,
    [ROUTES.ADMIN_SETTINGS]: <SystemSettings />,
    [ROUTES.ADMIN_SYSTEM_LOGS]: <AuditLogManagement />,
    [ROUTES.ADMIN_LEAVE_REQUESTS]: <LeaveRequestManagement />,
    [ROUTES.ADMIN_REFUNDS]: <RefundRequestManagement />,
    // Real debts from the API; the manager sees them without the receptionist's reminder and payment buttons
    [ROUTES.ADMIN_DEBTS]: <DebtManagement />,
    [ROUTES.ADMIN_RECONCILIATION]: <DailyReconciliation />
}

// Titles of the sidebar pages not built yet (same labels as the sidebar); they show ComingSoonPage inside the layout.
const COMING_SOON_TITLES = {
    [ROUTES.APPOINTMENTS]: "Lịch hẹn sắp tới",
    [ROUTES.DOCTOR_APPOINTMENTS]: "Lịch hẹn khám",
    [ROUTES.DOCTOR_TREATMENT_PLANS]: "Kế hoạch điều trị",
    [ROUTES.DOCTOR_IMAGING_REQUESTS]: "Yêu cầu chụp phim",
    [ROUTES.ADMIN_ROLES]: "Vai trò",
}

const getRolePage = (path) =>
    ROLE_PAGES[path] ?? (COMING_SOON_TITLES[path] ? <ComingSoonPage title={COMING_SOON_TITLES[path]} /> : NOT_FOUND)

const toRoleRoutes = (paths) => paths.map((path) => ({ path: `${path}/*`, element: getRolePage(path) }))

const renderRoutes = (list) =>
    list.map((route) => (
        <Route
            key={route.path}
            path={route.path}
            element={route.element}
        />
    ));

function AppRoutes() {
    const { token } = useSession();

    return (
        <BrowserRouter useTransitions={false}>
            <GlobalErrorListener />
            <Routes>
                <Route element={<MainLayout />}>
                    {renderRoutes(routes)}
                    {!token && renderRoutes(sessionRoutes)}
                </Route>
                <Route element={<RequireRole />}>
                    <Route element={<AppLayout />}>
                        {renderRoutes(sharedRoutes)}
                        {ROLE_ROUTES.map(({ roles, paths }) => (
                            <Route key={roles.join()} element={<RequireRole roles={roles} />}>
                                {renderRoutes(toRoleRoutes(paths))}
                            </Route>
                        ))}
                    </Route>
                </Route>
                {renderRoutes(errorRoutes)}
            </Routes>
        </BrowserRouter>
    );
}

export default AppRoutes;

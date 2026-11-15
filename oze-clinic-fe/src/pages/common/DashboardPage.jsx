import { Navigate } from "react-router-dom";
import useSession from "@/hooks/useSession";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import DoctorDashboard from "@/pages/doctor/DoctorDashboard";
import PatientDashboard from "@/pages/patient/PatientDashboard";
import ReceptionistDashboard from "@/pages/receptionist/ReceptionistDashboard";
import { USER_ROLES } from "@/utils/messages";
import { ROUTES, getErrorRoute } from "@/utils/routes";

const DASHBOARDS = {
    [USER_ROLES.PATIENT]: PatientDashboard,
    [USER_ROLES.DOCTOR]: DoctorDashboard,
    [USER_ROLES.RECEPTIONIST]: ReceptionistDashboard,
    [USER_ROLES.CLINIC_MANAGER]: AdminDashboard,
};

// /dashboard is shared: each role sees its own dashboard. The technician has none and goes to the imaging queue.
const DashboardPage = () => {
    const { role } = useSession();
    if (role === USER_ROLES.DENTAL_IMAGING_TECHNICIAN) return <Navigate to={ROUTES.TECHNICIAN_IMAGING_REQUESTS} replace />;

    const Dashboard = DASHBOARDS[role];
    return Dashboard ? <Dashboard /> : <Navigate to={getErrorRoute(403)} replace />;
};

export default DashboardPage;

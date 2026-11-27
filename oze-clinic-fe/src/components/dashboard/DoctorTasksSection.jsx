import { ListChecks, ScanLine } from "lucide-react";
import DashboardSection from "@/components/dashboard/DashboardSection";
import TaskItem from "@/components/dashboard/TaskItem";
import { DOCTOR_TASK_TYPES } from "@/services/doctorWorkService";
import { ROUTES } from "@/utils/routes";

const TITLE_ID = "doctor-dashboard-tasks";

// Icon and page of each task type; an unknown type links to the dashboard.
const TASK_META = {
    [DOCTOR_TASK_TYPES.IMAGING_REVIEW]: { icon: ScanLine, to: ROUTES.DOCTOR_IMAGING_REVIEWS },
};

// Doctor dashboard "Việc đang chờ bạn" (e.g. imaging results to review). tasks: [{ id, type, title, detail, status }].
const DoctorTasksSection = ({ tasks, loading }) => (
    <DashboardSection
        id={TITLE_ID}
        title="Việc đang chờ bạn"
        busy={loading}
        empty={!loading && tasks.length === 0 && { icon: ListChecks, text: "Bạn không có việc nào đang chờ." }}
    >
        {loading && (
            <div aria-hidden="true" className="flex flex-col gap-3">
                <div className="skeleton h-16" />
                <div className="skeleton h-16" />
                <div className="skeleton h-16" />
            </div>
        )}
        {!loading && tasks.length > 0 && (
            <ul className="flex flex-col gap-3">
                {tasks.map((task) => (
                    <li key={task.id}>
                        <TaskItem
                            icon={TASK_META[task.type]?.icon}
                            title={task.title}
                            detail={task.detail}
                            badge={{ label: task.status, tone: "warning" }}
                            to={TASK_META[task.type]?.to ?? ROUTES.DASHBOARD}
                        />
                    </li>
                ))}
            </ul>
        )}
    </DashboardSection>
);

export default DoctorTasksSection;

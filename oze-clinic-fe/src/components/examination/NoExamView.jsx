import { Stethoscope } from "lucide-react";
import ExamStepper from "@/components/examination/ExamStepper";
import PatientCard from "@/components/examination/PatientCard";

// Exam page before anyone is called in: locked process, empty patient card, "Chưa có lượt khám".
const NoExamView = ({ waitingCount }) => (
    <>
        <ExamStepper locked />
        <PatientCard patient={null} />
        <div className="card-app flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
                <Stethoscope className="size-7" />
            </span>
            <h2 className="font-heading text-heading-2 text-ink">Chưa có lượt khám</h2>
            <p className="text-muted">
                {waitingCount > 0 ? `Có ${waitingCount} bệnh nhân đang chờ. Bấm “Gọi vào khám” ở một bệnh nhân để bắt đầu.` : "Hàng chờ đang trống."}
            </p>
        </div>
    </>
);

export default NoExamView;

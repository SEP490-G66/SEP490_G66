import ExamPreStart from "@/components/examination/ExamPreStart";
import ExamStepper from "@/components/examination/ExamStepper";
import PatientCard from "@/components/examination/PatientCard";

const CALLED_STATUS = { label: "Đã gọi · chờ vào phòng", tone: "warning" };

// Exam page once a patient is called in but the exam has not started: process still locked, the patient card
// and what reception recorded. item: the queue item; record: the patient's exam record.
const CalledExamView = ({ item, record }) => (
    <>
        <ExamStepper locked />
        <PatientCard patient={{ ...record.patient, queueNumber: item.queueNumber }} status={CALLED_STATUS} services={record.services} />
        <ExamPreStart intake={{ ...record.intake, allergies: record.history.allergies, conditions: record.history.conditions }} />
    </>
);

export default CalledExamView;

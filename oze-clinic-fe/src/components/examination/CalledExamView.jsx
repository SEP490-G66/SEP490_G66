import StepBlockedCard from "./StepBlockedCard";

// Exam step once a patient is called in but the exam has not started (Figma "chưa bắt đầu khám").
// item: the queue item; onStart starts the exam.
const CalledExamView = ({ item, busy = false, onStart }) => (
    <StepBlockedCard
        title="Chưa bắt đầu khám"
        text={`Đã gọi số ${item.queueNumber} · ${item.patientName}. Bấm “Bắt đầu khám” khi bệnh nhân vào phòng.`}
        action={
            <button type="button" className="btn btn-primary" disabled={busy} onClick={onStart}>
                {busy && <span className="btn-spinner" aria-hidden="true" />}
                Bắt đầu khám
            </button>
        }
    />
);

export default CalledExamView;

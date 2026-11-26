import { Users } from "lucide-react";
import DashboardSection from "@/components/dashboard/DashboardSection";
import PersonCell from "@/components/ui/PersonCell";
import { ROUTES } from "@/utils/routes";

const TITLE_ID = "doctor-dashboard-queue";
const SKELETON_ROWS = 4;

// "Có hẹn 08:30 · Đang đi chụp X-quang" / "Vãng lai"
const visitNote = (patient) =>
    [patient.appointmentTime ? `Có hẹn ${patient.appointmentTime}` : "Vãng lai", patient.atImaging && "Đang đi chụp X-quang"].filter(Boolean).join(" · ");

// Doctor dashboard "Hàng chờ khám": the patients waiting in the doctor's room.
// queue: [{ id, queueNumber, patientName, appointmentTime?, atImaging, reason, waitedMinutes }].
const DoctorQueueSection = ({ queue, roomName, loading }) => (
    <DashboardSection
        id={TITLE_ID}
        title={`Hàng chờ khám · ${roomName ?? "Phòng khám"}`}
        busy={loading}
        link={!loading && queue.length > 0 && { to: ROUTES.DOCTOR_EXAMINATION, label: "Xem tất cả" }}
        empty={!loading && queue.length === 0 && { icon: Users, text: "Hàng chờ đang trống." }}
    >
        {loading && (
            <div aria-hidden="true" className="flex flex-col gap-3">
                {Array.from({ length: SKELETON_ROWS }, (_, index) => (
                    <div key={index} className="skeleton h-10" />
                ))}
            </div>
        )}
        {!loading && queue.length > 0 && (
            // Narrow (phone, or the column beside the tasks): one block per patient; wide: the table.
            <div className="@container -m-6">
                <ul className="divide-y divide-border @xl:hidden" aria-labelledby={TITLE_ID}>
                    {queue.map((patient) => (
                        <li key={patient.id} className="flex items-start gap-3 px-5 py-3.5">
                            <span className="num grid size-9 shrink-0 place-items-center rounded-md bg-surface-muted font-semibold text-ink">
                                <span className="sr-only">Số </span>
                                {patient.queueNumber}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="min-w-0 text-label font-semibold text-ink">{patient.patientName}</p>
                                    <span className="num shrink-0 text-caption text-muted">Chờ {patient.waitedMinutes} ph</span>
                                </div>
                                <p className="text-caption text-muted">{visitNote(patient)}</p>
                                <p className="mt-1 text-caption text-body">{patient.reason}</p>
                            </div>
                        </li>
                    ))}
                </ul>
                <div className="table-wrap hidden rounded-t-none rounded-b-lg border-0 @xl:block">
                    <table className="table" aria-labelledby={TITLE_ID}>
                        <thead>
                            <tr>
                                <th scope="col">STT</th>
                                <th scope="col">Bệnh nhân</th>
                                <th scope="col">Dịch vụ</th>
                                <th scope="col">Chờ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {queue.map((patient) => (
                                <tr key={patient.id}>
                                    <td className="cell-primary num">{patient.queueNumber}</td>
                                    <td className="min-w-52">
                                        <PersonCell name={patient.patientName} detail={visitNote(patient)} />
                                    </td>
                                    <td className="min-w-48">{patient.reason}</td>
                                    <td className="num whitespace-nowrap">{patient.waitedMinutes} ph</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </DashboardSection>
);

export default DoctorQueueSection;

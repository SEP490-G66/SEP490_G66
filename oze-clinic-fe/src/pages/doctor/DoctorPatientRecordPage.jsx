import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import AddendumDialog from "@/components/examination/AddendumDialog";
import MedicalHistoryCard from "@/components/examination/MedicalHistoryCard";
import PatientInfoCard from "@/components/examination/PatientInfoCard";
import PreviousVisitsCard from "@/components/examination/PreviousVisitsCard";
import ActivePlanCard from "@/components/medicalRecord/ActivePlanCard";
import PageHeader from "@/components/ui/PageHeader";
import useAsync from "@/hooks/useAsync";
import useSession from "@/hooks/useSession";
import { addVisitAddendum, getDoctorPatientRecord } from "@/services/doctorPatientService";
import { GENDER_LABELS, GENERIC_ERROR_MESSAGE } from "@/utils/messages";
import { DOCTOR_PATIENTS_LIST_ROUTE, ROUTES } from "@/utils/routes";

// The list itself, even while a patient is being examined (the plain route would open this record again)
const BACK = { to: DOCTOR_PATIENTS_LIST_ROUTE, label: "Hồ sơ bệnh án" };

// The patient is in the doctor's room today: being examined, or called / waiting
const ROOM_BADGE = {
    IN_PROGRESS: { label: "Đang khám", badge: "badge-info" },
    CALLED: { label: "Đã gọi", badge: "badge-warning" },
    WAITING: { label: "Trong hàng chờ", badge: "badge-neutral" },
};

// One patient's "Hồ sơ bệnh án" (read only): administrative info, medical history, plans in progress and previous visits.
// The medical history is completed during a visit (step "Lập hồ sơ bệnh án"), so it is not edited here.
// "Bổ sung" adds a note to one of the doctor's own locked visits.
const DoctorPatientRecordPage = () => {
    const { patientId } = useParams();
    const { userName } = useSession();
    const [version, setVersion] = useState(0);
    const { loading, value: result } = useAsync(() => getDoctorPatientRecord(Number(patientId)), [patientId, version]);
    const [addendumVisit, setAddendumVisit] = useState(null);
    const [saving, setSaving] = useState(false);

    if (loading || !result) {
        return (
            <>
                <PageHeader back={BACK} title="Hồ sơ bệnh án" crumb="Đang tải" />
                <div aria-busy="true" className="skeleton h-96" />
            </>
        );
    }

    if (!result.success) {
        return (
            <>
                <PageHeader back={BACK} title="Hồ sơ bệnh án" crumb="Không xem được" />
                <div role="alert" className="alert alert-danger flex-wrap items-center justify-between">
                    <span>{result.message || GENERIC_ERROR_MESSAGE}</span>
                    <button type="button" className="btn btn-secondary" onClick={() => setVersion((current) => current + 1)}>
                        Thử lại
                    </button>
                </div>
            </>
        );
    }

    const { patient, lastVisit, history, plans, visits, roomEntry } = result.data;
    const roomBadge = roomEntry && ROOM_BADGE[roomEntry.status];
    const description = [patient.code, GENDER_LABELS[patient.gender], patient.age != null && `${patient.age} tuổi`, lastVisit && `Lần khám gần nhất ${lastVisit}`]
        .filter(Boolean)
        .join(" · ");

    const saveAddendum = async (content) => {
        setSaving(true);
        const response = await addVisitAddendum(addendumVisit.id, content);
        setSaving(false);
        if (!response.success) {
            toast.error(response.message || GENERIC_ERROR_MESSAGE);
            return;
        }
        toast.success(response.message);
        setAddendumVisit(null);
    };

    return (
        <>
            <PageHeader
                back={BACK}
                title={patient.name}
                description={description}
                badge={roomBadge && <span className={`badge ${roomBadge.badge}`}>{roomBadge.label}</span>}
                actions={
                    roomEntry?.status === "IN_PROGRESS" && (
                        <Link to={ROUTES.DOCTOR_EXAMINATION} className="btn btn-primary">
                            Mở lượt khám
                        </Link>
                    )
                }
            />
            <div className="flex flex-col gap-5">
                <PatientInfoCard patient={patient} reason={roomEntry?.reason} />
                {/* Shown as the record has it; changes are made during a visit */}
                <MedicalHistoryCard history={history} gender={patient.gender} readOnly />
                <ActivePlanCard plans={plans} />
                <PreviousVisitsCard
                    visits={visits}
                    canAddendum={(visit) => visit.locked && Boolean(userName) && visit.doctor === userName}
                    onAddendum={setAddendumVisit}
                />
            </div>
            {addendumVisit && <AddendumDialog visit={addendumVisit} busy={saving} onSubmit={saveAddendum} onClose={() => setAddendumVisit(null)} />}
        </>
    );
};

export default DoctorPatientRecordPage;

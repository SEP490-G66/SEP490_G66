import { useParams } from "react-router-dom";
import DashboardSection from "@/components/dashboard/DashboardSection";
import ImagingPanel from "@/components/medicalRecord/ImagingPanel";
import { DiagnosisTable, PrescriptionTable, TreatmentDoneTable } from "@/components/medicalRecord/VisitDetailTables";
import VisitInfoCard from "@/components/medicalRecord/VisitInfoCard";
import { NextStepCard, VisitPaymentsCard } from "@/components/medicalRecord/VisitSideCards";
import PageHeader from "@/components/ui/PageHeader";
import PageLoadState from "@/components/ui/PageLoadState";
import useMedicalBook from "@/hooks/useMedicalBook";
import { parseRecordId } from "@/utils/medicalRecord";
import { ROUTES } from "@/utils/routes";

const BACK = { to: ROUTES.MEDICAL_RECORD, label: "Lịch sử khám" };

const historyText = (history, key) =>
    (history.find((group) => group.key === key)?.items ?? [])
        .map((item) => [item.title, item.text].filter(Boolean).join(": "))
        .filter(Boolean)
        .join("; ");

const usageText = (item) => [[item.dosage, item.frequency].filter(Boolean).join(" · "), item.duration, item.instructions].filter(Boolean).join(", ");

// Plan stage still to do, else the follow-up the doctor set at this visit.
const getNextStep = (visit, plans) => {
    const plan = plans.find((item) => item.id === visit.plan);
    const stage = plan?.stages.find((item) => item.status === "next");
    if (plan && stage) return { title: `Buổi ${stage.number} · ${stage.name}`, line: plan.variant, planId: plan.id };
    if (visit.next.text) return { title: "Hẹn tái khám", line: visit.next.text, planId: plan?.id ?? null };
    return null;
};

// "Chi tiết lần khám" (Figma): visit info, diagnoses, treatment done, prescription; next step, invoices and films on the side.
// TODO(api): ICD code, tooth and result per line are not returned yet, so those columns stay hidden.
const VisitDetail = () => {
    const { examinationId } = useParams();
    const book = useMedicalBook();
    const id = parseRecordId(examinationId);
    const visit = book.data?.visits.find((item) => item.id === id) ?? null;

    if (book.status !== "ready" || !visit) {
        return (
            <>
                <PageHeader title="Chi tiết lần khám" back={BACK} />
                <PageLoadState status={book.status} onRetry={book.reload} />
                {book.status === "ready" && <div className="card-app empty-state py-16">Không tìm thấy lần khám này.</div>}
            </>
        );
    }

    const { history, plans, films } = book.data;
    const nextStep = getNextStep(visit, plans);
    const visitFilms = films.filter((film) => film.visit === visit.id);

    return (
        <>
            <PageHeader title={`Lần khám ${visit.date}`} crumb={`Lần khám ${visit.date}`} description={visit.service} back={BACK} />
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="flex min-w-0 flex-col gap-5">
                    <VisitInfoCard
                        visit={{
                            date: visit.isoDate,
                            doctorName: visit.doctor,
                            serviceName: visit.service,
                            history: historyText(history, "dental"),
                            conditions: historyText(history, "disease"),
                            allergies: historyText(history, "allergy"),
                        }}
                    />
                    <DiagnosisTable diagnoses={visit.diag ? visit.diag.split("; ").map((description) => ({ description })) : []} />
                    <TreatmentDoneTable procedures={visit.done.map((content) => ({ content }))} />
                    <PrescriptionTable
                        prescriptions={visit.prescriptions.flatMap((prescription) => prescription.items.map((item) => ({ name: item.medicationName ?? "", usage: usageText(item), quantity: item.quantity ?? "" })))}
                    />
                </div>
                <div className="flex min-w-0 flex-col gap-5">
                    {nextStep && <NextStepCard next={nextStep} />}
                    <VisitPaymentsCard invoices={visit.invoices} />
                    {visitFilms.length > 0 && (
                        <DashboardSection id="visit-films-title" title="Phim chụp">
                            <ImagingPanel films={visitFilms} />
                        </DashboardSection>
                    )}
                </div>
            </div>
        </>
    );
};

export default VisitDetail;

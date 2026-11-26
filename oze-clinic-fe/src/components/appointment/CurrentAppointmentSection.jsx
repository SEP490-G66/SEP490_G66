import { CalendarDays, Phone, X } from "lucide-react";
import NextVisitCard from "@/components/dashboard/NextVisitCard";
import DashboardSection from "@/components/dashboard/DashboardSection";
import Notice from "@/components/ui/Notice";
import { CLINIC_HOTLINE } from "@/utils/messages";

const TITLE_ID = "current-appointment-title";

// "Lịch hẹn hiện tại" (Figma: Lịch hẹn sắp tới). A pending self-booked appointment can still be changed here
// (canChange): Đổi lịch / Huỷ lịch. Once confirmed the patient calls the front desk instead.
// notice: { tone: "warning" | "success" | "neutral", content } shown under the card.
// children: shown between the card and the notice (the plan progress when the visit is a plan session).
const CurrentAppointmentSection = ({ appointment, source, canChange, notice, onReschedule, onCancel, children }) => {
    const actions = canChange ? (
        <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary min-h-11 md:min-h-0" onClick={onReschedule}>
                <CalendarDays className="size-4" aria-hidden="true" />
                Đổi lịch
            </button>
            <button type="button" className="btn btn-secondary min-h-11 text-danger md:min-h-0" onClick={onCancel}>
                <X className="size-4" aria-hidden="true" />
                Huỷ lịch
            </button>
        </div>
    ) : (
        <a href={`tel:${CLINIC_HOTLINE.TEL}`} className="btn btn-secondary min-h-11 md:min-h-0">
            <Phone className="size-4" aria-hidden="true" />
            Liên hệ lễ tân để đổi / huỷ
            <span className="sr-only"> qua số {CLINIC_HOTLINE.DISPLAY}</span>
        </a>
    );

    return (
        <DashboardSection id={TITLE_ID} title="Lịch hẹn hiện tại" badge={actions}>
            <NextVisitCard appointment={appointment} source={source} showDetailLink={false} showDetails={false} />
            {children}
            {notice && <Notice tone={notice.tone}>{notice.content}</Notice>}
        </DashboardSection>
    );
};

export default CurrentAppointmentSection;

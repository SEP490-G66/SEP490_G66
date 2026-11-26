import { useState } from "react";
import { CalendarDays, CircleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import AppointmentInfoCard from "@/components/appointment/AppointmentInfoCard";
import CancelAppointmentModal from "@/components/appointment/CancelAppointmentModal";
import CurrentAppointmentSection from "@/components/appointment/CurrentAppointmentSection";
import PlanProgressSteps from "@/components/appointment/PlanProgressSteps";
import PlanSessionSection from "@/components/appointment/PlanSessionSection";
import RescheduleAppointmentModal from "@/components/appointment/RescheduleAppointmentModal";
import UpcomingVisitsSection from "@/components/appointment/UpcomingVisitsSection";
import { Hotline } from "@/components/booking/BookingSchedule";
import BookingStateBox from "@/components/booking/BookingStateBox";
import PageHeader from "@/components/ui/PageHeader";
import useAsync from "@/hooks/useAsync";
import { getMyAppointments } from "@/services/appointmentService";
import { getMyTreatmentPlans } from "@/services/medicalBookService";
import { APPOINTMENT_STATUS, BOOKING_ERROR_CODE, BOOKING_TEXT, GENERIC_ERROR_MESSAGE } from "@/utils/messages";
import { ROUTES, getAppointmentDetailRoute, getTreatmentPlanRoute } from "@/utils/routes";
import { buildUpcomingVisits, findAppointmentSession, findNextSession } from "@/utils/upcomingVisits";

const TITLE_ID = "my-appointments-title";
const MODAL = { CANCEL: "cancel", RESCHEDULE: "reschedule" };

// A patient has at most one unfinished appointment (backend rule), so the page shows that one, plus the
// sessions still ahead in the treatment plans (utils/upcomingVisits).
const UNFINISHED_STATUSES = [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_SERVICE];

const startOf = (appointment) => `${String(appointment.appointmentDate ?? "").slice(0, 10)} ${appointment.timeSlotStart ?? ""}`;

const toResource = ({ loading, error, value }) => {
    const unlinked = !loading && !error && value?.code === BOOKING_ERROR_CODE.PROFILE_NOT_FOUND;
    const failed = !loading && !unlinked && (Boolean(error) || value?.success === false || !Array.isArray(value?.data));
    const list = !loading && !failed && !unlinked ? value.data : [];
    const current = list.filter((item) => UNFINISHED_STATUSES.includes(item.status)).sort((a, b) => startOf(a).localeCompare(startOf(b)))[0] ?? null;
    return { loading, failed, unlinked, current };
};

// Plans are extra context: if they fail to load the page still shows the appointment.
const toPlans = ({ loading, value }) => (!loading && value?.success && Array.isArray(value.data) ? value.data : []);

const getNotice = (appointment) => {
    switch (appointment.status) {
        case APPOINTMENT_STATUS.PENDING:
            return {
                tone: "warning",
                content: (
                    <>
                        Lễ tân sẽ <strong>gọi điện cho bạn</strong> để xác nhận và tư vấn trước buổi khám. Bạn có thể đổi hoặc huỷ lịch trước khi lễ tân xác nhận.
                    </>
                ),
            };
        case APPOINTMENT_STATUS.CONFIRMED:
            return {
                tone: "success",
                content: (
                    <>
                        Lịch hẹn <strong>đã được xác nhận</strong>. Để đổi hoặc huỷ, vui lòng liên hệ lễ tân.
                    </>
                ),
            };
        default:
            return {
                tone: "neutral",
                content: (
                    <>
                        Bạn đã báo có mặt tại quầy.{" "}
                        <Link to={getAppointmentDetailRoute(appointment.id)} className="font-semibold text-primary hover:underline">
                            Xem số thứ tự và phòng khám
                        </Link>
                    </>
                ),
            };
    }
};

const sourceOf = (appointment, session) => {
    if (session) return `Buổi ${session.index + 1}/${session.total} · ${session.plan.planName}`;
    // The plans did not load: the appointment still says which session it is
    const booked = appointment.planSession;
    if (booked) return `Buổi ${booked.stageNumber}/${booked.totalStages} · ${booked.planName ?? "Kế hoạch điều trị"}`;
    return appointment.parentAppointmentId != null ? "Tái khám" : null;
};

const MyAppointments = () => {
    const [version, setVersion] = useState(0);
    const [modal, setModal] = useState(null);
    const resource = toResource(useAsync(getMyAppointments, [version]));
    const plans = toPlans(useAsync(getMyTreatmentPlans, [version]));
    const { current } = resource;
    const ready = !resource.loading && !resource.failed && !resource.unlinked;
    const session = findAppointmentSession(current, plans);
    const nextSession = current ? null : findNextSession(plans);
    const visits = buildUpcomingVisits(current, plans);
    const hasPlanVisits = visits.some((row) => row.stage);

    const reload = () => {
        setModal(null);
        setVersion((value) => value + 1);
    };

    const closeModal = ({ refetch }) => (refetch ? reload() : setModal(null));

    return (
        <>
            <PageHeader id={TITLE_ID} title="Lịch hẹn sắp tới" description="Lần tới bạn đến phòng khám: lịch tự đặt, lễ tân đặt hộ, tái khám và các buổi của kế hoạch điều trị." />
            {resource.loading && (
                <div aria-busy="true" className="flex flex-col gap-5">
                    <div className="skeleton h-56" />
                    <div className="skeleton h-72" />
                </div>
            )}
            {resource.unlinked && (
                <section className="card-app">
                    <BookingStateBox tone="warning" icon={CircleAlert} title={BOOKING_TEXT.UNLINKED_TITLE} headingLevel={2}>
                        Vui lòng gọi <Hotline /> để lễ tân gắn hồ sơ.
                    </BookingStateBox>
                </section>
            )}
            {resource.failed && (
                <div role="alert" className="alert alert-danger">
                    {GENERIC_ERROR_MESSAGE}
                </div>
            )}
            {ready && !current && !nextSession && (
                <div className="card-app empty-state py-24">
                    <span aria-hidden="true" className="mb-3 flex size-14 items-center justify-center rounded-full bg-surface-tint text-muted">
                        <CalendarDays className="size-6" />
                    </span>
                    <p className="empty-state-title">Bạn chưa có lịch hẹn sắp tới.</p>
                    <Link to={ROUTES.BOOK_APPOINTMENT} className="btn btn-primary mt-4 min-h-11 md:min-h-0">
                        Đặt lịch khám
                    </Link>
                </div>
            )}
            {ready && (current || nextSession) && (
                <div className="flex flex-col gap-5">
                    {current && (
                        <>
                            <CurrentAppointmentSection
                                appointment={current}
                                source={sourceOf(current, session)}
                                canChange={current.status === APPOINTMENT_STATUS.PENDING}
                                notice={getNotice(current)}
                                onReschedule={() => setModal(MODAL.RESCHEDULE)}
                                onCancel={() => setModal(MODAL.CANCEL)}
                            >
                                {session && (
                                    <div className="flex flex-col gap-2">
                                        <p className="text-label font-semibold text-ink">Tiến độ kế hoạch</p>
                                        <PlanProgressSteps
                                            stages={session.plan.stages.filter((stage) => stage.stageStatus !== "Cancelled").sort((a, b) => a.stageNumber - b.stageNumber)}
                                            currentNumber={session.stage.stageNumber}
                                        />
                                        <p className="text-body-sm text-body">
                                            Buổi này: <strong className="font-semibold text-ink">{session.stage.stageName || "Buổi điều trị"}</strong>.{" "}
                                            <Link to={getTreatmentPlanRoute(session.plan.treatmentPlanId)} className="font-semibold text-primary hover:underline">
                                                Xem kế hoạch điều trị
                                            </Link>
                                        </p>
                                    </div>
                                )}
                            </CurrentAppointmentSection>
                            <AppointmentInfoCard appointment={current} kind={current.planSession ? "Buổi điều trị theo kế hoạch" : null} note={current.notes} bookedAt={current.createdAt} />
                        </>
                    )}
                    {nextSession && <PlanSessionSection session={nextSession} />}
                    {hasPlanVisits && <UpcomingVisitsSection rows={visits} />}
                </div>
            )}
            {current && modal === MODAL.CANCEL && <CancelAppointmentModal appointment={current} onClose={closeModal} onCancelled={reload} onNotFound={reload} />}
            {current && modal === MODAL.RESCHEDULE && <RescheduleAppointmentModal appointment={current} onClose={closeModal} onRescheduled={reload} onNotFound={reload} />}
        </>
    );
};

export default MyAppointments;

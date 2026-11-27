import { useState } from "react";
import { CalendarClock, CalendarDays, CalendarX2, CircleAlert, Phone } from "lucide-react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import AppointmentInfoCard from "@/components/appointment/AppointmentInfoCard";
import CancelAppointmentModal from "@/components/appointment/CancelAppointmentModal";
import ChangeRequestModal from "@/components/appointment/ChangeRequestModal";
import CurrentAppointmentSection from "@/components/appointment/CurrentAppointmentSection";
import PlanProgressSteps from "@/components/appointment/PlanProgressSteps";
import PlanSessionSection from "@/components/appointment/PlanSessionSection";
import RescheduleAppointmentModal from "@/components/appointment/RescheduleAppointmentModal";
import UpcomingVisitsSection from "@/components/appointment/UpcomingVisitsSection";
import { Hotline } from "@/components/booking/BookingSchedule";
import BookingStateBox from "@/components/booking/BookingStateBox";
import PageHeader from "@/components/ui/PageHeader";
import useAsync from "@/hooks/useAsync";
import { CHANGE_REQUEST_STATUS, CHANGE_REQUEST_TYPE, getMyChangeRequests, withdrawChangeRequest } from "@/services/appointmentChangeRequestService";
import { getMyAppointments } from "@/services/appointmentService";
import { getMyTreatmentPlans } from "@/services/medicalBookService";
import { formatDate, formatTimeRange, formatWeekday } from "@/utils/format";
import { APPOINTMENT_STATUS, BOOKING_ERROR_CODE, BOOKING_TEXT, CLINIC_HOTLINE, GENERIC_ERROR_MESSAGE } from "@/utils/messages";
import { ROUTES, getAppointmentDetailRoute, getTreatmentPlanRoute } from "@/utils/routes";
import { buildUpcomingVisits, findAppointmentSession, findNextSession, visitDoctor, visitSource, visitTitle } from "@/utils/upcomingVisits";

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

// The patient's pending change requests, keyed by the visit they are about
const toRequests = ({ loading, value }) => {
    const list = !loading && value?.success && Array.isArray(value.data) ? value.data : [];
    return Object.fromEntries(
        list
            .filter((request) => request.status === CHANGE_REQUEST_STATUS.PENDING)
            .map((request) => [request.appointmentId ? `appt-${request.appointmentId}` : `stage-${request.treatmentPlanStageId}`, request]),
    );
};

// What the request dialog shows about a visit (a row of buildUpcomingVisits)
const visitOfRow = (row) => ({
    title: visitTitle(row),
    dateText: row.date ? `${formatWeekday(row.date)}, ${formatDate(row.date)}` : "Chưa có ngày",
    timeText: row.appointment ? formatTimeRange(row.appointment.timeSlotStart, row.appointment.timeSlotEnd) : "Chờ chốt giờ",
    doctorName: visitDoctor(row),
    sourceText: [visitSource(row), row.plan?.planName].filter(Boolean).join(" · "),
    appointmentId: row.appointment?.id ?? null,
    treatmentPlanStageId: row.appointment ? null : row.stage?.stageId,
    isSession: Boolean(row.stage || row.appointment?.planSession),
});

// A visit the clinic arranged: the patient asks the front desk instead of changing it
const clinicNotice = (appointment, request) =>
    request
        ? {
              tone: "neutral",
              content: (
                  <>
                      <strong>Đã gửi yêu cầu {request.type === CHANGE_REQUEST_TYPE.CANCEL ? "huỷ" : "đổi lịch"}</strong> lúc {formatDate(request.createdAt)}
                      {request.preferredTimes?.length > 0 && ` (mong muốn: ${request.preferredTimes.join(", ")})`}. Lễ tân sẽ gọi cho bạn; lịch{" "}
                      <strong>vẫn giữ nguyên</strong> đến khi lễ tân xác nhận.
                  </>
              ),
          }
        : {
              tone: "warning",
              content: (
                  <>
                      {appointment.planSession ? "Buổi điều trị" : "Lịch này"} do <strong>bác sĩ và lễ tân sắp xếp</strong> nên bạn không tự đổi được. Nếu bận, bấm{" "}
                      <strong>Xin đổi lịch</strong>, lễ tân sẽ gọi lại để chọn giờ khác.
                  </>
              ),
          };

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
                        Lịch hẹn <strong>đã được xác nhận</strong>. Bạn tự đặt lịch này nên vẫn có thể đổi hoặc huỷ trước giờ hẹn.
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
    const requests = toRequests(useAsync(getMyChangeRequests, [version]));
    const [asking, setAsking] = useState(null);
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

    const own = current?.bookedByPatient === true;
    const currentRequest = current ? requests[`appt-${current.id}`] : null;
    const currentVisit = current && {
        ...visitOfRow({ appointment: current, date: String(current.appointmentDate ?? "").slice(0, 10), state: "appointment" }),
        title: session ? session.stage.stageName || current.serviceName : current.serviceName,
        sourceText: sourceOf(current, session) ?? "Lễ tân đặt hộ",
    };

    const withdraw = async (request) => {
        const response = await withdrawChangeRequest(request.id);
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        toast.success(response.message);
        reload();
    };

    const askActions = currentRequest ? (
        <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary min-h-11 md:min-h-0" onClick={() => withdraw(currentRequest)}>
                Rút yêu cầu
            </button>
            <a href={`tel:${CLINIC_HOTLINE.TEL}`} className="btn btn-primary min-h-11 md:min-h-0">
                <Phone className="size-4" aria-hidden="true" />
                Gọi lễ tân
            </a>
        </div>
    ) : (
        <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary min-h-11 md:min-h-0" onClick={() => setAsking({ visit: currentVisit, type: CHANGE_REQUEST_TYPE.RESCHEDULE })}>
                <CalendarClock className="size-4" aria-hidden="true" />
                Xin đổi lịch
            </button>
            <button type="button" className="btn btn-secondary min-h-11 text-danger md:min-h-0" onClick={() => setAsking({ visit: currentVisit, type: CHANGE_REQUEST_TYPE.CANCEL })}>
                <CalendarX2 className="size-4" aria-hidden="true" />
                Xin huỷ
            </button>
        </div>
    );

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
                                canChange={own && [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED].includes(current.status)}
                                actions={!own && [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED].includes(current.status) ? askActions : undefined}
                                notice={own || ![APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED].includes(current.status) ? getNotice(current) : clinicNotice(current, currentRequest)}
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
                    {hasPlanVisits && (
                        <UpcomingVisitsSection
                            rows={visits}
                            requests={requests}
                            onRequest={(row) => setAsking({ visit: visitOfRow(row), type: CHANGE_REQUEST_TYPE.RESCHEDULE })}
                            onWithdraw={withdraw}
                        />
                    )}
                </div>
            )}
            {current && modal === MODAL.CANCEL && <CancelAppointmentModal appointment={current} onClose={closeModal} onCancelled={reload} onNotFound={reload} />}
            {asking && (
                <ChangeRequestModal
                    visit={asking.visit}
                    type={asking.type}
                    onSent={() => {
                        setAsking(null);
                        reload();
                    }}
                    onClose={() => setAsking(null)}
                />
            )}
            {current && modal === MODAL.RESCHEDULE && <RescheduleAppointmentModal appointment={current} onClose={closeModal} onRescheduled={reload} onNotFound={reload} />}
        </>
    );
};

export default MyAppointments;

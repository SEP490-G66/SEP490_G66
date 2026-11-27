import { Fragment, useState } from "react";
import { ArrowUp, CalendarClock, Clock3, Hourglass } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardSection from "@/components/dashboard/DashboardSection";
import ListFooter from "@/components/ui/ListFooter";
import SegmentedControl from "@/components/ui/SegmentedControl";
import StatusBadge from "@/components/ui/StatusBadge";
import usePagedList from "@/hooks/usePagedList";
import { cx } from "@/utils/cx";
import { formatDate, formatMonthShort, formatTimeRange, formatWeekday, parseDateOnly } from "@/utils/format";
import { PATIENT_APPOINTMENT_STATUS } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import { isBookedVisit, isOwnVisit, visitDoctor, visitSource, visitTitle } from "@/utils/upcomingVisits";

const TITLE_ID = "upcoming-visits-title";
const PAGE_SIZE = 4;
const FILTER = { ALL: "all", OWN: "own", CLINIC: "clinic" };

const monthOf = (date) => {
    const parsed = parseDateOnly(date);
    return parsed ? `Tháng ${parsed.getMonth() + 1}, ${parsed.getFullYear()}` : "Chưa có ngày";
};

const PLANNED_STATUS = { label: "Chờ chốt giờ", badge: "badge-warning" };

const DateTile = ({ date, dashed }) => {
    const parsed = parseDateOnly(date);
    return (
        <div aria-hidden="true" className={cx("flex w-16 shrink-0 flex-col items-center rounded-lg border bg-canvas py-1.5", dashed ? "border-dashed border-border-strong" : "border-border")}>
            {parsed ? (
                <>
                    <span className="text-caption text-muted">{formatMonthShort(date)}</span>
                    <span className="num font-heading text-heading-3 leading-tight text-ink">{String(parsed.getDate()).padStart(2, "0")}</span>
                    <span className="text-caption text-muted">{formatWeekday(date)}</span>
                </>
            ) : (
                <span className="px-1 py-2 text-center text-caption text-muted">Chưa có ngày</span>
            )}
        </div>
    );
};

const VisitRow = ({ row, request, onRequest, onWithdraw }) => {
    const booked = isBookedVisit(row);
    const own = isOwnVisit(row);
    const time = row.appointment ? formatTimeRange(row.appointment.timeSlotStart, row.appointment.timeSlotEnd) : "";
    const canAsk = !own && !row.current && !request;

    return (
        <li
            aria-current={row.current ? "true" : undefined}
            className={cx(
                "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
                booked ? "border-border bg-canvas" : "border-dashed border-border-strong bg-surface-tint/50",
                row.current && "border-primary/40 bg-primary-softer",
            )}
        >
            <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                <DateTile date={row.date} dashed={!booked} />
                <div className="min-w-0 flex-1">
                    <span
                        className={cx(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide",
                            booked ? "bg-primary text-on-primary" : "border border-dashed border-border-strong text-muted",
                        )}
                    >
                        {booked ? <CalendarClock className="size-3" aria-hidden="true" /> : <Hourglass className="size-3" aria-hidden="true" />}
                        {booked ? "LỊCH HẸN" : "BUỔI DỰ KIẾN"}
                    </span>
                    <p className="mt-1 font-semibold text-ink">{visitTitle(row)}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-body">
                        {booked ? (
                            <span className="num inline-flex items-center gap-1 font-semibold text-ink">
                                <Clock3 className="size-3.5 text-muted" aria-hidden="true" />
                                {time || "Chưa có giờ"}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-warning">
                                <Clock3 className="size-3.5" aria-hidden="true" />
                                Chờ chốt giờ
                            </span>
                        )}
                        {visitDoctor(row) && <span className="text-muted">· {visitDoctor(row)}</span>}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={cx("rounded-md px-2 py-0.5 text-caption font-semibold", own ? "bg-success-soft text-success" : "bg-surface-muted text-ink")}>{visitSource(row)}</span>
                        {row.stage && <span className="text-caption text-muted">{row.plan.planName}</span>}
                        {row.current && (
                            <span className="inline-flex items-center gap-1 text-caption font-semibold text-primary">
                                <ArrowUp className="size-3.5" aria-hidden="true" />
                                Đang xem ở &quot;Lịch hẹn hiện tại&quot;
                            </span>
                        )}
                    </div>
                    {request && (
                        <div className="mt-3 rounded-lg border border-primary/30 bg-canvas px-3 py-2 text-body-sm">
                            <p className="text-ink">
                                <strong>Đã gửi yêu cầu {request.type === "Cancel" ? "huỷ" : "đổi lịch"}</strong> lúc {formatDate(request.createdAt)}
                                {request.preferredTimes?.length > 0 && ` · mong muốn: ${request.preferredTimes.join(", ")}`}.
                            </p>
                            <p className="text-caption text-muted">
                                Lễ tân sẽ gọi lại; lịch giữ nguyên đến khi lễ tân xác nhận.{" "}
                                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => onWithdraw(request)}>
                                    Rút yêu cầu
                                </button>
                            </p>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                {request ? (
                    <span className="badge badge-info">Đang chờ lễ tân xử lý</span>
                ) : row.appointment ? (
                    <StatusBadge status={row.appointment.status} labels={PATIENT_APPOINTMENT_STATUS} />
                ) : (
                    <StatusBadge status="planned" labels={{ planned: PLANNED_STATUS }} />
                )}
                {canAsk && (
                    <button type="button" className="btn btn-secondary min-h-11 md:min-h-9" onClick={() => onRequest(row)}>
                        <CalendarClock className="size-4" aria-hidden="true" />
                        Xin đổi / huỷ
                    </button>
                )}
            </div>
        </li>
    );
};

// "Tất cả lần đến sắp tới": the appointment and every session still ahead in the plans being carried out, by date
// and grouped by month. rows: buildUpcomingVisits. requests: the patient's pending change requests keyed
// "appt-{id}" / "stage-{id}". onRequest(row): "Xin đổi / huỷ" on a visit the clinic arranged; onWithdraw(request).
const UpcomingVisitsSection = ({ rows, requests = {}, onRequest, onWithdraw }) => {
    const [filter, setFilter] = useState(FILTER.ALL);
    const own = rows.filter(isOwnVisit).length;
    const shown = rows.filter((row) => filter === FILTER.ALL || (filter === FILTER.OWN ? isOwnVisit(row) : !isOwnVisit(row)));
    const list = usePagedList(shown, { pageSize: PAGE_SIZE, resetKey: filter });
    const requestOf = (row) => (row.appointment ? requests[`appt-${row.appointment.id}`] : null) ?? (row.stage ? requests[`stage-${row.stage.stageId}`] : null) ?? null;
    const options = [
        { value: FILTER.ALL, label: `Tất cả (${rows.length})` },
        { value: FILTER.OWN, label: `Bạn đặt (${own})` },
        { value: FILTER.CLINIC, label: `Buổi điều trị & tái khám (${rows.length - own})` },
    ];

    return (
        <DashboardSection id={TITLE_ID} title="Tất cả lần đến sắp tới" badge={<SegmentedControl options={options} value={filter} onChange={setFilter} label="Lọc lần đến" />}>
            <div className="-mt-1 flex flex-wrap gap-x-5 gap-y-1 text-caption text-muted">
                <span className="inline-flex items-center gap-1.5">
                    <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-on-primary">LỊCH HẸN</span> đã có ngày và giờ
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="rounded border border-dashed border-border-strong px-1.5 py-0.5 text-[10px] font-bold">BUỔI DỰ KIẾN</span> mới có ngày, lễ tân sẽ gọi chốt giờ
                </span>
            </div>
            {list.rows.length === 0 ? (
                <p className="text-body-sm text-muted">Không có lần đến nào trong nhóm này.</p>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {list.rows.map((row, index) => {
                        const month = monthOf(row.date);
                        const showMonth = index === 0 || month !== monthOf(list.rows[index - 1].date);
                        return (
                            <Fragment key={row.key}>
                                {showMonth && <li className={cx("text-caption font-semibold text-muted", index > 0 && "pt-2")}>{month}</li>}
                                <VisitRow row={row} request={requestOf(row)} onRequest={onRequest} onWithdraw={onWithdraw} />
                            </Fragment>
                        );
                    })}
                </ul>
            )}
            {shown.length > PAGE_SIZE && (
                <div className="border-t border-border pt-3 text-body-sm text-muted">
                    <ListFooter list={list} label="Phân trang lần đến" />
                </div>
            )}
            <p className="rounded-lg bg-surface-tint px-4 py-3 text-body-sm text-body">
                Buổi điều trị và tái khám do <strong className="text-ink">bác sĩ và lễ tân sắp xếp</strong>. Nếu bận, bấm <strong className="text-ink">Xin đổi / huỷ</strong> ở
                dòng đó, lễ tân sẽ gọi lại.{" "}
                <Link to={ROUTES.TREATMENT_PLANS} className="font-semibold text-primary hover:underline">
                    Xem kế hoạch điều trị
                </Link>
            </p>
        </DashboardSection>
    );
};

export default UpcomingVisitsSection;

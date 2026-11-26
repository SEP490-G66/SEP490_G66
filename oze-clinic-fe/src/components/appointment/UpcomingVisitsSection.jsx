import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import DashboardSection from "@/components/dashboard/DashboardSection";
import ListFooter from "@/components/ui/ListFooter";
import Notice from "@/components/ui/Notice";
import SegmentedControl from "@/components/ui/SegmentedControl";
import StatusBadge from "@/components/ui/StatusBadge";
import usePagedList from "@/hooks/usePagedList";
import { cx } from "@/utils/cx";
import { formatMonthShort, formatTimeRange, formatWeekday, parseDateOnly } from "@/utils/format";
import { PATIENT_APPOINTMENT_STATUS } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import { VISIT_STATE } from "@/utils/upcomingVisits";

const TITLE_ID = "upcoming-visits-title";
const PAGE_SIZE = 3;
const FILTER = { ALL: "all", BOOKED: "booked", PLAN: "plan" };

const STATE_BADGE = {
    [VISIT_STATE.BOOKED]: { label: "Đã có lịch hẹn", badge: "badge-success" },
    [VISIT_STATE.WAITING]: { label: "Chờ lễ tân chốt giờ", badge: "badge-warning" },
    [VISIT_STATE.PLANNED]: { label: "Dự kiến", badge: "badge-neutral" },
};

const isBooked = (row) => row.state === VISIT_STATE.APPOINTMENT || row.state === VISIT_STATE.BOOKED;

const matches = (filter) => (row) => filter === FILTER.ALL || (filter === FILTER.BOOKED ? isBooked(row) : row.state !== VISIT_STATE.APPOINTMENT);

const monthOf = (date) => {
    const parsed = parseDateOnly(date);
    return parsed ? `Tháng ${parsed.getMonth() + 1}, ${parsed.getFullYear()}` : "Chưa có ngày";
};

const VisitRow = ({ row, next }) => {
    const date = parseDateOnly(row.date);
    const title = row.stage ? `Buổi ${row.number} · ${row.stage.stageName || "Buổi điều trị"}` : row.appointment.serviceName;
    const who = row.stage ? row.plan.doctorName : row.appointment.doctorName;
    const time = row.appointment ? formatTimeRange(row.appointment.timeSlotStart, row.appointment.timeSlotEnd) : "";

    return (
        <li aria-current={next ? "true" : undefined} className={cx("grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-4 py-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto]", next && "-mx-6 bg-primary-softer px-6")}>
            <div aria-hidden="true" className="flex flex-col items-center rounded-md border border-border bg-canvas py-1.5">
                {date ? (
                    <>
                        <span className="text-caption text-muted">{formatMonthShort(row.date)}</span>
                        <span className="num font-heading text-heading-3 text-ink">{String(date.getDate()).padStart(2, "0")}</span>
                        <span className="text-caption text-muted">{formatWeekday(row.date)}</span>
                    </>
                ) : (
                    <span className="px-1 text-center text-caption text-muted">Chưa có ngày</span>
                )}
            </div>
            <div className="min-w-0">
                <p className="font-semibold text-ink">{title}</p>
                <p className="num text-body-sm text-body">{[who, time].filter(Boolean).join(" · ")}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className={cx("badge", row.stage ? "badge-neutral" : "badge-info")}>{row.stage ? `Buổi ${row.number}/${row.total} · ${row.plan.planName}` : "Lịch hẹn"}</span>
                    {next && <span className="badge badge-info">Lần tới</span>}
                </div>
            </div>
            <div className="col-start-2 flex flex-col items-start gap-1 sm:col-start-3 sm:items-end">
                {row.state === VISIT_STATE.APPOINTMENT ? <StatusBadge status={row.appointment.status} labels={PATIENT_APPOINTMENT_STATUS} /> : <StatusBadge status={row.state} labels={STATE_BADGE} />}
                {row.state === VISIT_STATE.PLANNED && <span className="text-caption text-muted">Ngày có thể đổi theo tiến độ</span>}
            </div>
        </li>
    );
};

// "Tất cả lần đến sắp tới": the appointment and every session still ahead in the plans being carried out,
// by date and grouped by month, 3 per page. rows: buildUpcomingVisits.
const UpcomingVisitsSection = ({ rows }) => {
    const [filter, setFilter] = useState(FILTER.ALL);
    const shown = rows.filter(matches(filter));
    const list = usePagedList(shown, { pageSize: PAGE_SIZE, resetKey: filter });
    const nextKey = rows[0]?.key;
    const options = [
        { value: FILTER.ALL, label: `Tất cả (${rows.length})` },
        { value: FILTER.BOOKED, label: "Đã có lịch hẹn" },
        { value: FILTER.PLAN, label: "Buổi điều trị" },
    ];

    return (
        <DashboardSection id={TITLE_ID} title="Tất cả lần đến sắp tới" badge={<SegmentedControl options={options} value={filter} onChange={setFilter} label="Lọc lần đến" />}>
            {list.rows.length === 0 ? (
                <p className="text-body-sm text-muted">Không có lần đến nào trong nhóm này.</p>
            ) : (
                <ul className="flex flex-col">
                    {list.rows.map((row, index) => {
                        const month = monthOf(row.date);
                        const showMonth = index === 0 || month !== monthOf(list.rows[index - 1].date);
                        return (
                            <Fragment key={row.key}>
                                {showMonth && <li className={cx("pb-1 text-caption font-semibold text-muted", index > 0 && "pt-3")}>{month}</li>}
                                <VisitRow row={row} next={row.key === nextKey} />
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
            <Notice>
                Buổi &quot;Dự kiến&quot; chưa phải lịch hẹn: lễ tân sẽ gọi chốt giờ trước mỗi buổi. Ngày có thể dời theo tiến độ điều trị.{" "}
                <Link to={ROUTES.TREATMENT_PLANS} className="font-semibold text-primary hover:underline">
                    Xem kế hoạch điều trị
                </Link>
            </Notice>
        </DashboardSection>
    );
};

export default UpcomingVisitsSection;

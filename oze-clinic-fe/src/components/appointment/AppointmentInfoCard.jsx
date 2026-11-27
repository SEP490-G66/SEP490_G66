import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import KeyValueList from "@/components/ui/KeyValueList";
import { cx } from "@/utils/cx";
import { formatDate, formatDateTime, formatTimeRange, formatWeekday } from "@/utils/format";

const TITLE_ID = "appointment-info-title";

// "Thông tin lịch hẹn": code, kind, day, time, services, doctor, note, booked at.
// Closed by default so the page leads with the visit and the plan progress; the patient opens it for details.
// kind: optional "Loại lịch" text (e.g. "Buổi điều trị theo kế hoạch"). doctorAutoAssigned adds "(hệ thống tự gán)".
const AppointmentInfoCard = ({ appointment, kind, note, bookedAt, doctorAutoAssigned = false, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    const bodyId = useId();
    const day = appointment.appointmentDate ? `${formatWeekday(appointment.appointmentDate)}, ${formatDate(appointment.appointmentDate)}` : "";
    const items = [
        { label: "Mã lịch hẹn", value: appointment.appointmentCode, tone: "strong" },
        { label: "Loại lịch", value: kind },
        { label: "Ngày khám", value: day },
        { label: "Giờ khám", value: formatTimeRange(appointment.timeSlotStart, appointment.timeSlotEnd) },
        { label: "Dịch vụ", value: appointment.serviceName },
        { label: "Bác sĩ", value: appointment.doctorName || "Phòng khám sắp xếp", hint: doctorAutoAssigned ? "(hệ thống tự gán)" : null },
        { label: "Ghi chú", value: note },
        { label: "Thời gian đặt", value: bookedAt ? formatDateTime(bookedAt) : null },
    ];

    return (
        <section aria-labelledby={TITLE_ID} className="card-app p-0">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() => setOpen((value) => !value)}
                className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-6 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
                <h2 id={TITLE_ID} className="section-title">
                    Thông tin lịch hẹn
                </h2>
                <span className="flex items-center gap-1 text-label font-semibold text-primary">
                    {open ? "Đóng" : "Mở"}
                    <ChevronDown className={cx("size-4 transition-transform duration-150", open && "rotate-180")} aria-hidden="true" />
                </span>
            </button>
            <div id={bodyId} hidden={!open} className="border-t border-border p-6">
                <KeyValueList items={items} />
            </div>
        </section>
    );
};

export default AppointmentInfoCard;

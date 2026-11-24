import DashboardSection from "@/components/dashboard/DashboardSection";
import KeyValueList from "@/components/ui/KeyValueList";
import { formatDate, formatDateTime, formatTimeRange, formatWeekday } from "@/utils/format";

const TITLE_ID = "appointment-info-title";

// "Thông tin lịch hẹn": code, day, time, services, doctor, note, booked at.
// doctorAutoAssigned adds "(hệ thống tự gán)" after the doctor name.
const AppointmentInfoCard = ({ appointment, note, bookedAt, doctorAutoAssigned = false }) => {
    const day = appointment.appointmentDate ? `${formatWeekday(appointment.appointmentDate)}, ${formatDate(appointment.appointmentDate)}` : "";
    const items = [
        { label: "Mã lịch hẹn", value: appointment.appointmentCode, tone: "strong" },
        { label: "Ngày khám", value: day },
        { label: "Giờ khám", value: formatTimeRange(appointment.timeSlotStart, appointment.timeSlotEnd) },
        { label: "Dịch vụ", value: appointment.serviceName },
        { label: "Bác sĩ", value: appointment.doctorName, hint: doctorAutoAssigned ? "(hệ thống tự gán)" : null },
        { label: "Ghi chú", value: note },
        { label: "Thời gian đặt", value: bookedAt ? formatDateTime(bookedAt) : null },
    ];

    return (
        <DashboardSection id={TITLE_ID} title="Thông tin lịch hẹn">
            <KeyValueList items={items} />
        </DashboardSection>
    );
};

export default AppointmentInfoCard;

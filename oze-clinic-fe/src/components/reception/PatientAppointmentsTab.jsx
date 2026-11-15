import LoadMoreButton from "@/components/navigation/LoadMoreButton";
import { Badge, EmptyState } from "./shared";
import { STATUS_LABEL, dmy, hhmm, servicesOf } from "./receptionUtils";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";

const C = TEXT.APPT_COLUMNS;

const timeOf = (a) => (a.timeSlotStart ? `${hhmm(a.timeSlotStart)} – ${hhmm(a.timeSlotEnd)}` : TEXT.WALK_IN_SLOT);

const PatientAppointmentsTab = ({ items, hasMore, more, onMore }) => {
    if (items.length === 0) return <EmptyState text={TEXT.APPT_EMPTY} />;
    return (
        <>
            <div className="table-wrap rounded-none border-0">
                <table className="table table-stack">
                    <thead>
                        <tr>
                            <th>{C.DATE}</th>
                            <th>{C.TIME}</th>
                            <th>{C.DOCTOR}</th>
                            <th>{C.SERVICES}</th>
                            <th>{C.STATUS}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((a) => (
                            <tr key={a.id}>
                                <td data-primary className="num whitespace-nowrap">
                                    {dmy(a.appointmentDate)}
                                </td>
                                <td data-label={C.TIME} className="num">
                                    {timeOf(a)}
                                </td>
                                <td data-label={C.DOCTOR}>{a.doctorName ?? TEXT.DASH}</td>
                                <td data-label={C.SERVICES}>{servicesOf(a) || TEXT.DASH}</td>
                                <td data-label={C.STATUS}>
                                    <Badge map={STATUS_LABEL} value={a.status} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {hasMore && <LoadMoreButton loading={more.loading} error={more.error} onClick={onMore} label={TEXT.LOAD_MORE} retryLabel={TEXT.RETRY} errorText={TEXT.LOAD_MORE_ERROR} />}
        </>
    );
};

export default PatientAppointmentsTab;

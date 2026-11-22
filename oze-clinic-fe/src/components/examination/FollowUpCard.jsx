import { useState } from "react";
import CompactSlotPicker from "@/components/booking/CompactSlotPicker";
import { addDaysToDate, dayText, slotRange } from "@/utils/booking";
import { cx } from "@/utils/cx";
import { EXAM_FOLLOW_UP_TEXT as TEXT } from "@/utils/messages";
import ClinicalExamSection from "./ClinicalExamSection";

const FollowUpCard = ({ value = null, booked = null, doctor, today, onChange }) => {
    const [initialDate] = useState(() => value?.date ?? null);
    if (booked) {
        const [stateLabel, stateClass] = TEXT.STATES[booked.status] ?? [booked.status, "badge-neutral"];
        return (
            <ClinicalExamSection title={TEXT.TITLE}>
                <dl className="grid gap-x-4 gap-y-2 text-body-sm sm:grid-cols-[8rem_1fr]">
                    <dt className="text-muted">{TEXT.FIELD_WHEN}</dt>
                    <dd className="num font-semibold text-ink">
                        {dayText(booked.date, true)} · {slotRange(booked.slotStart, booked.slotEnd)}
                    </dd>
                    <dt className="text-muted">{TEXT.FIELD_DOCTOR}</dt>
                    <dd className="text-ink">{booked.doctorName}</dd>
                    <dt className="text-muted">{TEXT.FIELD_STATE}</dt>
                    <dd>
                        <span className={cx("badge", stateClass)}>{stateLabel}</span>
                    </dd>
                </dl>
                <p className="mt-3 text-caption text-muted">{TEXT.BOOKED_NOTE}</p>
            </ClinicalExamSection>
        );
    }

    return (
        <ClinicalExamSection title={TEXT.TITLE} badge={<span className="text-caption text-muted">{TEXT.OPTIONAL}</span>}>
            {doctor?.id ? (
                <>
                    <CompactSlotPicker today={today} initialDate={initialDate} minDate={addDaysToDate(today, 1)} doctorId={doctor.id} value={value} onChange={(next) => onChange(next ? { date: next.date, slotStart: next.slotStart, slotEnd: next.slotEnd } : null)} />
                    <p role="status" className="alert alert-info mt-4">
                        {value ? (
                            <>
                                {TEXT.PICKED}{" "}
                                <strong className="num font-semibold">
                                    {dayText(value.date, true)} · {slotRange(value.slotStart, value.slotEnd)}
                                </strong>
                                . {TEXT.PICKED_NOTE}{" "}
                                <button type="button" className="btn btn-link h-auto p-0 align-baseline" onClick={() => onChange(null)}>
                                    {TEXT.CLEAR}
                                </button>
                            </>
                        ) : (
                            TEXT.NONE
                        )}
                    </p>
                </>
            ) : (
                <p className="text-body-sm text-muted">{TEXT.NO_DOCTOR}</p>
            )}
        </ClinicalExamSection>
    );
};

export default FollowUpCard;

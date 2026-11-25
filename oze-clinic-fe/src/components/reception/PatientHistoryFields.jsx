import HistoryChecklist from "@/components/examination/HistoryChecklist";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";
import { FORM_LIMITS } from "@/utils/patientRecordForm";

const TONES = { Allergy: "danger", Condition: "warning", History: "neutral" };

const PatientHistoryFields = ({ groups, ticked, onChange, notice, lockedNote }) => (
    <div className="space-y-3">
        {notice && (
            <p role="status" className="alert alert-info">
                {notice}
            </p>
        )}
        {groups.map((group) => (
            <HistoryChecklist
                key={group.recordType}
                title={group.title}
                options={group.options}
                value={[...group.locked, ...ticked[group.recordType].filter((t) => !group.locked.includes(t))]}
                onChange={(next) => onChange(group.recordType, next.filter((t) => !group.locked.includes(t)))}
                tone={TONES[group.recordType]}
                placeholder={TEXT.HISTORY_OTHER_PLACEHOLDERS[group.recordType]}
                otherLabel={TEXT.HISTORY_OTHER}
                defaultOpen={group.recordType === "Allergy"}
                locked={group.locked}
                itemNotes={group.notes}
                maxLength={FORM_LIMITS.historyTitle}
                emptyError={TEXT.HISTORY_EMPTY_DRAFT}
            />
        ))}
        {lockedNote && <p className="help-text">{lockedNote}</p>}
    </div>
);

export default PatientHistoryFields;

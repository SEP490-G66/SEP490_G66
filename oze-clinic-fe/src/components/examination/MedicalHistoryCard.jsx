import { HISTORY_ALLERGY_OPTIONS, HISTORY_CONDITION_OPTIONS, HISTORY_DENTAL_OPTIONS, HISTORY_FEMALE_CONDITION_OPTIONS } from "@/utils/messages";
import ClinicalExamSection from "./ClinicalExamSection";
import HistoryChecklist from "./HistoryChecklist";

const SAVED_NOTE = "Đã lưu trong hồ sơ";

// "Tiền sử bệnh": allergies, underlying conditions and dental history, completed by the doctor in step 1.
// history: { allergies: [], conditions: [], dental: [] }; onChange receives the whole updated history.
// saved: the items already in the patient's record, same groups: ticked, locked and marked (they cannot be removed here).
// gender "female" adds pregnancy / breastfeeding to the conditions.
// readOnly: the record as it is (doctor's patient record page); the groups still open and close.
const MedicalHistoryCard = ({ history, saved, gender, onChange, readOnly = false }) => {
    const female = gender === "female";
    const conditionOptions = female ? [...HISTORY_CONDITION_OPTIONS, ...HISTORY_FEMALE_CONDITION_OPTIONS] : HISTORY_CONDITION_OPTIONS;
    const update = (key) => (value) => onChange?.({ ...history, [key]: value });
    const lockOf = (key) => ({
        locked: saved?.[key] ?? [],
        itemNotes: Object.fromEntries((saved?.[key] ?? []).map((item) => [item, SAVED_NOTE])),
        readOnly,
    });

    return (
        <ClinicalExamSection
            title="Tiền sử bệnh"
            divided={false}
            badge={
                readOnly ? (
                    <span className="rounded-full bg-surface-tint px-2 py-0.5 text-caption font-medium text-body">Chỉ xem</span>
                ) : (
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-caption font-medium text-primary">Bác sĩ bổ sung</span>
                )
            }
            action={<span className="text-caption text-muted">Bấm vào từng mục để mở / thu gọn</span>}
            bodyClassName="flex flex-col gap-3.5"
        >
            <HistoryChecklist
                title="Dị ứng"
                tone="danger"
                options={HISTORY_ALLERGY_OPTIONS}
                value={history.allergies}
                onChange={update("allergies")}
                placeholder="Dị ứng khác, ví dụ: Metronidazol"
                {...lockOf("allergies")}
            />
            <HistoryChecklist
                title="Bệnh nền & tình trạng sức khoẻ"
                tone="warning"
                options={conditionOptions}
                value={history.conditions}
                onChange={update("conditions")}
                placeholder="Bệnh khác"
                note={female ? undefined : `Bệnh nhân nữ có thêm 2 mục: ${HISTORY_FEMALE_CONDITION_OPTIONS.join(", ")}`}
                {...lockOf("conditions")}
            />
            <HistoryChecklist
                title="Tiền sử bệnh răng miệng"
                options={HISTORY_DENTAL_OPTIONS}
                value={history.dental}
                onChange={update("dental")}
                placeholder="Tiền sử khác, ví dụ: từng cấy ghép Implant"
                defaultOpen={false}
                {...lockOf("dental")}
            />
        </ClinicalExamSection>
    );
};

export default MedicalHistoryCard;

import { useId } from "react";
import ClinicalExamSection from "./ClinicalExamSection";

// Examinations.ClinicalNotes (ExaminationConstants.ClinicalNotesMaxLength)
const SYMPTOMS_MAX = 2000;

// "Triệu chứng" (Figma): what the patient feels and what the doctor notices, in one free text.
const SymptomSection = ({ value = "", onChange }) => {
    const id = useId();

    return (
        <ClinicalExamSection title="Triệu chứng">
            <label htmlFor={id} className="sr-only">
                Triệu chứng
            </label>
            <textarea
                id={id}
                rows={4}
                maxLength={SYMPTOMS_MAX}
                className="input h-auto min-h-24 py-2.5"
                placeholder="Ví dụ: Ê buốt khi ăn nóng / lạnh, đau khi nhai. Ê buốt răng hàm dưới trái khoảng 1 tuần, tăng dần khi ăn đồ lạnh."
                value={value}
                onChange={(event) => onChange?.(event.target.value)}
            />
        </ClinicalExamSection>
    );
};

export default SymptomSection;

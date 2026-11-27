import { icdName } from "@/utils/examination";
import ClinicalExamSection from "./ClinicalExamSection";

const Empty = ({ children }) => <p className="text-body-sm text-muted">{children}</p>;

// Right column of "Kê đơn thuốc" (Figma): what to keep in mind while prescribing — the patient's allergies,
// this visit's diagnoses and what was done today. diagnoses: [{ id, code, teeth }]; treatments: [{ id, content }].
const PrescriptionContextCards = ({ allergies = [], diagnoses = [], treatments = [] }) => (
    <div className="flex flex-col gap-5">
        <ClinicalExamSection title="Dị ứng">
            {allergies.length ? (
                <ul className="flex flex-wrap gap-2">
                    {allergies.map((item) => (
                        <li key={item} className="badge badge-danger">
                            {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <Empty>Không ghi nhận dị ứng.</Empty>
            )}
        </ClinicalExamSection>
        <ClinicalExamSection title="Chẩn đoán">
            {diagnoses.length ? (
                <ul className="flex flex-col gap-2 text-body-sm">
                    {diagnoses.map((item) => (
                        <li key={item.id} className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0">
                                <b className="num font-semibold text-ink">{item.code}</b>
                                {icdName(item.code) && <span className="text-body"> · {icdName(item.code)}</span>}
                            </span>
                            {item.teeth?.length > 0 && <span className="num shrink-0 text-caption text-muted">{item.teeth.join(", ")}</span>}
                        </li>
                    ))}
                </ul>
            ) : (
                <Empty>Chưa có chẩn đoán.</Empty>
            )}
        </ClinicalExamSection>
        <ClinicalExamSection title="Điều trị lượt này">
            {treatments.length ? (
                <ul className="flex flex-col gap-1.5 text-body-sm text-body">
                    {treatments.map((item) => (
                        <li key={item.id}>{item.content}</li>
                    ))}
                </ul>
            ) : (
                <Empty>Chưa có nội dung điều trị.</Empty>
            )}
        </ClinicalExamSection>
    </div>
);

export default PrescriptionContextCards;

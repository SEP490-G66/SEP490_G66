import { formatDate, parseDateOnly } from "@/utils/format";
import { GENDER_LABELS } from "@/utils/messages";

const ageOf = (birthDate) => {
    const born = parseDateOnly(birthDate);
    if (!born) return null;
    const today = new Date();
    const hadBirthday = today.getMonth() > born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() >= born.getDate());
    return today.getFullYear() - born.getFullYear() - (hadBirthday ? 0 : 1);
};

// Patient of the selected order. The technician only needs to identify the patient: no phone, address,
// diagnosis or history. patient: { name, code, gender ("male" / "female" / "Male"…), birthDate (yyyy-mm-dd) };
// a field the caller does not have is left out.
const ImagingPatientCard = ({ patient }) => {
    const age = ageOf(patient.birthDate);
    const fields = [
        ["Mã BN", patient.code],
        ["Giới tính", patient.gender && (GENDER_LABELS[String(patient.gender).toLowerCase()] ?? patient.gender)],
        ["Ngày sinh", patient.birthDate && `${formatDate(patient.birthDate)}${age != null ? ` (${age} tuổi)` : ""}`],
    ].filter(([, value]) => value);
    return (
        <section aria-label={`Bệnh nhân ${patient.name}`} className="card-app flex flex-col gap-3 px-5 py-4">
            <h2 className="font-heading text-heading-3 text-ink">{patient.name}</h2>
            {fields.length > 0 && (
                <dl className="flex flex-wrap gap-x-10 gap-y-3 text-body-sm">
                    {fields.map(([label, value]) => (
                        <div key={label} className="flex min-w-0 flex-col gap-0.5">
                            <dt className="text-caption text-muted">{label}</dt>
                            <dd className="num font-medium text-ink">{value}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </section>
    );
};

export default ImagingPatientCard;

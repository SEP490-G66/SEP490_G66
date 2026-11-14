import { Card } from "./shared";
import { dmy } from "./receptionUtils";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";
import { ageOf, genderOf, phoneDisplay } from "@/utils/patientRecord";

const F = TEXT.FIELDS;
const GROUP_ORDER = ["Allergy", "Condition", "History", "Medication"];
const GROUP_BADGE = { Allergy: "badge-danger", Condition: "badge-warning", History: "badge-neutral", Medication: "badge-info" };

const dateOf = (value) => (value ? dmy(String(value).slice(0, 10)) : "");

const PatientInfoTab = ({ patient, today }) => {
    const age = ageOf(patient.dateOfBirth, today);
    const dob = patient.dateOfBirth ? `${dateOf(patient.dateOfBirth)}${age == null ? "" : ` (${TEXT.AGE(age)})`}` : TEXT.DASH;
    const rows = [
        [F.CODE, patient.patientCode],
        [F.FULL_NAME, patient.fullName],
        [F.GENDER, genderOf(patient.gender).label],
        [F.DOB, dob],
        [F.PHONE, patient.phoneNumber ? phoneDisplay(patient.phoneNumber) : TEXT.DASH],
        [F.EMERGENCY_PHONE, patient.emergencyContactPhone || TEXT.DASH],
        [F.EMAIL, patient.email || TEXT.DASH],
        [F.ADDRESS, patient.address || TEXT.DASH],
        [F.ACCOUNT, patient.userId ? TEXT.ACCOUNT_YES : TEXT.ACCOUNT_NO],
    ];
    const profiles = (patient.medicalProfiles ?? []).filter((m) => String(m.title ?? "").trim());
    const groups = GROUP_ORDER.map((type) => {
        const items = profiles.filter((m) => String(m.recordType).toLowerCase() === type.toLowerCase());
        return { type, active: items.filter((m) => m.status === "Active"), past: items.filter((m) => m.status !== "Active") };
    }).filter((g) => g.type !== "Medication" || g.active.length + g.past.length > 0);

    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <Card title={TEXT.ADMIN_CARD}>
                <div className="p-5">
                <dl className="grid grid-cols-[auto_1fr] gap-x-10 gap-y-2 rounded-lg bg-surface-tint px-4 py-3 text-body-sm">
                    {rows.map(([label, value]) => (
                        <div key={label} className="contents">
                            <dt className="text-muted">{label}</dt>
                            <dd className="m-0 break-words text-ink">{value}</dd>
                        </div>
                    ))}
                </dl>
                </div>
            </Card>
            <Card title={TEXT.HISTORY_CARD}>
                <div className="p-5">
                {profiles.length === 0 ? (
                    <p className="text-body-sm text-muted">{TEXT.HISTORY_EMPTY}</p>
                ) : (
                    <div className="space-y-4">
                        {groups.map((group) => (
                            <div key={group.type}>
                                <h3 className="text-label font-semibold text-ink">{TEXT.HISTORY_GROUPS[group.type]}</h3>
                                {group.active.length === 0 && group.past.length === 0 ? (
                                    <p className="mt-1 text-body-sm text-muted">{TEXT.DASH}</p>
                                ) : (
                                    <>
                                        {group.active.length > 0 && (
                                            <ul className="mt-2 flex flex-wrap gap-2">
                                                {group.active.map((m) => (
                                                    <li key={m.id} className={`badge ${GROUP_BADGE[group.type]}`}>
                                                        {m.title}
                                                        {m.createdAt && <span className="num font-normal">· {TEXT.HISTORY_RECORDED_ON(dateOf(m.createdAt))}</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {group.past.length > 0 && (
                                            <p className="mt-2 text-caption text-muted">
                                                {TEXT.HISTORY_PAST}:{" "}
                                                {group.past
                                                    .map((m) => `${m.title} (${TEXT.HISTORY_STATUS[m.status] ?? m.status}${m.createdAt ? `, ${dateOf(m.createdAt)}` : ""})`)
                                                    .join("; ")}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                </div>
            </Card>
        </div>
    );
};

export default PatientInfoTab;

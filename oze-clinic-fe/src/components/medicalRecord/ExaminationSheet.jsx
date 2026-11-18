import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { displayText } from "@/utils/medicalRecord";
import { cx } from "@/utils/cx";
import { MEDICAL_RECORD_TEXT as TEXT } from "@/utils/messages";
import { getPaymentHistoryRoute } from "@/utils/routes";

const VALUE_CLASS = "font-medium text-ink";
const SECTION_TITLE = "mb-1.5 text-caption text-muted";

const orDash = (value) => (value === "" || value == null ? "—" : displayText(value));

const InfoList = ({ rows, className }) => (
    <dl className={cx("flex flex-col gap-1.5 text-body-sm", className)}>
        {rows.map(([label, value, valueClass]) => (
            <div key={label} className="flex gap-2.5">
                <dt className="w-24 shrink-0 text-muted sm:w-30">{label}</dt>
                <dd className={cx("min-w-0", valueClass ?? VALUE_CLASS)}>{orDash(value)}</dd>
            </div>
        ))}
    </dl>
);

const doseText = (item) => [item.dosage, item.frequency].filter(Boolean).join(" · ") || "—";

const Prescriptions = ({ prescriptions }) => (
    <div className="flex flex-col gap-3">
        {prescriptions.map((prescription, index) => (
            <div key={index}>
                {prescription.items.length > 0 && (
                    <>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>{TEXT.COL_MEDICINE}</th>
                                        <th>{TEXT.COL_DOSE}</th>
                                        <th>{TEXT.COL_DURATION}</th>
                                        <th className="text-right">{TEXT.COL_QUANTITY}</th>
                                        <th>{TEXT.COL_USAGE}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prescription.items.map((item, row) => (
                                        <tr key={row}>
                                            <td className="font-semibold text-ink">{orDash(item.medicationName)}</td>
                                            <td>{doseText(item)}</td>
                                            <td>{orDash(item.duration)}</td>
                                            <td className="num text-right">{orDash(item.quantity)}</td>
                                            <td>{orDash(item.instructions)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <ul className="flex flex-col divide-y divide-border rounded-md border border-border md:hidden">
                            {prescription.items.map((item, row) => (
                                <li key={row} className="px-3 py-2 text-body-sm">
                                    <div className="flex justify-between gap-2">
                                        <b className="text-ink">{orDash(item.medicationName)}</b>
                                        {item.quantity != null && <span className="num text-muted">SL {item.quantity}</span>}
                                    </div>
                                    <p>{[doseText(item), item.duration].filter(Boolean).join(" · ")}</p>
                                    {item.instructions && <p className="text-caption text-muted">{item.instructions}</p>}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                {prescription.notes && <p className="mt-1.5 text-caption text-muted">{TEXT.PRESCRIPTION_NOTE(prescription.notes)}</p>}
            </div>
        ))}
    </div>
);

const ExaminationSheet = ({ visit, clinic, profile, patient }) => (
    <section className="card-app p-5">
        <div className="rounded-lg border border-border px-4.5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2.5">
                <b className="text-ink">{displayText(clinic.name).toUpperCase()}</b>
                <span className="text-caption">
                    Mã phiếu: <b className="num">{orDash(visit.code)}</b>
                </span>
            </div>
            <p className="mb-3.5 mt-2.5 text-center font-heading text-heading-3 font-bold tracking-wider text-ink">PHIẾU KHÁM BỆNH</p>
            <InfoList
                rows={[
                    ["Họ và tên", displayText(profile.name).toUpperCase(), "font-semibold text-ink"],
                    ["Giới tính", profile.gender],
                    ["Ngày sinh", profile.dob, `num ${VALUE_CLASS}`],
                    ["Địa chỉ", profile.addr],
                    ["Điện thoại", profile.phone, `num ${VALUE_CLASS}`],
                ]}
            />
            <div className="my-3 border-t border-dashed border-border" />
            <div className="flex items-start gap-4">
                <InfoList
                    className="flex-1"
                    rows={[
                        ["Bác sĩ", visit.doctor, "font-semibold text-ink"],
                        ["Thời gian", [visit.time, visit.date && `ngày ${visit.date}`].filter(Boolean).join(" "), `num ${VALUE_CLASS}`],
                        ["Lý do khám", visit.reason],
                        ["Chẩn đoán", visit.diag],
                    ]}
                />
                {visit.stt != null && (
                    <div className="min-w-18 rounded-lg border border-border px-2.5 py-1.5 text-center">
                        <span className="block text-caption font-bold tracking-wide text-muted">STT</span>
                        <b className="num text-stat leading-tight text-ink">{displayText(visit.stt)}</b>
                    </div>
                )}
            </div>
            <div className="my-3 border-t border-dashed border-border" />
            <p className={SECTION_TITLE}>Đã làm</p>
            {visit.done.length ? (
                <ul className="list-disc pl-5 text-body-sm">
                    {visit.done.map((item, index) => (
                        <li key={index}>{item}</li>
                    ))}
                </ul>
            ) : (
                <p className="text-body-sm">—</p>
            )}
            {(visit.notes || visit.addenda.length > 0) && (
                <>
                    <p className={cx(SECTION_TITLE, "mt-3")}>{TEXT.DOCTOR_NOTES}</p>
                    <div className="flex flex-col gap-1 rounded-md border-l-3 border-l-primary bg-surface-tint px-3 py-2.5 text-body-sm">
                        {visit.notes && <p className="whitespace-pre-line">{visit.notes}</p>}
                        {visit.addenda.map((addendum, index) => (
                            <p key={index} className="text-caption text-muted">
                                {`${addendum.type} ${addendum.date}: ${addendum.content}`}
                            </p>
                        ))}
                    </div>
                </>
            )}
            {visit.prescriptions.length > 0 && (
                <>
                    <p className={cx(SECTION_TITLE, "mt-3")}>{TEXT.PRESCRIPTION}</p>
                    <Prescriptions prescriptions={visit.prescriptions} />
                </>
            )}
            <p className={cx(SECTION_TITLE, "mt-3")}>Hẹn tiếp theo</p>
            <p className="text-body-sm">{orDash(visit.next?.text)}</p>
            {visit.invoiceId != null && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-tint px-3 py-2.5 text-body-sm">
                    <span>{TEXT.VISIT_COST}</span>
                    <Link to={getPaymentHistoryRoute(visit.invoiceId)} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                        {TEXT.VIEW_COST}
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                </div>
            )}
            <p className="mt-3 text-right text-caption">
                Mã NB: <b className="num">{orDash(patient.code)}</b>
            </p>
        </div>
    </section>
);

export default ExaminationSheet;

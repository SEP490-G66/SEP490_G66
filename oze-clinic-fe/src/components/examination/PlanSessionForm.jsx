import { useId } from "react";
import StatusBadge from "@/components/ui/StatusBadge";
import { parseMoney } from "@/utils/examination";
import { formatNumber } from "@/utils/format";
import { PLAN_SESSION_STATUS } from "@/utils/messages";
import RowActions from "./RowActions";

const Required = () => <span className="text-danger-solid"> *</span>;

const FieldError = ({ id, message }) =>
    message ? (
        <p id={id} className="error-text">
            {message}
        </p>
    ) : null;

// One treatment session of a planned service ("Buổi 1"): content, service type, planned date, cost, description.
// session: see utils/examination (newPlanSession). typeOptions: [{ id, name, price }] of the service (its variants);
// a service without variants has no type field. errors: { title?, typeId?, date? } from validatePlan.
// doctorOptions: [{ doctorId, doctorName, suggested }] the session can be given to (getPlanDoctorOptions); the front desk
// books the session with the chosen doctor only. onChange receives the changed fields; picking a type fills an empty cost.
const PlanSessionForm = ({ index, session, typeOptions = [], doctorOptions = [], errors = {}, onChange, onRemove }) => {
    const ids = { title: useId(), type: useId(), doctor: useId(), doctorHelp: useId(), date: useId(), cost: useId(), note: useId(), titleError: useId(), typeError: useId(), dateError: useId() };
    const suggested = doctorOptions.filter((doctor) => doctor.suggested);
    const others = doctorOptions.filter((doctor) => !doctor.suggested);
    // A doctor chosen before who is no longer in the list (left the clinic) is still shown, so the value is not lost
    const missing = session.doctorId && !doctorOptions.some((doctor) => String(doctor.doctorId) === session.doctorId);

    const changeType = (typeId) => {
        const type = typeOptions.find((option) => option.id === typeId);
        onChange({ typeId, ...(session.cost == null && type && { cost: type.price }) });
    };

    return (
        <fieldset className="flex flex-col gap-3 rounded-[10px] border border-border p-4">
            <legend className="sr-only">Buổi {index + 1}</legend>
            <div className="flex items-center gap-2">
                <span className="num rounded-full bg-primary-soft px-2 py-0.5 text-caption font-semibold text-primary">Buổi {index + 1}</span>
                <StatusBadge status={session.status} labels={PLAN_SESSION_STATUS} />
                {onRemove && (
                    <RowActions className="ml-auto" label={`buổi ${index + 1}`} onRemove={onRemove} />
                )}
            </div>

            <div className="field">
                <label htmlFor={ids.title} className="label">
                    Nội dung buổi
                    <Required />
                </label>
                <input
                    id={ids.title}
                    className="input"
                    placeholder="Ví dụ: Trám composite răng 36"
                    value={session.title}
                    aria-invalid={errors.title ? true : undefined}
                    aria-describedby={errors.title ? ids.titleError : undefined}
                    onChange={(event) => onChange({ title: event.target.value })}
                />
                <FieldError id={ids.titleError} message={errors.title} />
            </div>

            {typeOptions.length > 0 && (
                <div className="field">
                    <label htmlFor={ids.type} className="label">
                        Loại dịch vụ
                        <Required />
                    </label>
                    <select
                        id={ids.type}
                        className="input"
                        value={session.typeId}
                        aria-invalid={errors.typeId ? true : undefined}
                        aria-describedby={errors.typeId ? ids.typeError : undefined}
                        onChange={(event) => changeType(event.target.value)}
                    >
                        <option value="">Chọn loại dịch vụ</option>
                        {typeOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.name} · {formatNumber(option.price)} ₫
                            </option>
                        ))}
                    </select>
                    <FieldError id={ids.typeError} message={errors.typeId} />
                </div>
            )}

            <div className="field">
                <label htmlFor={ids.doctor} className="label">
                    Bác sĩ thực hiện
                </label>
                <select
                    id={ids.doctor}
                    className="input"
                    value={session.doctorId ?? ""}
                    aria-describedby={ids.doctorHelp}
                    onChange={(event) => onChange({ doctorId: event.target.value })}
                >
                    <option value="">Bác sĩ lập kế hoạch (tôi)</option>
                    {missing && <option value={session.doctorId}>Bác sĩ đã chọn trước đó</option>}
                    {suggested.length > 0 && (
                        <optgroup label="Gợi ý: có ca ở phòng phù hợp dịch vụ">
                            {suggested.map((doctor) => (
                                <option key={doctor.doctorId} value={String(doctor.doctorId)}>
                                    {doctor.doctorName}
                                    {doctor.specialization ? ` · ${doctor.specialization}` : ""}
                                </option>
                            ))}
                        </optgroup>
                    )}
                    {others.length > 0 && (
                        <optgroup label="Bác sĩ khác">
                            {others.map((doctor) => (
                                <option key={doctor.doctorId} value={String(doctor.doctorId)}>
                                    {doctor.doctorName}
                                    {doctor.specialization ? ` · ${doctor.specialization}` : ""}
                                </option>
                            ))}
                        </optgroup>
                    )}
                </select>
                <p id={ids.doctorHelp} className="help-text">
                    Lễ tân sẽ xếp giờ buổi này theo lịch trực của bác sĩ được chọn.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="field">
                    <label htmlFor={ids.date} className="label">
                        Ngày dự kiến
                    </label>
                    <input
                        id={ids.date}
                        type="date"
                        className="input"
                        value={session.date}
                        aria-invalid={errors.date ? true : undefined}
                        aria-describedby={errors.date ? ids.dateError : undefined}
                        onChange={(event) => onChange({ date: event.target.value })}
                    />
                    <FieldError id={ids.dateError} message={errors.date} />
                </div>
                <div className="field">
                    <label htmlFor={ids.cost} className="label">
                        Chi phí dự kiến
                    </label>
                    <div className="relative">
                        <input
                            id={ids.cost}
                            className="input num pr-8"
                            inputMode="numeric"
                            placeholder="0"
                            value={session.cost == null ? "" : formatNumber(session.cost)}
                            onChange={(event) => onChange({ cost: parseMoney(event.target.value) })}
                        />
                        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
                            ₫
                        </span>
                    </div>
                </div>
            </div>

            <div className="field">
                <label htmlFor={ids.note} className="label">
                    Mô tả
                </label>
                <textarea
                    id={ids.note}
                    className="input"
                    placeholder="Ví dụ: Trám mặt nhai – xa răng 36"
                    value={session.note}
                    onChange={(event) => onChange({ note: event.target.value })}
                />
            </div>
        </fieldset>
    );
};

export default PlanSessionForm;

import { useId, useState } from "react";
import { newPlanSession } from "@/utils/examination";
import ClinicalExamSection from "./ClinicalExamSection";
import PlanServiceItem from "./PlanServiceItem";

// A catalog service put in the plan by the doctor, with one empty session to fill in
const newPlanService = (entry) => {
    const stamp = Date.now();
    return {
        id: `plan-${entry.serviceId}-${stamp}`,
        serviceId: entry.serviceId,
        name: entry.name,
        status: "notStarted",
        added: true,
        sessions: [newPlanSession(`session-${entry.serviceId}-${stamp}`)],
    };
};

// "Kế hoạch điều trị theo dịch vụ": the services to treat, in treatment order, each with its sessions. It starts with the
// services the patient booked; the doctor adds others from the catalog when the examination finds more to treat.
// services: see utils/examination; typeOptionsOf(service) -> [{ id, name, price }];
// catalog: [{ serviceId, name }] the services that can be added (the ones already in the plan are left out of the list);
// expandedIds: the services shown open (each opens and closes on its own; onToggle(serviceId) flips one).
// errors: result of validatePlan (shown after a submit attempt).
// onChange receives the whole updated services list (reordered, services or sessions added / edited / removed);
// onAdd(service) after a service is added, so the page can open it.
const PlanServiceList = ({ services = [], catalog = [], typeOptionsOf, expandedIds = [], errors, onToggle, onChange, onAdd }) => {
    const pickerId = useId();
    const [choice, setChoice] = useState("");
    const available = catalog.filter((entry) => !services.some((service) => service.serviceId === entry.serviceId));

    const move = (index, offset) => {
        const next = [...services];
        [next[index], next[index + offset]] = [next[index + offset], next[index]];
        onChange(next);
    };

    const updateSessions = (serviceId, update) =>
        onChange(services.map((service) => (service.id === serviceId ? { ...service, sessions: update(service.sessions) } : service)));

    const addService = () => {
        const entry = available.find((item) => String(item.serviceId) === choice);
        if (!entry) return;
        const service = newPlanService(entry);
        onChange([...services, service]);
        onAdd?.(service);
        setChoice("");
    };

    return (
        <ClinicalExamSection
            title="Kế hoạch điều trị theo dịch vụ"
            badge={<span className="num rounded-full bg-primary-soft px-2 py-0.5 text-caption font-medium text-primary">{services.length} dịch vụ</span>}
            bodyClassName="flex flex-col gap-3"
        >
            {services.length === 0 ? (
                <p className="py-2 text-center text-muted">Chưa có dịch vụ nào. Chọn dịch vụ cần điều trị từ danh mục bên dưới.</p>
            ) : (
                <ol className="flex flex-col gap-3">
                    {services.map((service, index) => (
                        <PlanServiceItem
                            key={service.id}
                            index={index}
                            service={service}
                            typeOptions={typeOptionsOf(service)}
                            expanded={expandedIds.includes(service.id)}
                            errors={{
                                service: errors?.services?.[service.id],
                                sessions: Object.fromEntries(service.sessions.filter((session) => errors?.sessions?.[session.id]).map((session) => [session.id, errors.sessions[session.id]])),
                            }}
                            canMoveUp={index > 0}
                            canMoveDown={index < services.length - 1}
                            onToggle={() => onToggle(service.id)}
                            onMoveUp={() => move(index, -1)}
                            onMoveDown={() => move(index, 1)}
                            // Only a service the doctor added, before any of its sessions is done; a booked one stays
                            onRemove={
                                service.added && !service.sessions.some((session) => session.status === "done")
                                    ? () => onChange(services.filter((item) => item.id !== service.id))
                                    : undefined
                            }
                            onAddSession={() => updateSessions(service.id, (sessions) => [...sessions, newPlanSession(`session-${Date.now()}`)])}
                            onChangeSession={(sessionId, changes) =>
                                updateSessions(service.id, (sessions) => sessions.map((session) => (session.id === sessionId ? { ...session, ...changes } : session)))
                            }
                            onRemoveSession={(sessionId) => updateSessions(service.id, (sessions) => sessions.filter((session) => session.id !== sessionId))}
                        />
                    ))}
                </ol>
            )}
            {available.length > 0 && (
                <div className="flex flex-wrap items-end gap-2">
                    <div className="field min-w-0 flex-1">
                        <label htmlFor={pickerId} className="label">
                            Thêm dịch vụ điều trị
                        </label>
                        <select id={pickerId} className="input" value={choice} onChange={(event) => setChoice(event.target.value)}>
                            <option value="">Chọn dịch vụ…</option>
                            {available.map((entry) => (
                                <option key={entry.serviceId} value={entry.serviceId}>
                                    {entry.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button type="button" className="btn btn-secondary" disabled={!choice} onClick={addService}>
                        + Thêm dịch vụ
                    </button>
                </div>
            )}
            <p className="text-caption text-muted">Dịch vụ bệnh nhân đăng ký có sẵn trong kế hoạch; thêm dịch vụ khác khi khám phát hiện thêm bệnh cần điều trị.</p>
        </ClinicalExamSection>
    );
};

export default PlanServiceList;

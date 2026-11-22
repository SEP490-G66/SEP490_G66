import { useEffect, useState } from "react";
import { getPatientOptions, getPlanOptions } from "@/services/cashierService";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";

// Bệnh nhân + Kế hoạch điều trị selects of Đặt cọc / Theo đợt. options: which payment options count (null = any chosen).
// The chosen ids live in the URL (the page passes them in); a single matching plan is picked by itself.
const PlanPicker = ({ idPrefix, patientId, planId, options, emptyText, onChange, reloadKey, disabled }) => {
    const [patients, setPatients] = useState(null);
    const [plans, setPlans] = useState({ forPatient: null, items: [], failed: false });

    useEffect(() => {
        let active = true;
        getPatientOptions().then((result) => active && setPatients(result.success ? result.data : { failed: true }));
        return () => {
            active = false;
        };
    }, []);

    const optionsKey = options?.join(",") ?? "";
    useEffect(() => {
        if (!patientId) return undefined;
        let active = true;
        getPlanOptions({ patientId, options: optionsKey ? optionsKey.split(",") : null }).then((result) => {
            if (!active) return;
            const items = result.success ? result.data : [];
            setPlans({ forPatient: patientId, items, failed: !result.success });
            if (!planId && items.length === 1) onChange({ patientId, planId: String(items[0].id) }, true);
        });
        return () => {
            active = false;
        };
        // onChange is a new function on every render of the page; the plan list only depends on the patient
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId, optionsKey, reloadKey]);

    const loadedPlans = plans.forPatient === patientId ? plans.items : null;
    const plansFailed = plans.forPatient === patientId && plans.failed;
    const patientList = Array.isArray(patients) ? patients : [];

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <div className="field">
                <label htmlFor={`${idPrefix}-patient`} className="label">
                    {TEXT.PATIENT}
                </label>
                <select
                    id={`${idPrefix}-patient`}
                    className="input"
                    value={patientId ?? ""}
                    disabled={!patients || disabled}
                    onChange={(e) => onChange({ patientId: e.target.value, planId: "" })}
                >
                    <option value="">{TEXT.PICK_PATIENT}</option>
                    {patientList.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name} · {p.code}
                        </option>
                    ))}
                </select>
            </div>
            <div className="field">
                <label htmlFor={`${idPrefix}-plan`} className="label">
                    {TEXT.PLAN}
                </label>
                <select
                    id={`${idPrefix}-plan`}
                    className="input"
                    value={planId ?? ""}
                    disabled={!patientId || !loadedPlans?.length || disabled}
                    onChange={(e) => onChange({ patientId, planId: e.target.value })}
                >
                    <option value="">{TEXT.PICK_PLAN}</option>
                    {(loadedPlans ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
                {plansFailed || patients?.failed ? (
                    <p className="error-text" role="alert">
                        {TEXT.PLAN_LOAD_ERROR}
                    </p>
                ) : (
                    patientId && loadedPlans && !loadedPlans.length && <p className="help-text">{emptyText}</p>
                )}
            </div>
        </div>
    );
};

export default PlanPicker;

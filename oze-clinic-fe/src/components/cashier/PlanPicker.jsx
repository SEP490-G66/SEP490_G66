import { useEffect, useState } from "react";
import PatientPicker from "@/components/billing/PatientPicker";
import { getPatientOptions, getPlanOptions } from "@/services/cashierService";
import { CASHIER_PATIENT_OPTION_LIMIT, CASHIER_TEXT as TEXT } from "@/utils/messages";

const trimKeyword = (text) => text.trim();

// Bệnh nhân + Kế hoạch điều trị selects of Đặt cọc / Theo đợt. options: which payment options count (null = any chosen).
// The chosen ids live in the URL (the page passes them in); a single matching plan is picked by itself.
const PlanPicker = ({ idPrefix, patientId, planId, options, emptyText, onChange, reloadKey, disabled }) => {
    const [picked, setPicked] = useState(null);
    const [plans, setPlans] = useState({ forPatient: null, patient: null, items: [], failed: false });

    const optionsKey = options?.join(",") ?? "";
    useEffect(() => {
        if (!patientId) return undefined;
        let active = true;
        getPlanOptions({ patientId, options: optionsKey ? optionsKey.split(",") : null }).then((result) => {
            if (!active) return;
            const items = result.success ? result.data.plans : [];
            setPlans({ forPatient: patientId, patient: result.success ? result.data.patient : null, items, failed: !result.success });
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
    const loadedPatient = plans.forPatient === patientId ? plans.patient : null;
    const patient = !patientId
        ? null
        : picked && String(picked.id) === patientId
          ? picked
          : (loadedPatient ?? { id: patientId, fullName: plansFailed ? TEXT.DASH : TEXT.PATIENT_LOADING });

    const pickPatient = (next) => {
        setPicked(next);
        onChange({ patientId: next ? String(next.id) : "", planId: "" });
    };

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <PatientPicker
                inputId={`${idPrefix}-patient`}
                value={patient}
                onChange={pickPatient}
                disabled={disabled}
                search={getPatientOptions}
                normalize={trimKeyword}
                label={TEXT.PATIENT}
                required={false}
                placeholder={TEXT.PATIENT_PLACEHOLDER}
                limit={CASHIER_PATIENT_OPTION_LIMIT}
                limitText={TEXT.PATIENT_NARROW}
            />
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
                {plansFailed ? (
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

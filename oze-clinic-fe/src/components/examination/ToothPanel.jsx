import { useId, useState } from "react";
import { TOOTH_STATES, TOOTH_STATE_SEVERITY_MAX, isPrimaryTooth, surfacesText, toothLabel } from "@/utils/examination";
import RowActions from "./RowActions";
import { ConditionField, NoteField, SurfacePicker } from "./ToothEntryFields";

const EMPTY_FORM = { condition: "", surfaces: [], note: "", replaced: false };

// "Trạng thái răng": the tooth's standard state on the chart, kept for the next visits. Saved at once (onSave), and a
// state set in this visit can be undone (onReset), which brings back the one from an earlier visit, if any.
// state: { condition, severity, current } or none. Mounted again (key) whenever the saved state changes.
const ToothStateForm = ({ tooth, state, busy, onSave, onReset }) => {
    const conditionId = useId();
    const severityId = useId();
    const [condition, setCondition] = useState(state?.condition ?? "");
    const [severity, setSeverity] = useState(state?.current ? (state.severity ?? "") : "");
    const changed = condition && (condition !== state?.condition || !state?.current || severity !== (state.severity ?? ""));

    return (
        <div className="flex flex-col gap-3 rounded-[10px] border border-border px-3 py-2.5">
            <p className="text-caption font-semibold text-ink">
                Trạng thái răng
                {state && !state.current && <span className="font-normal text-muted"> · lần khám trước: {TOOTH_STATES[state.condition]?.label ?? state.condition}</span>}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="field min-w-0 flex-1">
                    <label htmlFor={conditionId} className="label">
                        Trạng thái
                    </label>
                    <select id={conditionId} className="input" value={condition} onChange={(event) => setCondition(event.target.value)}>
                        <option value="">Chưa ghi trạng thái</option>
                        {Object.entries(TOOTH_STATES).map(([key, meta]) => (
                            <option key={key} value={key}>
                                {meta.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field sm:w-36">
                    <label htmlFor={severityId} className="label">
                        Mức độ
                    </label>
                    <input
                        id={severityId}
                        className="input"
                        maxLength={TOOTH_STATE_SEVERITY_MAX}
                        placeholder="Ví dụ: Nhẹ"
                        value={severity}
                        onChange={(event) => setSeverity(event.target.value)}
                        // Enter here must not submit the findings form this block sits in
                        onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
                    />
                </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2.5">
                {state?.current && (
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={onReset}>
                        Hoàn tác thay đổi lần này
                    </button>
                )}
                <button type="button" className="btn btn-secondary" disabled={busy || !changed} onClick={() => onSave({ condition, severity })}>
                    {busy && <span className="btn-spinner" aria-hidden="true" />}
                    Lưu trạng thái răng {tooth}
                </button>
            </div>
        </div>
    );
};

// Panel of the selected tooth: its standard state on the chart (onSetState / onResetState, saved at once), the findings
// already recorded in this visit (edit / delete) and a form to add another one.
// entries: findings of this tooth. onAdd receives { tooth, condition, surfaces, note, replaced? }.
// state: { condition, severity, current } of the chart, or none; stateBusy: a state change is on its way.
const ToothPanel = ({ tooth, entries = [], state, stateBusy = false, onSetState, onResetState, onAdd, onEdit, onRemove, onClose }) => {
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState("");
    const primary = isPrimaryTooth(tooth);
    const update = (changes) => setForm((current) => ({ ...current, ...changes }));

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!form.condition.trim()) {
            setError("Nhập tình trạng của răng.");
            return;
        }
        onAdd({ tooth, condition: form.condition.trim(), surfaces: form.surfaces, note: form.note.trim(), ...(primary && { replaced: form.replaced }) });
        setForm(EMPTY_FORM);
        setError("");
    };

    return (
        <form noValidate onSubmit={handleSubmit} aria-label={`Ghi nhận răng ${tooth}`} className="flex flex-col gap-3 rounded-xl border border-primary bg-canvas p-4">
            <p>
                <b className="font-semibold text-ink">Răng {tooth}</b> <span className="text-muted">· {toothLabel(tooth)}</span>
            </p>

            {onSetState && (
                <ToothStateForm
                    key={`${state?.condition ?? ""}-${state?.severity ?? ""}-${Boolean(state?.current)}`}
                    tooth={tooth}
                    state={state}
                    busy={stateBusy}
                    onSave={onSetState}
                    onReset={onResetState}
                />
            )}

            {entries.length > 0 && (
                <div className="flex flex-col gap-2 rounded-[10px] border border-border px-3 py-2.5">
                    <p className="text-caption font-semibold text-ink">Tình trạng đã ghi nhận ({entries.length})</p>
                    <ul className="flex flex-col gap-2">
                        {entries.map((entry) => (
                            <li key={entry.id} className="flex flex-wrap items-center gap-2">
                                <span className="shrink-0 rounded-full bg-surface-tint px-2 py-0.5 text-caption font-medium text-body">{entry.condition}</span>
                                <span className="min-w-0 flex-1 text-caption text-muted">
                                    Mặt {surfacesText(entry.surfaces)}
                                    {entry.note && ` · ${entry.note}`}
                                    {entry.replaced && " · Đã thay răng vĩnh viễn"}
                                </span>
                                <RowActions label={`${entry.condition} răng ${tooth}`} onEdit={() => onEdit(entry)} onRemove={() => onRemove(entry)} />
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className="text-caption font-semibold tracking-wide text-muted uppercase">{entries.length > 0 ? "Thêm ghi nhận khác" : "Ghi nhận khi khám"}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
                <ConditionField
                    value={form.condition}
                    error={error}
                    onChange={(condition) => {
                        update({ condition });
                        if (error) setError("");
                    }}
                />
                <SurfacePicker label={primary ? "Mặt răng (chọn nhiều)" : "Mặt răng"} value={form.surfaces} onChange={(surfaces) => update({ surfaces })} />
            </div>
            {primary && (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-surface-tint px-3 py-2.5 text-body-sm text-ink">
                    <input type="checkbox" className="size-4" checked={form.replaced} onChange={(event) => update({ replaced: event.target.checked })} />
                    Răng này đã được thay bằng răng vĩnh viễn
                </label>
            )}
            <NoteField label="Mô tả tình trạng" value={form.note} onChange={(note) => update({ note })} />
            <div className="flex flex-wrap justify-end gap-2.5">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Bỏ chọn răng
                </button>
                <button type="submit" className="btn btn-primary">
                    Thêm tình trạng
                </button>
            </div>
        </form>
    );
};

export default ToothPanel;

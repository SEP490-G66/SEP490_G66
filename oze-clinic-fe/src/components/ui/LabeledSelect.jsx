const LabeledSelect = ({ id, label, value, options, onChange }) => (
    <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-caption text-muted">
            {label}
        </label>
        <select id={id} className="input w-auto min-w-40" value={value} onChange={(event) => onChange(event.target.value)}>
            {options.map(([optionValue, optionLabel]) => (
                <option key={optionValue} value={optionValue}>
                    {optionLabel}
                </option>
            ))}
        </select>
    </div>
);

export default LabeledSelect;

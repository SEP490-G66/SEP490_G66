import { cx } from "@/utils/cx";

// Filter dropdown with its name above the box ("Vai trò") and only the values inside ("Tất cả", "Bác sĩ").
// options: [{ value, label }]; "" is the "Tất cả" choice. className sets the width of the whole field, which fits the longest option by default.
const FilterSelect = ({ id, label, options, value, onChange, allLabel = "Tất cả", className = "w-auto min-w-40" }) => (
    <div className={cx("field", className)}>
        <label htmlFor={id} className="label">
            {label}
        </label>
        <select id={id} className="input" value={value} onChange={(event) => onChange(event.target.value)}>
            <option value="">{allLabel}</option>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    </div>
);

export default FilterSelect;

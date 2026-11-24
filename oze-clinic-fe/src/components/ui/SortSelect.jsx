import { cx } from "@/utils/cx";

// "Sắp xếp" dropdown of a list page's filter row (no "Tất cả" choice, unlike FilterSelect).
const SortSelect = ({ id, label = "Sắp xếp", options, value, onChange, className = "w-full sm:w-auto sm:min-w-48" }) => (
    <div className={cx("field", className)}>
        <label htmlFor={id} className="label">
            {label}
        </label>
        <select id={id} className="input" value={value} onChange={(event) => onChange(event.target.value)}>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    </div>
);

export default SortSelect;

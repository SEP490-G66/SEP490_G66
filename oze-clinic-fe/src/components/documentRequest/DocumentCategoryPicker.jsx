import { FileText, FlaskConical, Folder, Pill, ScanLine } from "lucide-react";
import { PROVIDED_DOCUMENT_CATEGORIES } from "@/utils/constants/providedDocument";
import { cx } from "@/utils/cx";

export const CATEGORY_ICONS = { Imaging: ScanLine, LabResult: FlaskConical, Prescription: Pill, MedicalPaper: FileText, Other: Folder };

// "Loại tài liệu": one tile per type with its icon, shared by the patient's upload form and the doctor's request.
// value: a PROVIDED_DOCUMENT_CATEGORIES value. disabled: shown but fixed (the doctor already chose it).
const DocumentCategoryPicker = ({ id, value, onChange, error, disabled = false, label = "Loại tài liệu" }) => (
    <fieldset className="field" aria-describedby={error ? `${id}-error` : undefined}>
        <legend className="label label-required">{label}</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PROVIDED_DOCUMENT_CATEGORIES.map((category) => {
                const Icon = CATEGORY_ICONS[category.value];
                const checked = value === category.value;
                const inputId = `${id}-${category.value}`;
                return (
                    <label
                        key={category.value}
                        htmlFor={inputId}
                        className={cx(
                            "flex flex-col items-center gap-2 rounded-md border px-2 py-3 text-center text-body-sm has-[:focus-visible]:shadow-focus",
                            checked ? "border-primary bg-primary-softer font-semibold text-primary" : "border-border text-ink",
                            disabled ? (checked ? "" : "opacity-50") : "cursor-pointer hover:border-border-strong",
                        )}
                    >
                        <input
                            id={inputId}
                            type="radio"
                            name={id}
                            value={category.value}
                            checked={checked}
                            disabled={disabled}
                            onChange={() => onChange(category.value)}
                            className="sr-only"
                        />
                        <span className={cx("grid size-9 place-items-center rounded-md", checked ? "bg-canvas" : "bg-surface-tint")}>
                            <Icon className="size-5" aria-hidden="true" />
                        </span>
                        {category.label}
                    </label>
                );
            })}
        </div>
        {error && (
            <p id={`${id}-error`} role="alert" className="error-text">
                {error}
            </p>
        )}
    </fieldset>
);

export default DocumentCategoryPicker;

import { cx } from "@/utils/cx";
import { CONFIG_DATA_TYPES as DATA_TYPES } from "@/utils/constants/systemConfig";

// Value field of one setting. config: { key, label, dataType: "int" | "time" | "text", unit?, min?, max?, maxLength? }.
// An int shows its unit ("ngày", "giờ", "phút") inside the box; a time is "HH:mm". value is always a string.
const ConfigValueInput = ({ id, config, value, onChange, invalid = false, describedBy }) => {
    const shared = {
        id,
        value,
        "aria-label": config.label,
        "aria-invalid": invalid || undefined,
        "aria-describedby": describedBy,
        onChange: (event) => onChange(event.target.value),
    };

    if (config.dataType === DATA_TYPES.TIME) {
        return <input {...shared} type="time" className="input num" />;
    }

    if (config.dataType === DATA_TYPES.TEXT) {
        return <input {...shared} type="text" className="input" maxLength={config.maxLength} />;
    }

    return (
        <div className="relative">
            <input
                {...shared}
                type="number"
                inputMode="numeric"
                step={1}
                min={config.min}
                max={config.max}
                className={cx("input num", config.unit && "pr-14")}
            />
            {config.unit && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted" aria-hidden="true">
                    {config.unit}
                </span>
            )}
        </div>
    );
};

export default ConfigValueInput;

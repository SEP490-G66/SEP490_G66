import { CONFIG_DATA_TYPES, CONFIG_FIELDS, CONFIG_GROUPS, OTHER_GROUP, WORK_END_KEY, WORK_START_KEY } from "../utils/constants/systemConfig";
import api from "./api";
import { call } from "./receptionService";

// System settings (api/system-configs, ClinicManager only). The backend saves one setting per call and checks
// each value; the page saves every changed setting at once, so this service sends one PUT per change.

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const WHOLE_NUMBER_PATTERN = /^\d+$/;
const MAX_VALUE_LENGTH = 500;

// Texts of ErrorConstants.SystemConfigMessage.
const MESSAGES = {
    "Configuration not found.": "Cấu hình này không còn tồn tại.",
    "Please enter a value.": "Vui lòng nhập giá trị.",
    "Value cannot exceed 500 characters.": "Giá trị không được quá 500 ký tự.",
    "Value must be a whole number greater than or equal to 0.": "Vui lòng nhập số nguyên lớn hơn hoặc bằng 0.",
    "Value must be greater than 0.": "Giá trị phải lớn hơn 0.",
    "Value must be true or false.": "Giá trị phải là true hoặc false.",
    "Value must be a number.": "Vui lòng nhập số.",
    "Value must be valid JSON.": "Giá trị phải là JSON hợp lệ.",
    "Value must be a time in HH:mm format.": "Giờ không hợp lệ (HH:mm).",
    "Opening time must be earlier than closing time.": "Giờ đóng cửa phải sau giờ mở cửa.",
    "No active service has this code.": "Không có dịch vụ đang hoạt động nào có mã này.",
};

const toVietnamese = (message) => MESSAGES[message] ?? message ?? "Có lỗi xảy ra, vui lòng thử lại sau.";

// What ConfigSection needs of a setting. A key the page does not know is shown by its key in "Khác".
const toConfig = (item) => {
    const field = CONFIG_FIELDS[item.key];
    if (field) return { key: item.key, ...field };
    return {
        key: item.key,
        group: OTHER_GROUP,
        label: item.key,
        dataType: item.dataType === "Int" ? CONFIG_DATA_TYPES.INT : CONFIG_DATA_TYPES.TEXT,
        min: item.dataType === "Int" ? 0 : undefined,
        maxLength: MAX_VALUE_LENGTH,
    };
};

// Error message of one value, or null.
const valueError = (config, value) => {
    const text = (value ?? "").trim();
    if (!text) return "Vui lòng nhập giá trị.";
    if (config.dataType === CONFIG_DATA_TYPES.TIME) return TIME_PATTERN.test(text) ? null : "Giờ không hợp lệ (HH:mm).";
    if (config.dataType === CONFIG_DATA_TYPES.TEXT) return text.length > (config.maxLength ?? MAX_VALUE_LENGTH) ? "Giá trị quá dài." : null;
    if (!WHOLE_NUMBER_PATTERN.test(text)) return "Vui lòng nhập số nguyên.";
    const number = Number(text);
    if ((config.min !== undefined && number < config.min) || (config.max !== undefined && number > config.max)) {
        return config.max === undefined ? `Giá trị phải từ ${config.min} trở lên.` : `Giá trị phải từ ${config.min} đến ${config.max}.`;
    }
    return null;
};

// Errors of the values of configs as { [key]: message }; empty when everything is valid.
export const validateSystemConfigs = (values, configs) => {
    const errors = {};
    for (const config of configs) {
        const error = valueError(config, values[config.key]);
        if (error) errors[config.key] = error;
    }
    if (!errors[WORK_START_KEY] && !errors[WORK_END_KEY] && values[WORK_START_KEY] && values[WORK_END_KEY] && values[WORK_END_KEY] <= values[WORK_START_KEY]) {
        errors[WORK_END_KEY] = "Giờ đóng cửa phải sau giờ mở cửa.";
    }
    return errors;
};

// Settings by group: { groups: [{ key, title, configs }], values: { [key]: string } }.
export const getSystemConfigs = async () => {
    const result = await call(() => api.get("/api/system-configs"));
    if (!result.success) return { ...result, message: toVietnamese(result.message) };

    const configs = result.data.map(toConfig);
    const groups = CONFIG_GROUPS.map((group) => ({ ...group, configs: configs.filter((config) => config.group === group.key) })).filter(
        (group) => group.configs.length > 0,
    );
    return { ...result, data: { groups, values: Object.fromEntries(result.data.map((item) => [item.key, item.value])) } };
};

const saveOne = (key, value) => call(() => api.put(`/api/system-configs/${encodeURIComponent(key)}`, { value: value.trim() }));

// Saves the settings whose value differs from saved, one call each.
// Returns { success, data: the stored values after the saves, errors: { [key]: message } for the refused ones }.
// The backend checks the opening hours against the stored other one, so a refused opening / closing time is tried
// once more after the others: moving both later (08:00–17:00 -> 18:00–22:00) only works closing time first.
export const saveSystemConfigs = async (values, saved) => {
    const stored = { ...saved };
    const errors = {};
    const changed = Object.keys(values).filter((key) => values[key] !== saved[key]);

    const save = async (key) => {
        const result = await saveOne(key, values[key]);
        if (result.success) {
            stored[key] = result.data.value;
            delete errors[key];
        } else {
            errors[key] = toVietnamese(result.message);
        }
    };

    for (const key of changed) await save(key);
    for (const key of [WORK_START_KEY, WORK_END_KEY].filter((key) => errors[key])) await save(key);

    const failed = Object.keys(errors).length;
    return {
        success: failed === 0,
        data: stored,
        errors: failed ? errors : null,
        message: failed ? `Không lưu được ${failed} cấu hình, vui lòng kiểm tra lại.` : "Lưu cấu hình thành công!",
    };
};

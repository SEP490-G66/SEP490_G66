import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "react-toastify";
import ConfigActionBar from "@/components/config/ConfigActionBar";
import ConfigSection from "@/components/config/ConfigSection";
import SaveConfigPopup from "@/components/popup/config/SaveConfigPopup";
import SearchInput from "@/components/ui/SearchInput";
import { getSystemConfigs, saveSystemConfigs, validateSystemConfigs } from "@/services/systemConfigService";
import { normalizeText } from "@/utils/format";

const SKELETON_SECTION_COUNT = 3;

// Clinic manager's "Cấu hình hệ thống": edit the SystemConfigurations values, then confirm and save them all at once.
const SystemSettings = () => {
    const [groups, setGroups] = useState(null);
    const [saved, setSaved] = useState({});
    const [values, setValues] = useState({});
    const [keyword, setKeyword] = useState("");
    // Errors show from the first "Lưu cấu hình" on, then follow every edit.
    const [showErrors, setShowErrors] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [saving, setSaving] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
        getSystemConfigs().then((result) => {
            if (!result.success) {
                setLoadError(result.message || "Không tải được cấu hình. Vui lòng thử lại sau.");
                return;
            }
            setGroups(result.data.groups);
            setSaved(result.data.values);
            setValues(result.data.values);
        });
    }, []);

    const configs = groups?.flatMap((group) => group.configs) ?? [];
    const changes = configs.filter((config) => values[config.key] !== saved[config.key]).map((config) => ({ config, value: values[config.key] }));
    const errors = showErrors ? { ...serverErrors, ...validateSystemConfigs(values, configs) } : {};

    const search = normalizeText(keyword);
    const matches = (config) => !search || [config.label, config.key].some((text) => normalizeText(text).includes(search));
    const shownGroups = (groups ?? []).map((group) => ({ ...group, configs: group.configs.filter(matches) })).filter((group) => group.configs.length > 0);

    const change = (key, value) => {
        setValues((current) => ({ ...current, [key]: value }));
        setServerErrors((current) => ({ ...current, [key]: undefined }));
    };

    const revert = (key) => change(key, saved[key]);

    const discard = () => {
        setValues(saved);
        setShowErrors(false);
        setServerErrors({});
    };

    const requestSave = () => {
        const nextErrors = validateSystemConfigs(values, configs);
        setShowErrors(true);
        const firstInvalid = configs.find((config) => nextErrors[config.key]);
        if (firstInvalid) {
            // A field hidden by the search cannot be focused, so clear the search first.
            setKeyword("");
            setTimeout(() => document.getElementById(`config-${firstInvalid.key}`)?.focus());
            return;
        }
        setConfirming(true);
    };

    const save = async () => {
        setSaving(true);
        const response = await saveSystemConfigs(values, saved);
        setSaving(false);
        setConfirming(false);
        if (!response.success) {
            // The settings that did save are stored now; the refused ones keep what was typed, with the reason
            setSaved(response.data);
            setServerErrors(response.errors ?? {});
            toast.error(response.message);
            return;
        }
        setSaved(response.data);
        setValues(response.data);
        setShowErrors(false);
        setServerErrors({});
        toast.success(response.message);
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="page-header mb-0 items-center">
                <div>
                    <h1 className="page-title">Cấu hình hệ thống</h1>
                </div>
            </div>

            <SearchInput
                id="config-search"
                label="Tìm cấu hình"
                placeholder="Tìm theo tên hoặc ConfigKey"
                value={keyword}
                onChange={setKeyword}
                className="w-full sm:w-80"
            />

            {loadError && (
                <p role="alert" className="alert alert-danger">
                    {loadError}
                </p>
            )}

            {!groups &&
                !loadError &&
                Array.from({ length: SKELETON_SECTION_COUNT }, (_, index) => (
                    <div key={index} className="skeleton h-40 w-full" aria-hidden="true" />
                ))}

            {groups && shownGroups.length === 0 && (
                <div className="card-app empty-state">
                    <SlidersHorizontal className="empty-state-icon" aria-hidden="true" />
                    <p className="empty-state-title">Không tìm thấy cấu hình phù hợp</p>
                    <p className="empty-state-text">Thử đổi từ khóa tìm kiếm.</p>
                </div>
            )}

            {shownGroups.map((group) => (
                <ConfigSection
                    key={group.key}
                    title={group.title}
                    configs={group.configs}
                    values={values}
                    savedValues={saved}
                    errors={errors}
                    onChange={change}
                    onRevert={revert}
                />
            ))}

            {groups && <ConfigActionBar hasChanges={changes.length > 0} saving={saving} onDiscard={discard} onSave={requestSave} />}

            {confirming && <SaveConfigPopup changes={changes} saving={saving} onClose={() => setConfirming(false)} onConfirm={save} />}
        </div>
    );
};

export default SystemSettings;

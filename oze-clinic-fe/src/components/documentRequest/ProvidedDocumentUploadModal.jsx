import { useState } from "react";
import ManualUploadDialog from "@/components/imagingTechnician/ManualUploadDialog";
import FormField from "@/components/ui/FormField";
import {
    PROVIDED_DOCUMENT_ADDRESS_MAX,
    PROVIDED_DOCUMENT_CATEGORIES,
    PROVIDED_DOCUMENT_EXTENSIONS,
    PROVIDED_DOCUMENT_MAX_FILES,
    PROVIDED_DOCUMENT_MAX_MB,
    PROVIDED_DOCUMENT_NAME_MAX,
    PROVIDED_DOCUMENT_NOTE_MAX,
} from "@/utils/constants/providedDocument";
import { cx } from "@/utils/cx";
import { getClinicToday } from "@/utils/format";

const NAME_ID = "provided-document-name";
const CATEGORY_ID = "provided-document-category";
const DATE_ID = "provided-document-date";
const ADDRESS_ID = "provided-document-address";
const NOTE_ID = "provided-document-note";

// "phim_x-quang_12.11.pdf" -> "Phim x quang 12.11"
const nameFromFile = (fileName) => {
    const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, PROVIDED_DOCUMENT_NAME_MAX);
};

// "Tải lên tài liệu": files first, then the name (filled from the first file until the patient edits it), the type,
// where and when it was done (both optional) and a note for the doctor. The document goes to the patient's record,
// so every doctor sees it at every visit. onSubmit({ documentName, category, performedOn, providerAddress, note, files }).
const ProvidedDocumentUploadModal = ({ onSubmit, onClose }) => {
    const [today] = useState(getClinicToday);
    const [values, setValues] = useState({ documentName: "", category: "", performedOn: "", providerAddress: "", note: "" });
    const [nameEdited, setNameEdited] = useState(false);
    const [errors, setErrors] = useState({});

    const set = (key, value) => {
        setValues((current) => ({ ...current, [key]: value }));
        setErrors((current) => ({ ...current, [key]: null }));
    };

    const filesChanged = (files) => {
        if (nameEdited) return;
        set("documentName", files.length ? nameFromFile(files[0].name) : "");
    };

    const validate = () => {
        const next = {
            documentName: values.documentName.trim() ? null : "Nhập tên tài liệu.",
            category: values.category ? null : "Chọn loại tài liệu.",
            performedOn: values.performedOn && values.performedOn > today ? "Ngày thực hiện không được sau hôm nay." : null,
        };
        setErrors(next);
        const first = [[NAME_ID, next.documentName], [`${CATEGORY_ID}-${PROVIDED_DOCUMENT_CATEGORIES[0].value}`, next.category], [DATE_ID, next.performedOn]].find(([, error]) => error);
        if (first) document.getElementById(first[0])?.focus();
        return !first;
    };

    const field = (id, key, error) => ({
        id,
        className: "input",
        value: values[key],
        onChange: (event) => set(key, event.target.value),
        "aria-invalid": Boolean(error) || undefined,
        "aria-describedby": error ? `${id}-error` : undefined,
    });

    return (
        <ManualUploadDialog
            title="Tải lên tài liệu"
            subtitle="Tài liệu lưu trong hồ sơ của bạn, bác sĩ xem được ở mọi lần khám."
            extensions={PROVIDED_DOCUMENT_EXTENSIONS}
            maxMb={PROVIDED_DOCUMENT_MAX_MB}
            maxFiles={PROVIDED_DOCUMENT_MAX_FILES}
            fileLabel="tệp"
            withNote={false}
            fieldsAfterFiles
            onFilesChange={filesChanged}
            submitLabel="Gửi cho bác sĩ"
            validate={validate}
            onSubmit={({ files }) => onSubmit({ ...values, files })}
            onClose={onClose}
        >
            <FormField id={NAME_ID} label="Tên tài liệu" required error={errors.documentName}>
                <input
                    {...field(NAME_ID, "documentName", errors.documentName)}
                    onChange={(event) => {
                        setNameEdited(true);
                        set("documentName", event.target.value);
                    }}
                    maxLength={PROVIDED_DOCUMENT_NAME_MAX}
                    placeholder="Ví dụ: Phim X-quang toàn cảnh"
                />
                {!nameEdited && values.documentName && <p className="text-caption text-muted">Tự điền theo tên tệp, bạn có thể sửa.</p>}
            </FormField>

            <fieldset className="field" aria-describedby={errors.category ? `${CATEGORY_ID}-error` : undefined}>
                <legend className="label label-required">Loại tài liệu</legend>
                <div className="flex flex-wrap gap-2">
                    {PROVIDED_DOCUMENT_CATEGORIES.map((category) => {
                        const id = `${CATEGORY_ID}-${category.value}`;
                        const checked = values.category === category.value;
                        return (
                            <label
                                key={category.value}
                                htmlFor={id}
                                className={cx(
                                    "cursor-pointer rounded-md border px-3 py-2 text-body-sm has-[:focus-visible]:shadow-focus",
                                    checked ? "border-primary bg-primary-softer font-semibold text-primary" : "border-border text-ink hover:border-border-strong",
                                )}
                            >
                                <input
                                    id={id}
                                    type="radio"
                                    name={CATEGORY_ID}
                                    value={category.value}
                                    checked={checked}
                                    onChange={() => set("category", category.value)}
                                    className="sr-only"
                                />
                                {category.label}
                            </label>
                        );
                    })}
                </div>
                {errors.category && (
                    <p id={`${CATEGORY_ID}-error`} role="alert" className="error-text">
                        {errors.category}
                    </p>
                )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField id={DATE_ID} label="Ngày thực hiện" error={errors.performedOn}>
                    <input {...field(DATE_ID, "performedOn", errors.performedOn)} type="date" max={today} />
                </FormField>
                <FormField id={ADDRESS_ID} label="Nơi thực hiện">
                    <input {...field(ADDRESS_ID, "providerAddress")} maxLength={PROVIDED_DOCUMENT_ADDRESS_MAX} placeholder="Ví dụ: Bệnh viện Bạch Mai" />
                </FormField>
            </div>

            <FormField id={NOTE_ID} label="Ghi chú cho bác sĩ">
                <textarea
                    {...field(NOTE_ID, "note")}
                    rows={3}
                    maxLength={PROVIDED_DOCUMENT_NOTE_MAX}
                    className="input h-auto min-h-20 py-2"
                    placeholder="Ví dụ: Phim chụp ở bệnh viện trước khi nhổ răng khôn"
                />
            </FormField>

            <p className="text-caption text-muted">Chỉ bác sĩ của phòng khám xem được tài liệu này.</p>
        </ManualUploadDialog>
    );
};

export default ProvidedDocumentUploadModal;

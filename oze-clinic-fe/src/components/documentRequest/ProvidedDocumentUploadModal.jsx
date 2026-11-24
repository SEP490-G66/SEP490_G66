import { useState } from "react";
import ManualUploadDialog from "@/components/imagingTechnician/ManualUploadDialog";
import FormField from "@/components/ui/FormField";
import {
    PROVIDED_DOCUMENT_ADDRESS_MAX,
    PROVIDED_DOCUMENT_EXTENSIONS,
    PROVIDED_DOCUMENT_MAX_FILES,
    PROVIDED_DOCUMENT_MAX_MB,
    PROVIDED_DOCUMENT_NAME_MAX,
} from "@/utils/constants/providedDocument";
import { getClinicToday } from "@/utils/format";

const NAME_ID = "provided-document-name";
const DATE_ID = "provided-document-date";
const ADDRESS_ID = "provided-document-address";

// "Tải lên tài liệu" (Figma 1242:4348): name, performed date, provider address and up to 5 files.
// onSubmit({ documentName, performedOn, providerAddress, files }) — the parent sends it and closes on success.
const ProvidedDocumentUploadModal = ({ onSubmit, onClose }) => {
    const [today] = useState(getClinicToday);
    const [values, setValues] = useState({ documentName: "", performedOn: "", providerAddress: "" });
    const [errors, setErrors] = useState({});

    const change = (key) => (event) => {
        setValues((current) => ({ ...current, [key]: event.target.value }));
        setErrors((current) => ({ ...current, [key]: null }));
    };

    const validate = () => {
        const next = {
            documentName: values.documentName.trim() ? null : "Nhập tên tài liệu.",
            performedOn: values.performedOn && values.performedOn > today ? "Ngày thực hiện không được sau hôm nay." : null,
            providerAddress: values.providerAddress.trim() ? null : "Nhập địa chỉ cung cấp.",
        };
        setErrors(next);
        const first = [[NAME_ID, next.documentName], [DATE_ID, next.performedOn], [ADDRESS_ID, next.providerAddress]].find(([, error]) => error);
        if (first) document.getElementById(first[0])?.focus();
        return !first;
    };

    const field = (id, key, error) => ({
        id,
        className: "input",
        value: values[key],
        onChange: change(key),
        "aria-invalid": Boolean(error) || undefined,
        "aria-describedby": error ? `${id}-error` : undefined,
    });

    return (
        <ManualUploadDialog
            title="Tải lên tài liệu"
            extensions={PROVIDED_DOCUMENT_EXTENSIONS}
            maxMb={PROVIDED_DOCUMENT_MAX_MB}
            maxFiles={PROVIDED_DOCUMENT_MAX_FILES}
            fileLabel="tệp"
            withNote={false}
            validate={validate}
            onSubmit={({ files }) => onSubmit({ ...values, files })}
            onClose={onClose}
        >
            <FormField id={NAME_ID} label="Tên tài liệu" required error={errors.documentName}>
                <input {...field(NAME_ID, "documentName", errors.documentName)} maxLength={PROVIDED_DOCUMENT_NAME_MAX} placeholder="Ví dụ: Xét nghiệm công thức máu" />
            </FormField>
            <FormField id={DATE_ID} label="Ngày thực hiện" error={errors.performedOn}>
                <input {...field(DATE_ID, "performedOn", errors.performedOn)} type="date" max={today} />
            </FormField>
            <FormField id={ADDRESS_ID} label="Địa chỉ cung cấp" required error={errors.providerAddress}>
                <input {...field(ADDRESS_ID, "providerAddress", errors.providerAddress)} maxLength={PROVIDED_DOCUMENT_ADDRESS_MAX} placeholder="Ví dụ: Bệnh viện Bạch Mai – 78 Giải Phóng, Hà Nội" />
            </FormField>
            <p className="label label-required mb-0">Tệp đính kèm</p>
        </ManualUploadDialog>
    );
};

export default ProvidedDocumentUploadModal;

import { useState } from "react";
import DocumentCategoryPicker from "@/components/documentRequest/DocumentCategoryPicker";
import ManualUploadDialog from "@/components/imagingTechnician/ManualUploadDialog";
import FormField from "@/components/ui/FormField";
import { DOCUMENT_UPLOAD_EXTENSIONS, DOCUMENT_UPLOAD_MAX_FILES } from "@/utils/constants/documentRequest";
import {
    PROVIDED_DOCUMENT_ADDRESS_MAX,
    PROVIDED_DOCUMENT_EXTENSIONS,
    PROVIDED_DOCUMENT_MAX_FILES,
    PROVIDED_DOCUMENT_MAX_MB,
    PROVIDED_DOCUMENT_NAME_MAX,
    PROVIDED_DOCUMENT_NOTE_MAX,
    doctorTitle,
} from "@/utils/constants/providedDocument";
import { formatDate, getClinicToday } from "@/utils/format";

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

// "Tải lên tài liệu", the same form for both ways of sending:
// - request null: a document the patient brings on their own; it goes to their record, shared by every visit;
// - request (a DocumentRequestResponse): the document a doctor asked for at one visit; its name and type are the
//   doctor's and cannot be changed, the files go to that visit only.
// Files first, then name, type, where and when it was done and a note for the doctor (the note is optional).
// onSubmit({ documentName, category, performedOn, providerAddress, note, files }).
const ProvidedDocumentUploadModal = ({ request = null, onSubmit, onClose }) => {
    const [today] = useState(getClinicToday);
    const [values, setValues] = useState({
        documentName: request?.documentName ?? "",
        category: request?.category ?? "",
        performedOn: "",
        providerAddress: "",
        note: "",
    });
    const [nameEdited, setNameEdited] = useState(Boolean(request));
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
            performedOn: !values.performedOn ? "Chọn ngày thực hiện." : values.performedOn > today ? "Ngày thực hiện không được sau hôm nay." : null,
            providerAddress: values.providerAddress.trim() ? null : "Nhập nơi thực hiện.",
        };
        setErrors(next);
        const first = [
            [NAME_ID, next.documentName],
            [`${CATEGORY_ID}-Imaging`, next.category],
            [DATE_ID, next.performedOn],
            [ADDRESS_ID, next.providerAddress],
        ].find(([, error]) => error);
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

    const visit = request?.examinationDate ? `lần khám ${formatDate(request.examinationDate)}` : "lần khám đã yêu cầu";

    return (
        <ManualUploadDialog
            title={request ? `Gửi tài liệu cho ${visit}` : "Tải lên tài liệu"}
            subtitle={request ? `Theo yêu cầu của ${doctorTitle(request.doctorName)}` : undefined}
            extensions={request ? DOCUMENT_UPLOAD_EXTENSIONS : PROVIDED_DOCUMENT_EXTENSIONS}
            maxMb={PROVIDED_DOCUMENT_MAX_MB}
            maxFiles={request ? DOCUMENT_UPLOAD_MAX_FILES : PROVIDED_DOCUMENT_MAX_FILES}
            fileLabel="tệp"
            withNote={false}
            withImagePicker
            fieldsAfterFiles
            onFilesChange={filesChanged}
            submitLabel="Gửi cho bác sĩ"
            validate={validate}
            onSubmit={({ files }) => onSubmit({ ...values, files })}
            onClose={onClose}
        >
            {request?.note && (
                <p className="rounded-md bg-primary-softer px-3 py-2 text-body-sm text-ink">
                    <span className="font-semibold">Bác sĩ dặn: </span>
                    {request.note}
                </p>
            )}

            <FormField id={NAME_ID} label="Tên tài liệu" error={errors.documentName}>
                <input
                    {...field(NAME_ID, "documentName", errors.documentName)}
                    readOnly={Boolean(request)}
                    onChange={(event) => {
                        setNameEdited(true);
                        set("documentName", event.target.value);
                    }}
                    maxLength={PROVIDED_DOCUMENT_NAME_MAX}
                />
            </FormField>

            <DocumentCategoryPicker id={CATEGORY_ID} value={values.category} onChange={(value) => set("category", value)} error={errors.category} disabled={Boolean(request)} marked={false} />

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField id={DATE_ID} label="Ngày thực hiện" error={errors.performedOn}>
                    <input {...field(DATE_ID, "performedOn", errors.performedOn)} type="date" max={today} />
                </FormField>
                <FormField id={ADDRESS_ID} label="Nơi thực hiện" error={errors.providerAddress}>
                    <input {...field(ADDRESS_ID, "providerAddress", errors.providerAddress)} maxLength={PROVIDED_DOCUMENT_ADDRESS_MAX} />
                </FormField>
            </div>

            <FormField id={NOTE_ID} label="Ghi chú cho bác sĩ">
                <textarea {...field(NOTE_ID, "note")} rows={3} maxLength={PROVIDED_DOCUMENT_NOTE_MAX} className="input h-auto min-h-20 py-2" />
            </FormField>
        </ManualUploadDialog>
    );
};

export default ProvidedDocumentUploadModal;

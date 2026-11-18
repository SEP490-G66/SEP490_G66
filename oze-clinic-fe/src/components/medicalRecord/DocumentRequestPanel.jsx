import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import DocumentRequestList from "@/components/documentRequest/DocumentRequestList";
import ManualUploadDialog from "@/components/imagingTechnician/ManualUploadDialog";
import { getMyDocumentRequests, submitDocumentFiles } from "@/services/documentRequestService";
import { DOCUMENT_UPLOAD_EXTENSIONS, DOCUMENT_UPLOAD_MAX_FILES, DOCUMENT_UPLOAD_MAX_MB } from "@/utils/constants/documentRequest";

// "Tài liệu bác sĩ yêu cầu" of one visit in the medical book: the patient uploads the files the doctor asked for,
// also after the visit ended. Nothing is shown when the visit has no request.
const DocumentRequestPanel = ({ examinationId }) => {
    const [loaded, setLoaded] = useState({ examinationId: null, requests: [], error: null });
    const [uploading, setUploading] = useState(null);

    useEffect(() => {
        let active = true;
        getMyDocumentRequests(examinationId).then((response) => {
            if (active)
                setLoaded(
                    response.success
                        ? { examinationId, requests: response.data, error: null }
                        : { examinationId, requests: [], error: response.message || "Không tải được tài liệu bác sĩ yêu cầu." },
                );
        });
        return () => {
            active = false;
        };
    }, [examinationId]);

    const current = loaded.examinationId === examinationId;
    const requests = current ? loaded.requests : [];
    if (current && loaded.error) {
        return (
            <section className="card-app">
                <h2 className="card-title">Tài liệu bác sĩ yêu cầu</h2>
                <p role="alert" className="error-text mt-1">
                    {loaded.error}
                </p>
            </section>
        );
    }
    if (!requests.length) return null;

    const upload = async ({ files }) => {
        const response = await submitDocumentFiles(uploading.id, files);
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        setLoaded((current) => ({ ...current, requests: current.requests.map((item) => (item.id === response.data.id ? response.data : item)) }));
        setUploading(null);
        toast.success(response.message);
    };

    return (
        <section className="card-app p-0">
            <div className="px-5 pt-4 pb-3">
                <h2 className="card-title">Tài liệu bác sĩ yêu cầu</h2>
                <p className="text-caption text-muted">Tải lên file .pdf hoặc ảnh chụp tài liệu. Bạn có thể nộp thêm sau khi đã nộp.</p>
            </div>
            <DocumentRequestList requests={requests} onUpload={setUploading} />
            {uploading && (
                <ManualUploadDialog
                    title="Nộp tài liệu"
                    subtitle={uploading.documentName}
                    extensions={DOCUMENT_UPLOAD_EXTENSIONS}
                    maxMb={DOCUMENT_UPLOAD_MAX_MB}
                    maxFiles={DOCUMENT_UPLOAD_MAX_FILES}
                    fileLabel="file"
                    withNote={false}
                    onSubmit={upload}
                    onClose={() => setUploading(null)}
                />
            )}
        </section>
    );
};

export default DocumentRequestPanel;

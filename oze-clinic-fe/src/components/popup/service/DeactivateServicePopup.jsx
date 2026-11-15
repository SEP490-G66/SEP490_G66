import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { deactivateService, deactivateServiceType } from "@/services/serviceManagementService";

// "Ngưng hoạt động" confirmation of a service, or of one type of it when serviceType is given. The change is
// immediate; the backend refuses while unfinished appointments still use it, and the reason is shown here.
// onSaved(message) runs after the service or type is turned off.
const DeactivateServicePopup = ({ service, serviceType, onClose, onSaved }) => {
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const handleConfirm = async () => {
        setSaving(true);
        setError(null);
        const response = serviceType ? await deactivateServiceType(serviceType) : await deactivateService(service.id);
        setSaving(false);
        if (!response.success) {
            setError(response.message);
            return;
        }
        onSaved(response.message);
    };

    const item = serviceType ?? service;

    return (
        <Modal
            title={serviceType ? "Ngưng hoạt động loại dịch vụ" : "Ngưng hoạt động dịch vụ"}
            description={`${item.code} · ${item.name}`}
            onClose={onClose}
            closeDisabled={saving}
        >
            <div className="mt-6 flex flex-col gap-4">
                {error && (
                    <p role="alert" className="alert alert-danger">
                        {error}
                    </p>
                )}
                <div className="alert alert-warning border-0">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <ul className="flex list-disc flex-col gap-1.5 pl-4 text-body">
                        <li>{serviceType ? "Loại dịch vụ" : "Dịch vụ"} ngưng hoạt động ngay và không còn hiển thị khi đặt lịch.</li>
                        {!serviceType && service.typeCount > 0 && <li>Các loại của dịch vụ này cũng không đặt lịch được nữa.</li>}
                        <li>Chỉ ngưng được khi không còn lịch hẹn chưa hoàn thành. Hoá đơn và lịch sử khám vẫn giữ nguyên.</li>
                        <li>Có thể kích hoạt lại bất cứ lúc nào.</li>
                    </ul>
                </div>

                <div className="modal-actions -mx-6 mt-2 border-t border-border px-6 pt-4">
                    <button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>
                        Huỷ
                    </button>
                    <button type="button" className="btn btn-danger" disabled={saving} onClick={handleConfirm}>
                        {saving && <span className="btn-spinner" aria-hidden="true" />}
                        Ngưng hoạt động
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default DeactivateServicePopup;

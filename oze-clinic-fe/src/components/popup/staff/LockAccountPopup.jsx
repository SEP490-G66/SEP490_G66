import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { lockStaffAccount } from "@/services/staffService";
import { staffRoleLabel } from "@/utils/constants/staff";

// "Khoá tài khoản" confirmation. The backend refuses while the staff member still has upcoming shifts or
// appointments; its message is shown here so the manager knows what to move first. onSaved(message) runs after a lock.
const LockAccountPopup = ({ member, onClose, onSaved }) => {
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const handleConfirm = async () => {
        setSaving(true);
        setError(null);
        const response = await lockStaffAccount(member.id);
        setSaving(false);
        if (!response.success) {
            setError(response.message);
            return;
        }
        onSaved(response.message);
    };

    return (
        <Modal title="Khoá tài khoản" description={`${member.fullName} · ${staffRoleLabel(member.role)}`} onClose={onClose} closeDisabled={saving}>
            <div className="mt-6 flex flex-col gap-4">
                {error && (
                    <p role="alert" className="alert alert-danger">
                        {error}
                    </p>
                )}
                <div className="alert alert-warning border-0">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div>
                        <p className="alert-title">Ảnh hưởng khi khoá</p>
                        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-body">
                            <li>Nhân viên không thể đăng nhập, các phiên đang đăng nhập bị kết thúc ngay.</li>
                            <li>Chỉ khoá được khi nhân viên không còn ca làm hoặc lịch hẹn sắp tới.</li>
                            <li>Dữ liệu và lịch sử thao tác vẫn được lưu; có thể mở khoá lại bất cứ lúc nào.</li>
                        </ul>
                    </div>
                </div>

                <div className="modal-actions -mx-6 mt-2 border-t border-border px-6 pt-4">
                    <button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>
                        Huỷ
                    </button>
                    <button type="button" className="btn btn-danger" disabled={saving} onClick={handleConfirm}>
                        {saving && <span className="btn-spinner" aria-hidden="true" />}
                        Khoá tài khoản
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default LockAccountPopup;

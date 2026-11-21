import { Pencil } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatPhone } from "@/utils/format";
import { USER_ROLES } from "@/utils/messages";
import { ACCOUNT_STATUS_LABELS, staffRoleLabel } from "@/utils/constants/staff";

const Empty = () => <span className="text-muted">—</span>;

const DetailItem = ({ label, className, children }) => (
    <div className={className}>
        <dt className="text-caption text-muted">{label}</dt>
        <dd className="mt-1 text-body-sm text-ink">{children}</dd>
    </div>
);

// "Chi tiết tài khoản" popup, read only. onEdit opens the update popup for the same account.
const StaffDetailPopup = ({ member, onClose, onEdit }) => {
    const isDoctor = member.role === USER_ROLES.DOCTOR;

    return (
        <Modal title="Chi tiết tài khoản" onClose={onClose}>
            <div className="mt-5 flex items-center gap-4 rounded-lg bg-surface-tint p-4">
                <Avatar fullName={member.fullName} size="lg" className="avatar-soft size-12 text-heading-3" />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-heading-3 text-ink">{member.fullName}</p>
                        <StatusBadge status={member.status} labels={ACCOUNT_STATUS_LABELS} />
                    </div>
                    <p className="mt-1 text-body-sm font-semibold text-primary">{staffRoleLabel(member.role)}</p>
                </div>
            </div>

            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <DetailItem label="Email">{member.email || <Empty />}</DetailItem>
                <DetailItem label="Số điện thoại">
                    <span className="num">{formatPhone(member.phone)}</span>
                </DetailItem>
                {isDoctor && (
                    <>
                        <DetailItem label="Số chứng chỉ hành nghề">{member.licenseNumber || <Empty />}</DetailItem>
                        <DetailItem label="Chuyên khoa">{member.specialization || <Empty />}</DetailItem>
                    </>
                )}
            </dl>

            <div className="modal-actions -mx-6 mt-5 border-t border-border px-6 pt-4">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Đóng
                </button>
                <button type="button" className="btn btn-primary" onClick={() => onEdit(member)}>
                    <Pencil className="size-4" aria-hidden="true" />
                    Chỉnh sửa
                </button>
            </div>
        </Modal>
    );
};

export default StaffDetailPopup;

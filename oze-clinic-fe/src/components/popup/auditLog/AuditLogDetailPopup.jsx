import { ArrowRight } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import useAsync from "@/hooks/useAsync";
import { getAuditLog } from "@/services/auditLogService";
import { auditActionLook, auditEntityLabel } from "@/utils/constants/auditLog";
import { getClinicDateTimeParts } from "@/utils/format";

const SectionTitle = ({ children }) => <h3 className="text-body-sm font-semibold text-ink">{children}</h3>;

const DetailTable = ({ rows }) => (
    <dl className="mt-2 divide-y divide-border rounded-lg border border-border">
        {rows.map(({ label, value }) => (
            <div key={label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-4 py-2.5">
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium break-words text-ink">{value || "—"}</dd>
            </div>
        ))}
    </dl>
);

// A field whose value did not change is listed plainly; a changed one shows before -> after.
const ChangeList = ({ changes }) => {
    const changedCount = changes.filter((change) => change.before !== change.after).length;
    return (
        <>
            <div className="flex items-center justify-between gap-3">
                <SectionTitle>Nội dung thay đổi</SectionTitle>
                <p className="num text-caption text-muted">{changedCount} trường thay đổi</p>
            </div>
            <ul className="mt-2 flex flex-col gap-3">
                {changes.map(({ field, before, after }) => (
                    <li key={field} className="rounded-lg border border-border p-3">
                        <p className="font-semibold text-ink">{field}</p>
                        {before === after ? (
                            <p className="mt-1 break-words text-body-sm text-muted">{after}</p>
                        ) : (
                            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                                <div className="h-full rounded-md bg-danger-soft px-3 py-2">
                                    <p className="text-caption text-muted">Trước</p>
                                    <del className="font-semibold break-words text-danger">{before}</del>
                                </div>
                                <ArrowRight className="size-4 text-muted" aria-hidden="true" />
                                <div className="h-full rounded-md bg-success-soft px-3 py-2">
                                    <p className="text-caption text-muted">Sau</p>
                                    <p className="font-semibold break-words text-success">{after}</p>
                                </div>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </>
    );
};

// "Chi tiết nhật ký" popup, read only. log is the row of the list; the values before / after are loaded here.
const AuditLogDetailPopup = ({ log, onClose }) => {
    const { loading, value: result } = useAsync(() => getAuditLog(log.id), [log.id]);
    const detail = result?.success ? result.data : null;

    const { label, variant } = auditActionLook(log.action);
    const entityLabel = auditEntityLabel(log.entityType);
    const { date, time } = getClinicDateTimeParts(log.createdAt);

    const generalRows = [
        { label: "Người dùng", value: [log.userName, log.userRole].filter(Boolean).join(" · ") },
        { label: "Mã người dùng", value: log.userId && <span className="num">{log.userId}</span> },
        { label: "Đối tượng", value: entityLabel },
        { label: "Mã đối tượng", value: log.entityId && <span className="num">#{log.entityId}</span> },
        { label: "Thời gian", value: <span className="num">{`${date} ${time}`}</span> },
        { label: "Địa chỉ IP", value: log.ipAddress && <span className="num">{log.ipAddress}</span> },
        { label: "Trình duyệt / thiết bị", value: log.userAgent },
    ];

    return (
        <Modal
            title={
                <span className="flex flex-wrap items-center gap-2">
                    {label}
                    <Badge variant={variant}>{entityLabel}</Badge>
                </span>
            }
            description={`Nhật ký #${log.id} · ${date} ${time}`}
            onClose={onClose}
        >
            <section className="mt-5">
                <SectionTitle>Thông tin chung</SectionTitle>
                <DetailTable rows={generalRows} />
            </section>

            <section className="mt-5">
                {loading && <div className="skeleton h-24 w-full" aria-hidden="true" />}
                {!loading && result && !result.success && (
                    <p role="alert" className="alert alert-danger">
                        {result.message || "Không tải được chi tiết nhật ký."}
                    </p>
                )}
                {detail && detail.changes.length > 0 && <ChangeList changes={detail.changes} />}
                {detail && detail.data.length > 0 && (
                    <>
                        <SectionTitle>{detail.onlyBefore ? "Dữ liệu trước thao tác" : "Dữ liệu ghi nhận"}</SectionTitle>
                        <DetailTable rows={detail.data.map((item) => ({ label: item.field, value: item.value }))} />
                    </>
                )}
                {detail && detail.changes.length === 0 && detail.data.length === 0 && (
                    <p className="text-body-sm text-muted">Thao tác này không ghi lại dữ liệu chi tiết.</p>
                )}
            </section>

            {detail?.note && (
                <section className="mt-5">
                    <SectionTitle>Lý do / ghi chú</SectionTitle>
                    <p className="mt-2 rounded-lg border border-border px-4 py-2.5 break-words text-ink">{detail.note}</p>
                </section>
            )}

            <div className="modal-actions -mx-6 items-center justify-between border-t border-border px-6 pt-4">
                <p className="text-caption text-muted">Nhật ký chỉ đọc, không sửa hoặc xoá được.</p>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Đóng
                </button>
            </div>
        </Modal>
    );
};

export default AuditLogDetailPopup;

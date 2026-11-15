import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/ui/StatusBadge";
import ImagingResultCard from "@/components/imagingReview/ImagingResultCard";
import { formatDate, formatDateTime } from "@/utils/format";
import { IMAGING_REQUEST_STATUSES, IMAGING_REQUEST_STATUS_LABELS, imagingTypeLabel } from "@/utils/imagingRequest";
import { GENDER_LABELS } from "@/utils/messages";

const Section = ({ title, children }) => (
    <section className="flex flex-col gap-2">
        <h3 className="text-label text-ink">{title}</h3>
        <dl className="grid gap-x-6 gap-y-2 rounded-md bg-surface-tint px-4 py-3 text-body-sm sm:grid-cols-2">{children}</dl>
    </section>
);

const Field = ({ label, value, wide }) => (
    <div className={wide ? "sm:col-span-2" : undefined}>
        <dt className="text-caption text-muted">{label}</dt>
        <dd className="font-medium break-words text-ink">{value || "—"}</dd>
    </div>
);

// "Chi tiết chụp chiếu", opened from the history table. Read only.
// detail: { id, status, patientName, patientCode, gender, birthDate, imagingType, targetArea, clinicalIndication,
// doctorName, createdAt, deviceId, completedAt, technicianNote, cancelReason, cancelledAt, images: [{ id, url? }] }.
const ImagingHistoryDetailDialog = ({ detail, onClose }) => {
    const cancelled = detail.status === IMAGING_REQUEST_STATUSES.CANCELLED;
    const images = detail.images ?? [];
    const type = imagingTypeLabel(detail.imagingType);

    return (
        <Modal title="Chi tiết chụp chiếu" description={`IR-${detail.id} · ${detail.patientName}`} size="lg" onClose={onClose}>
            <div className="mt-5 flex flex-col gap-5">
                <StatusBadge status={detail.status} labels={IMAGING_REQUEST_STATUS_LABELS} />
                <Section title="Bệnh nhân">
                    <Field label="Họ tên" value={detail.patientName} />
                    <Field label="Mã BN" value={detail.patientCode} />
                    <Field label="Giới tính" value={detail.gender && (GENDER_LABELS[String(detail.gender).toLowerCase()] ?? detail.gender)} />
                    <Field label="Ngày sinh" value={formatDate(detail.birthDate)} />
                </Section>
                <Section title="Chỉ định của bác sĩ">
                    <Field label="Loại chụp" value={type} />
                    <Field label="Vùng chụp" value={detail.targetArea} />
                    <Field label="Bác sĩ chỉ định" value={detail.doctorName} />
                    <Field label="Gửi lúc" value={formatDateTime(detail.createdAt)} />
                    <Field label="Mục đích chụp" value={detail.clinicalIndication} wide />
                </Section>
                {cancelled ? (
                    <Section title="Huỷ chỉ định">
                        <Field label="Huỷ lúc" value={formatDateTime(detail.cancelledAt)} />
                        <Field label="Lý do" value={detail.cancelReason} wide />
                    </Section>
                ) : (
                    <>
                        <Section title="Kết quả chụp">
                            <Field label="Máy" value={detail.deviceId ?? "Tải ảnh thủ công"} />
                            <Field label="Hoàn tất lúc" value={formatDateTime(detail.completedAt)} />
                            <Field label="Ghi chú kỹ thuật" value={detail.technicianNote} wide />
                        </Section>
                        {images.length > 0 ? (
                            <ImagingResultCard title={`${type} · IR-${detail.id}`} subtitle={`${images.length} ảnh`} typeLabel={type} images={images} />
                        ) : (
                            <p className="alert alert-warning">Chưa có ảnh cho chỉ định này.</p>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
};

export default ImagingHistoryDetailDialog;

import StatusBadge from "@/components/ui/StatusBadge";
import { formatClock } from "@/utils/format";
import { IMAGING_REQUEST_STATUS_LABELS, imagingTypeLabel } from "@/utils/imagingRequest";

const Row = ({ label, children }) => (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-1">
        <dt className="text-muted">{label}</dt>
        <dd className="font-medium break-words text-ink">{children || "—"}</dd>
    </div>
);

// One order of the doctor, as a card of its own: what to image, then (children) the capture block and the order's
// actions. order: { id, imagingType, targetArea, clinicalIndication, doctorName, createdAt, requestStatus };
// index / total: "Chỉ định 1/2" when the patient has several orders.
const ImagingOrderCard = ({ order, index = 0, total = 1, children }) => (
    <section aria-label={`Chỉ định IR-${order.id}`} className="card-app p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <h3 className="min-w-0 font-heading text-body-md font-semibold text-ink">
                {total > 1 && <span className="text-muted">Chỉ định {index + 1}/{total} · </span>}
                <span className="num">IR-{order.id}</span> · {imagingTypeLabel(order.imagingType)}
            </h3>
            <StatusBadge status={order.requestStatus} labels={IMAGING_REQUEST_STATUS_LABELS} />
        </div>
        <div className="px-5 py-4">
            <dl className="rounded-md bg-surface-tint px-4 py-3 text-body-sm">
                <Row label="Loại chụp">{imagingTypeLabel(order.imagingType)}</Row>
                <Row label="Vùng chụp">{order.targetArea}</Row>
                <Row label="Mục đích chụp">{order.clinicalIndication}</Row>
                <Row label="Bác sĩ chỉ định">{order.doctorName}</Row>
                <Row label="Gửi lúc">
                    <span className="num">{order.createdAt && formatClock(order.createdAt)}</span>
                </Row>
            </dl>
        </div>
        {children}
    </section>
);

export default ImagingOrderCard;

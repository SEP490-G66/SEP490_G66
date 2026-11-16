import SegmentedControl from "@/components/ui/SegmentedControl";
import { formatClock } from "@/utils/format";
import { imagingTypeLabel } from "@/utils/imagingRequest";

const Row = ({ label, children }) => (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-1">
        <dt className="text-muted">{label}</dt>
        <dd className="font-medium break-words text-ink">{children || "—"}</dd>
    </div>
);

// "Chỉ định của bác sĩ". orders: [{ id, imagingType, targetArea, clinicalIndication, doctorName, createdAt }];
// a patient with several orders gets one tab per order (selectedId / onSelect).
const ImagingOrderCard = ({ orders = [], selectedId, onSelect }) => {
    const order = orders.find((item) => item.id === selectedId) ?? orders[0];
    if (!order) return null;
    const tabs = orders.map((item, index) => ({ value: item.id, label: `${index + 1} · IR-${item.id} ${imagingTypeLabel(item.imagingType)}` }));

    return (
        <section aria-label="Chỉ định của bác sĩ" className="card-app p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                <h3 className="font-heading text-body-md font-semibold text-ink">Chỉ định của bác sĩ</h3>
                {orders.length > 1 && <SegmentedControl options={tabs} value={order.id} onChange={onSelect} label="Chọn chỉ định" />}
            </div>
            <div className="px-5 py-4">
                <dl className="rounded-md bg-surface-tint px-4 py-3 text-body-sm">
                    <Row label="Mã chỉ định">
                        <span className="num">IR-{order.id}</span>
                    </Row>
                    <Row label="Loại chụp">{imagingTypeLabel(order.imagingType)}</Row>
                    <Row label="Vùng chụp">{order.targetArea}</Row>
                    <Row label="Bác sĩ chỉ định">{order.doctorName}</Row>
                    <Row label="Gửi lúc">
                        <span className="num">{order.createdAt && formatClock(order.createdAt)}</span>
                    </Row>
                    <Row label="Mục đích chụp">{order.clinicalIndication}</Row>
                </dl>
            </div>
        </section>
    );
};

export default ImagingOrderCard;

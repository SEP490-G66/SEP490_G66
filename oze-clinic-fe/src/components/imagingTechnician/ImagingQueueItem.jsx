import Avatar from "@/components/ui/Avatar";
import StatusBadge from "@/components/ui/StatusBadge";
import { cx } from "@/utils/cx";
import { formatClock } from "@/utils/format";
import { IMAGING_REQUEST_STATUS_LABELS, imagingTypeLabel } from "@/utils/imagingRequest";

// "Phim quanh chóp · Răng 21"; with two orders "Phim quanh chóp · Răng 38 + Phim toàn cảnh (Panorama)".
const ordersText = (orders) =>
    orders.length === 1
        ? [imagingTypeLabel(orders[0].imagingType), orders[0].targetArea].filter(Boolean).join(" · ")
        : orders.map((order) => imagingTypeLabel(order.imagingType)).join(" + ");

// One patient in "Hàng chờ chụp". The queue API returns one row per order: the page groups the orders of a patient.
// item: { id, patientName, status (IMAGING_REQUEST_STATUSES), doctorName, createdAt, orders: [{ id, imagingType, targetArea }] }.
const ImagingQueueItem = ({ item, selected = false, onSelect }) => {
    const orders = item.orders ?? [];
    return (
        <li>
            <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect?.(item.id)}
                className={cx(
                    "flex w-full cursor-pointer gap-3 border-b border-l-2 border-b-border px-4 py-3 text-left outline-none transition-colors focus-visible:shadow-focus",
                    selected ? "border-l-primary bg-primary-soft" : "border-l-transparent hover:bg-surface-tint",
                )}
            >
                <Avatar fullName={item.patientName} className={cx("shrink-0", selected ? "" : "avatar-soft")} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-semibold text-ink">{item.patientName}</span>
                        <StatusBadge status={item.status} labels={IMAGING_REQUEST_STATUS_LABELS} />
                        {orders.length > 1 && <span className="badge badge-info">{orders.length} chỉ định</span>}
                    </span>
                    <span className="truncate text-body-sm text-body">{ordersText(orders)}</span>
                    <span className="num truncate text-caption text-muted">
                        {[item.doctorName, item.createdAt && `gửi ${formatClock(item.createdAt)}`].filter(Boolean).join(" · ")}
                    </span>
                </span>
            </button>
        </li>
    );
};

export default ImagingQueueItem;

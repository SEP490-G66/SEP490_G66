import { useId, useState } from "react";
import { ScanLine } from "lucide-react";
import { cx } from "@/utils/cx";
import ImagingQueueItem from "./ImagingQueueItem";

// « / » button, same as the review list (ReviewRequestList).
const TOGGLE = "btn btn-secondary h-8 shrink-0 px-3 text-caption pointer-coarse:h-11";

// Left column of "Chụp chiếu": patients waiting for imaging, in order time, the one being imaged first.
// items: see ImagingQueueItem; orderCount: number of orders behind them; « collapses the column to a » button.
const ImagingQueuePanel = ({ items = [], orderCount, selectedId, onSelect, loading = false, className }) => {
    const [collapsed, setCollapsed] = useState(false);
    const panelId = useId();
    const titleId = useId();
    const count = orderCount ?? items.reduce((sum, item) => sum + (item.orders?.length ?? 1), 0);

    if (collapsed) {
        return (
            <button
                type="button"
                className={cx(TOGGLE, "self-start")}
                aria-label="Mở rộng hàng chờ chụp"
                title="Mở rộng hàng chờ"
                aria-expanded={false}
                aria-controls={panelId}
                onClick={() => setCollapsed(false)}
            >
                »
            </button>
        );
    }

    return (
        <section id={panelId} aria-labelledby={titleId} className={cx("card-app flex w-full flex-col p-0 lg:w-80 lg:shrink-0", className)}>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0 flex-1">
                    <h2 id={titleId} className="font-heading text-body-md font-semibold text-ink">
                        Hàng chờ chụp
                    </h2>
                    <p className="num text-caption text-muted">{count} chỉ định · tự cập nhật 20 giây/lần</p>
                </div>
                <button
                    type="button"
                    className={TOGGLE}
                    aria-label="Thu gọn hàng chờ chụp"
                    title="Thu gọn hàng chờ"
                    aria-expanded
                    aria-controls={panelId}
                    onClick={() => setCollapsed(true)}
                >
                    «
                </button>
            </div>
            {loading && items.length === 0 ? (
                <div className="flex flex-col gap-3 p-4" aria-busy="true">
                    {Array.from({ length: 4 }, (_, index) => (
                        <div key={index} className="skeleton h-14 w-full" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="empty-state">
                    <ScanLine className="empty-state-icon" aria-hidden="true" />
                    <p className="empty-state-title">Chưa có bệnh nhân chờ chụp</p>
                    <p className="empty-state-text">Chỉ định mới của bác sĩ sẽ hiện ở đây.</p>
                </div>
            ) : (
                <ul className="flex flex-col overflow-y-auto">
                    {items.map((item) => (
                        <ImagingQueueItem key={item.id} item={item} selected={item.id === selectedId} onSelect={onSelect} />
                    ))}
                </ul>
            )}
        </section>
    );
};

export default ImagingQueuePanel;

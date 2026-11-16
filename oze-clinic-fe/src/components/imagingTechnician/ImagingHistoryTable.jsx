import { History } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { getClinicDateTimeParts } from "@/utils/format";
import { IMAGING_REQUEST_STATUSES, IMAGING_REQUEST_STATUS_LABELS, imagingTypeLabel } from "@/utils/imagingRequest";

const SKELETON_ROW_COUNT = 5;
const COLUMN_COUNT = 9;

// "Lịch sử chụp chiếu": orders already imaged or cancelled by the doctor.
// rows: [{ id, createdAt, patientName, patientCode, imagingType, targetArea, doctorName, deviceId, imageCount, status, cancelReason }].
// deviceId null with images means a manual upload. filtered: a search or filter is on, which changes the empty message.
const ImagingHistoryTable = ({ rows = [], loading = false, filtered = false, onView }) => (
    <div className="table-wrap">
        <table className="table table-stack" aria-busy={loading}>
            <thead>
                <tr>
                    <th scope="col">Ngày giờ</th>
                    <th scope="col">Bệnh nhân</th>
                    <th scope="col">Loại chụp</th>
                    <th scope="col">Vùng chụp</th>
                    <th scope="col">Bác sĩ</th>
                    <th scope="col">Máy</th>
                    <th scope="col">Số ảnh</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">
                        <span className="sr-only">Thao tác</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                {loading &&
                    Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                        <tr key={index} aria-hidden="true">
                            {Array.from({ length: COLUMN_COUNT }, (_, cell) => (
                                <td key={cell}>
                                    <div className="skeleton h-4 w-full max-w-28" />
                                </td>
                            ))}
                        </tr>
                    ))}
                {!loading && rows.length === 0 && (
                    <tr>
                        <td colSpan={COLUMN_COUNT}>
                            <div className="empty-state">
                                <History className="empty-state-icon" aria-hidden="true" />
                                <p className="empty-state-title">{filtered ? "Không tìm thấy lượt chụp phù hợp" : "Chưa có lượt chụp nào"}</p>
                                {filtered && <p className="empty-state-text">Thử đổi từ khóa, khoảng ngày hoặc bộ lọc.</p>}
                            </div>
                        </td>
                    </tr>
                )}
                {!loading &&
                    rows.map((row) => {
                        const { date, time } = getClinicDateTimeParts(row.createdAt);
                        const cancelled = row.status === IMAGING_REQUEST_STATUSES.CANCELLED;
                        const device = cancelled ? "—" : (row.deviceId ?? "Tải thủ công");
                        return (
                            <tr key={row.id}>
                                <td data-label="Ngày giờ" className="num whitespace-nowrap">
                                    <span className="block text-ink">{date.slice(0, 5)}</span>
                                    <span className="text-caption text-muted">{time.slice(0, 5)}</span>
                                </td>
                                <td data-primary>
                                    <span className="block font-semibold text-ink">{row.patientName}</span>
                                    <span className="num text-caption text-muted">{row.patientCode}</span>
                                </td>
                                <td data-label="Loại chụp" data-block>
                                    <span className="block font-semibold text-ink">{imagingTypeLabel(row.imagingType)}</span>
                                    {cancelled && row.cancelReason && <span className="text-caption text-muted">Huỷ: {row.cancelReason}</span>}
                                </td>
                                <td data-label="Vùng chụp">{row.targetArea}</td>
                                <td data-label="Bác sĩ" className="whitespace-nowrap">
                                    {row.doctorName}
                                </td>
                                <td data-label="Máy" className="num whitespace-nowrap">
                                    {device}
                                </td>
                                <td data-label="Số ảnh" className="num">
                                    {cancelled ? "—" : (row.imageCount ?? 0)}
                                </td>
                                <td data-label="Trạng thái">
                                    <StatusBadge status={row.status} labels={IMAGING_REQUEST_STATUS_LABELS} />
                                </td>
                                <td data-actions>
                                    <button type="button" className="btn btn-secondary h-8 px-3 text-caption whitespace-nowrap pointer-coarse:h-11" onClick={() => onView?.(row)}>
                                        Xem chi tiết
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
            </tbody>
        </table>
    </div>
);

export default ImagingHistoryTable;

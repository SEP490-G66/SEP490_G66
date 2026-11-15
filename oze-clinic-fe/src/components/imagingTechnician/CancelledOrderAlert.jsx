import { CircleX } from "lucide-react";
import { formatClock } from "@/utils/format";

// Shown when the doctor cancelled the order the technician has open (found on a queue refresh, or a 400 from
// "Hoàn thành"). order: { id, doctorName, cancelReason, updatedAt }; onNext: go to the next patient.
const CancelledOrderAlert = ({ order, onNext }) => (
    <div role="alert" className="alert alert-danger items-center">
        <CircleX className="size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
            <p className="font-semibold">Bác sĩ đã huỷ chỉ định này</p>
            <p className="text-body">
                {[order.doctorName, "huỷ", `IR-${order.id}`, order.updatedAt && `lúc ${formatClock(order.updatedAt)}`].filter(Boolean).join(" ")}.
                {order.cancelReason && ` Lý do: ${order.cancelReason}.`} Không cần chụp cho bệnh nhân này.
            </p>
        </div>
        {onNext && (
            <button type="button" className="btn btn-secondary shrink-0" onClick={onNext}>
                Chuyển bệnh nhân kế tiếp
            </button>
        )}
    </div>
);

export default CancelledOrderAlert;

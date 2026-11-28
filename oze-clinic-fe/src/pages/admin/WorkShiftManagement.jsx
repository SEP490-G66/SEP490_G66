import { useState } from "react";
import { toast } from "react-toastify";
import MonthlyShiftPopup from "@/components/popup/shift/MonthlyShiftPopup";
import ShiftAssignPopup from "@/components/popup/shift/ShiftAssignPopup";
import ShiftDetailPopup from "@/components/popup/shift/ShiftDetailPopup";
import ShiftEditPopup from "@/components/popup/shift/ShiftEditPopup";
import UnassignedShiftPopup from "@/components/popup/shift/UnassignedShiftPopup";
import ShiftWeekGrid from "@/components/shift/ShiftWeekGrid";
import FilterBar, { FILTER_SELECT_CLASS } from "@/components/ui/FilterBar";
import FilterSelect from "@/components/ui/FilterSelect";
import WeekPicker from "@/components/ui/WeekPicker";
import useAsync from "@/hooks/useAsync";
import { SHIFT_ROLE_OPTIONS, copyPreviousWeek, getWeekShifts, roomTypeRole } from "@/services/shiftService";
import { getWeekStart, toDateOnly } from "@/utils/format";
import { SHIFT_STATUSES, SHIFT_STATUS_OPTIONS } from "@/utils/constants/shift";
import { serverNow } from "@/services/clinicTimeService";

const WEEK_NAMES = { 0: "Tuần này", 1: "Tuần sau" };

const DIALOGS = {
    DETAIL: "detail",
    UNASSIGNED: "unassigned",
    ASSIGN: "assign",
    REPLACE: "replace",
    EDIT: "edit",
    MONTHLY: "monthly",
};

// "Tuần sau còn 4 vị trí chưa phân ca và 2 ca cần người thay (nghỉ phép). Bấm vào ô để phân ca."
const pendingWorkText = (week) => {
    const parts = [];
    if (week.summary.unassigned > 0) parts.push(`${week.summary.unassigned} vị trí chưa phân ca`);
    if (week.summary.needReplacement > 0) parts.push(`${week.summary.needReplacement} ca cần người thay (nghỉ hoặc vắng)`);
    if (parts.length === 0) return null;
    return `${WEEK_NAMES[week.weekOffset] ?? `Tuần ${week.label}`} còn ${parts.join(" và ")}. Bấm vào ô để phân ca.`;
};

const WorkShiftManagement = () => {
    const [weekStart, setWeekStart] = useState(() => getWeekStart());
    const [roomId, setRoomId] = useState("");
    const [role, setRole] = useState("");
    const [status, setStatus] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [copying, setCopying] = useState(false);

    const { loading, value: result } = useAsync(() => getWeekShifts({ weekStart }), [weekStart, reloadKey]);
    const week = result?.success ? result.data : null;
    // Rooms that have a row this week (active rooms and the reception desk), for the room filter
    const roomOptions = (week?.rooms ?? []).map((room) => ({ value: String(room.id), label: room.name }));

    const isVisible = (cell) =>
        (!roomId || String(cell.room.id) === roomId) && (!role || roomTypeRole(cell.room.type) === role) && (!status || cell.status === status);

    // An editable week opens the planning popups; otherwise the card only shows what happened.
    const openCell = (cell) => {
        if (week.editable) {
            if (!cell.staff) setDialog({ type: DIALOGS.ASSIGN, cell });
            else if (cell.status === SHIFT_STATUSES.LEAVE || cell.status === SHIFT_STATUSES.ABSENT) setDialog({ type: DIALOGS.REPLACE, cell });
            else setDialog({ type: DIALOGS.EDIT, cell });
            return;
        }
        setDialog({ type: cell.staff ? DIALOGS.DETAIL : DIALOGS.UNASSIGNED, cell });
    };

    const clearFilters = () => {
        setRoomId("");
        setRole("");
        setStatus("");
    };

    const handleSaved = (message) => {
        setDialog(null);
        toast.success(message);
        setReloadKey((current) => current + 1);
    };

    const handleCopy = async () => {
        setCopying(true);
        const response = await copyPreviousWeek({ weekStart });
        setCopying(false);
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        toast[response.data.copied > 0 ? "success" : "info"](response.message);
        setReloadKey((current) => current + 1);
    };

    const today = toDateOnly(serverNow());
    const pendingWork = week?.editable ? pendingWorkText(week) : null;

    return (
        <div className="flex flex-col gap-6">
            <div className="page-header mb-0 items-center">
                <div>
                    <h1 className="page-title">Phân ca</h1>
                    <p className="page-description">
                        {week?.editable ? "Tuần chưa diễn ra · bấm vào ô để phân ca hoặc đổi người" : "Theo dõi trạng thái ca làm việc của nhân viên"}
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {week?.editable && (
                        <button type="button" className="btn btn-secondary" disabled={copying} onClick={handleCopy}>
                            {copying ? "Đang sao chép…" : "Sao chép tuần trước"}
                        </button>
                    )}
                    <button type="button" className="btn btn-primary" onClick={() => setDialog({ type: DIALOGS.MONTHLY })}>
                        Phân ca theo tháng
                    </button>
                </div>
            </div>

            <WeekPicker id="shift-week" value={weekStart} onChange={setWeekStart} className="w-full sm:w-auto" />

            <FilterBar
                canClear={Boolean(roomId || role || status)}
                onClear={clearFilters}
            >
                <FilterSelect
                    className={FILTER_SELECT_CLASS}
                    id="shift-room-filter"
                    label="Phòng"
                    options={roomOptions}
                    value={roomId}
                    onChange={setRoomId}
                />
                <FilterSelect
                    className={FILTER_SELECT_CLASS}
                    id="shift-role-filter"
                    label="Vai trò"
                    options={SHIFT_ROLE_OPTIONS}
                    value={role}
                    onChange={setRole}
                />
                <FilterSelect
                    className={FILTER_SELECT_CLASS}
                    id="shift-status-filter"
                    label="Trạng thái"
                    options={SHIFT_STATUS_OPTIONS}
                    value={status}
                    onChange={setStatus}
                />
            </FilterBar>

            {pendingWork && <p className="alert alert-danger border-0">{pendingWork}</p>}

            {!loading && result && !result.success ? (
                <p role="alert" className="alert alert-danger">
                    {result.message || "Không tải được lịch phân ca. Vui lòng thử lại sau."}
                </p>
            ) : loading || !week ? (
                <div className="skeleton h-160 w-full" aria-hidden="true" />
            ) : (
                <ShiftWeekGrid week={week} isVisible={isVisible} onSelect={openCell} />
            )}

            {dialog?.type === DIALOGS.DETAIL && (
                <ShiftDetailPopup
                    cell={dialog.cell}
                    onClose={() => setDialog(null)}
                    onAssign={dialog.cell.date >= today ? (cell) => setDialog({ type: DIALOGS.REPLACE, cell }) : undefined}
                />
            )}
            {dialog?.type === DIALOGS.UNASSIGNED && (
                <UnassignedShiftPopup
                    cell={dialog.cell}
                    onClose={() => setDialog(null)}
                    onAssign={dialog.cell.date >= today ? (cell) => setDialog({ type: DIALOGS.ASSIGN, cell }) : undefined}
                />
            )}
            {(dialog?.type === DIALOGS.ASSIGN || dialog?.type === DIALOGS.REPLACE) && (
                <ShiftAssignPopup cell={dialog.cell} replace={dialog.type === DIALOGS.REPLACE} onClose={() => setDialog(null)} onSaved={handleSaved} />
            )}
            {dialog?.type === DIALOGS.EDIT && <ShiftEditPopup cell={dialog.cell} onClose={() => setDialog(null)} onSaved={handleSaved} />}
            {dialog?.type === DIALOGS.MONTHLY && <MonthlyShiftPopup onClose={() => setDialog(null)} onSaved={handleSaved} />}
        </div>
    );
};

export default WorkShiftManagement;

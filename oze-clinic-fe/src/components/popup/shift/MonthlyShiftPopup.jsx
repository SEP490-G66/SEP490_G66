import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import useAsync from "@/hooks/useAsync";
import { WEEKDAYS_SHORT, createMonthlyShifts, getShiftStaff, roomsForRole } from "@/services/shiftService";
import { cx } from "@/utils/cx";
import { SHIFT_SLOTS, SHIFT_SLOT_OPTIONS } from "@/utils/constants/shift";
import { formatDayMonth, toDateOnly } from "@/utils/format";
import { requiredMessage } from "@/utils/validation";

const STAFF_ID = "monthly-shift-staff";
const MONTH_ID = "monthly-shift-month";
const FROM_ID = "monthly-shift-from";
const TO_ID = "monthly-shift-to";
const MONTH_COUNT = 6;
const MAX_LISTED = 3;
const WEEKDAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
const CAL_HEADERS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const STEPS = { FORM: "form", PREVIEW: "preview", RESULT: "result" };

const pad = (value) => String(value).padStart(2, "0");

const emptyPattern = () => WEEKDAYS_SHORT.map(() => ({ [SHIFT_SLOTS.MORNING]: "", [SHIFT_SLOTS.AFTERNOON]: "" }));

const monthRange = (month) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const now = new Date();
    const tomorrow = toDateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const first = `${month}-01`;
    return { from: first > tomorrow ? first : tomorrow, to: toDateOnly(new Date(year, monthNumber, 0)) };
};

const monthOptions = () => {
    const now = new Date();
    return Array.from({ length: MONTH_COUNT }, (_, index) => {
        const month = new Date(now.getFullYear(), now.getMonth() + index, 1);
        return { value: `${month.getFullYear()}-${pad(month.getMonth() + 1)}`, label: `${pad(month.getMonth() + 1)}/${month.getFullYear()}` };
    });
};

const listDates = (dates) => {
    const unique = [...new Set(dates)].map(formatDayMonth);
    return unique.length > MAX_LISTED ? `${unique.slice(0, MAX_LISTED).join(", ")}…` : unique.join(", ");
};

const skippedText = ({ skippedLeave, conflicts }) => {
    const parts = [];
    if (skippedLeave?.length > 0) parts.push(`${skippedLeave.length} ca ngày ${listDates(skippedLeave)} (nghỉ phép)`);
    if (conflicts?.length > 0) {
        const listed = conflicts
            .slice(0, MAX_LISTED)
            .map((item) => `${formatDayMonth(item.date)} ${item.slot === SHIFT_SLOTS.MORNING ? "sáng" : "chiều"} (${item.reason})`);
        parts.push(`${conflicts.length} ca ngày ${listed.join(", ")}${conflicts.length > MAX_LISTED ? "…" : ""}`);
    }
    return parts.length > 0 ? `Bỏ qua ${parts.join(" và ")}.` : null;
};

const buildCalendarCells = (monthValue, from, to, itemsByDate) => {
    const [year, monthNumber] = monthValue.split("-").map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const startPad = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
    const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
        const dayNum = index - startPad + 1;
        if (dayNum < 1 || dayNum > daysInMonth) return { key: `pad-${index}`, out: true };
        const date = `${year}-${pad(monthNumber)}-${pad(dayNum)}`;
        const inRange = date >= from && date <= to;
        return { key: date, out: false, dayNum, date, items: inRange ? itemsByDate[date] ?? [] : [] };
    });
};

const MonthlyShiftPopup = ({ onClose, onSaved }) => {
    const [months] = useState(monthOptions);
    const [staffId, setStaffId] = useState("");
    const [month, setMonth] = useState(months[1].value);
    const [range, setRange] = useState(() => monthRange(months[1].value));
    const [pattern, setPattern] = useState(emptyPattern);
    const [errors, setErrors] = useState({});
    const [step, setStep] = useState(STEPS.FORM);
    const [saving, setSaving] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [previewItems, setPreviewItems] = useState([]);
    const [selectedKeys, setSelectedKeys] = useState(() => new Set());
    const [resultData, setResultData] = useState(null);

    const { value: staffResult } = useAsync(() => getShiftStaff(), []);
    const staffList = staffResult?.success ? staffResult.data.staff : [];
    const allRooms = staffResult?.success ? staffResult.data.rooms : [];
    const staff = staffList.find((member) => member.id === staffId);
    const rooms = staff ? roomsForRole(allRooms, staff.role) : [];

    const request = { staffId, staffName: staff?.name, rooms, from: range.from, to: range.to, pattern };
    const estimateKey = JSON.stringify(request);
    const estimate = useAsync(
        () => (staff && step === STEPS.FORM ? createMonthlyShifts({ ...request, dryRun: true }).then((result) => ({ key: estimateKey, result })) : Promise.resolve(null)),
        [estimateKey, step],
    );
    const estimateResult = estimate.value?.key === estimateKey && estimate.value.result.success ? estimate.value.result.data : null;
    const estimateCount = estimateResult?.created ?? 0;

    const monthLabel = months.find((option) => option.value === month)?.label;
    const today = toDateOnly(new Date());

    const selectedCount = useMemo(() => previewItems.filter((item) => item.valid && selectedKeys.has(item.key)).length, [previewItems, selectedKeys]);
    const invalidCount = useMemo(() => previewItems.filter((item) => !item.valid).length, [previewItems]);
    const deselectedCount = useMemo(() => previewItems.filter((item) => item.valid && !selectedKeys.has(item.key)).length, [previewItems, selectedKeys]);

    const itemsByDate = useMemo(() => {
        const map = {};
        previewItems.forEach((item) => {
            (map[item.date] ??= []).push(item);
        });
        return map;
    }, [previewItems]);

    const calendarCells = useMemo(
        () => (step === STEPS.PREVIEW ? buildCalendarCells(month, range.from, range.to, itemsByDate) : []),
        [step, month, range.from, range.to, itemsByDate],
    );

    const clearError = (field) => setErrors((current) => ({ ...current, [field]: undefined }));

    const changeStaff = (value) => {
        setStaffId(value);
        setPattern(emptyPattern());
        clearError("staffId");
    };

    const changeMonth = (value) => {
        setMonth(value);
        setRange(monthRange(value));
        clearError("to");
    };

    const changeRange = (field, value) => {
        setRange((current) => ({ ...current, [field]: value }));
        clearError("to");
    };

    const changePattern = (weekday, slot, roomId) =>
        setPattern((current) => current.map((day, index) => (index === weekday ? { ...day, [slot]: roomId } : day)));

    const validateForm = () => {
        const nextErrors = {};
        if (!staffId) nextErrors.staffId = requiredMessage("nhân viên");
        if (!range.from || !range.to) nextErrors.to = requiredMessage("khoảng ngày");
        else if (range.from > range.to) nextErrors.to = "Đến ngày phải sau Từ ngày.";
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const goPreview = async (event) => {
        event.preventDefault();
        if (!validateForm()) {
            event.currentTarget.querySelector('[aria-invalid="true"]')?.focus();
            return;
        }

        setLoadingPreview(true);
        const response = await createMonthlyShifts({ ...request, dryRun: true });
        setLoadingPreview(false);
        if (!response.success) {
            toast.error(Object.values(response.errors ?? {})[0] ?? response.message);
            return;
        }

        const items = response.data.items ?? [];
        setPreviewItems(items);
        setSelectedKeys(new Set(items.filter((item) => item.valid).map((item) => item.key)));
        setStep(STEPS.PREVIEW);
    };

    const toggleItem = (item) => {
        if (!item.valid) return;
        setSelectedKeys((current) => {
            const next = new Set(current);
            if (next.has(item.key)) next.delete(item.key);
            else next.add(item.key);
            return next;
        });
    };

    const createSelected = async () => {
        const excludeKeys = previewItems.filter((item) => item.valid && !selectedKeys.has(item.key)).map((item) => item.key);
        setSaving(true);
        const response = await createMonthlyShifts({ ...request, excludeKeys });
        setSaving(false);
        if (!response.success) {
            toast.error(Object.values(response.errors ?? {})[0] ?? response.message);
            return;
        }

        const refused = response.data.conflicts ?? [];
        const deselected = previewItems
            .filter((item) => item.valid && !selectedKeys.has(item.key))
            .map((item) => ({ date: item.date, slot: item.slotLabel, reason: "Bỏ chọn ở bước xem trước" }));
        const invalid = previewItems
            .filter((item) => !item.valid)
            .map((item) => ({ date: item.date, slot: item.slotLabel, reason: item.reason }));
        const refusedRows = refused.map((item) => ({
            date: item.date,
            slot: item.slot === SHIFT_SLOTS.MORNING ? "Sáng" : "Chiều",
            reason: item.reason,
        }));

        setResultData({
            message: response.message,
            created: response.data.created,
            skippedRows: [...invalid, ...deselected, ...refusedRows],
        });
        setStep(STEPS.RESULT);
    };

    const finish = () => {
        onSaved(resultData?.message ?? "Đã phân ca theo tháng.");
    };

    const description =
        step === STEPS.FORM
            ? "Chọn lịch lặp lại hằng tuần, hệ thống tạo ca cho cả tháng"
            : step === STEPS.PREVIEW
              ? "Xem trước trên lịch tháng — bấm ca để bỏ / chọn lại"
              : "Kết quả tạo lịch theo tháng";

    return (
        <Modal title="Phân ca theo tháng" description={description} size="xl" onClose={onClose} closeDisabled={saving || loadingPreview}>
            {step === STEPS.FORM && (
                <form noValidate onSubmit={goPreview} className="mt-5 flex flex-col gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField id={STAFF_ID} label="Nhân viên" required error={errors.staffId}>
                            <select
                                id={STAFF_ID}
                                className="input"
                                aria-invalid={Boolean(errors.staffId)}
                                aria-describedby={errors.staffId ? `${STAFF_ID}-error` : undefined}
                                value={staffId}
                                onChange={(event) => changeStaff(event.target.value)}
                            >
                                <option value="">Chọn nhân viên</option>
                                {staffList.map((member) => (
                                    <option key={member.id} value={member.id}>{`${member.name} · ${member.roleLabel}`}</option>
                                ))}
                            </select>
                        </FormField>
                        <FormField id={MONTH_ID} label="Tháng" required>
                            <select id={MONTH_ID} className="input num" value={month} onChange={(event) => changeMonth(event.target.value)}>
                                {months.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField id={FROM_ID} label="Từ ngày" required>
                            <input
                                id={FROM_ID}
                                type="date"
                                className="input"
                                min={today}
                                value={range.from}
                                onChange={(event) => changeRange("from", event.target.value)}
                            />
                        </FormField>
                        <FormField id={TO_ID} label="Đến ngày" required error={errors.to}>
                            <input
                                id={TO_ID}
                                type="date"
                                className="input"
                                min={range.from || today}
                                aria-invalid={Boolean(errors.to)}
                                aria-describedby={errors.to ? `${TO_ID}-error` : undefined}
                                value={range.to}
                                onChange={(event) => changeRange("to", event.target.value)}
                            />
                        </FormField>
                    </div>

                    <div className="field">
                        <span className="label">Lịch lặp lại hằng tuần</span>
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th scope="col">Thứ</th>
                                        {SHIFT_SLOT_OPTIONS.map((slot) => (
                                            <th key={slot.value} scope="col" className="num">
                                                {`${slot.label} · ${slot.start}–${slot.end}`}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {WEEKDAY_NAMES.map((name, weekday) => (
                                        <tr key={name}>
                                            <th scope="row" className="whitespace-nowrap text-left font-semibold text-ink">
                                                {name}
                                            </th>
                                            {SHIFT_SLOT_OPTIONS.map((slot) => {
                                                const value = pattern[weekday][slot.value];
                                                return (
                                                    <td key={slot.value} className="py-1.5">
                                                        <select
                                                            className={cx("input h-9", !value && "bg-surface-tint text-placeholder")}
                                                            aria-label={`${name}, ${slot.label}`}
                                                            disabled={!staff}
                                                            value={value}
                                                            onChange={(event) => changePattern(weekday, slot.value, event.target.value)}
                                                        >
                                                            <option value="">Không làm</option>
                                                            {rooms.map((room) => (
                                                                <option key={room.id} value={room.id}>
                                                                    {room.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {staff && estimateResult && (
                        <div className="rounded-md bg-info-soft px-4 py-3" role="status">
                            <p className="num font-semibold text-primary">
                                Sẽ tạo {estimateCount} ca cho {staff.name} trong tháng {monthLabel}
                            </p>
                            {skippedText(estimateResult) && <p className="num mt-0.5 text-body">{skippedText(estimateResult)}</p>}
                        </div>
                    )}

                    <div className="modal-actions -mx-6 mt-2 border-t border-border px-6 pt-4">
                        <button type="button" className="btn btn-secondary" disabled={loadingPreview} onClick={onClose}>
                            Huỷ
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loadingPreview || (staff && estimateCount === 0)}>
                            {loadingPreview ? "Đang xem trước…" : "Xem trước"}
                        </button>
                    </div>
                </form>
            )}

            {step === STEPS.PREVIEW && (
                <div className="mt-5 flex flex-col gap-4">
                    <div className="rounded-md bg-info-soft px-4 py-3" role="status">
                        <p className="num font-semibold text-primary">
                            Sẽ tạo {selectedCount} ca · đã bỏ {deselectedCount} · lỗi {invalidCount}
                        </p>
                    </div>

                    <div className="cal-legend">
                        <span>
                            <i className="cal-legend-swatch cal-legend-on" aria-hidden="true" />
                            Sẽ tạo
                        </span>
                        <span>
                            <i className="cal-legend-swatch cal-legend-off" aria-hidden="true" />
                            Đã bỏ chọn
                        </span>
                        <span>
                            <i className="cal-legend-swatch cal-legend-bad" aria-hidden="true" />
                            Lỗi từ máy chủ
                        </span>
                    </div>

                    <div className="field">
                        <span className="label">Lịch tháng {monthLabel}</span>
                        <div className="cal" aria-label="Lịch xem trước ca">
                            <div className="cal-head">
                                {CAL_HEADERS.map((day) => (
                                    <span key={day}>{day}</span>
                                ))}
                            </div>
                            <div className="cal-grid">
                                {calendarCells.map((cell) =>
                                    cell.out ? (
                                        <div key={cell.key} className="cal-cell cal-cell-out" />
                                    ) : (
                                        <div key={cell.key} className="cal-cell">
                                            <div className="cal-day">{cell.dayNum}</div>
                                            <div className="cal-slots">
                                                {cell.items.map((item) => {
                                                    const selected = selectedKeys.has(item.key);
                                                    return (
                                                        <button
                                                            key={item.key}
                                                            type="button"
                                                            disabled={!item.valid}
                                                            title={item.valid ? (selected ? "Bấm để bỏ chọn" : "Bấm để chọn lại") : item.reason}
                                                            className={cx(
                                                                "cal-chip",
                                                                !item.valid && "cal-chip-bad",
                                                                item.valid && selected && "cal-chip-on",
                                                                item.valid && !selected && "cal-chip-off",
                                                            )}
                                                            onClick={() => toggleItem(item)}
                                                        >
                                                            <span>{item.slotLabel}</span>
                                                            <span className="cal-chip-room">{item.roomName}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ),
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="modal-actions -mx-6 mt-2 border-t border-border px-6 pt-4">
                        <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setStep(STEPS.FORM)}>
                            Quay lại
                        </button>
                        <button type="button" className="btn btn-primary" disabled={saving || selectedCount === 0} onClick={createSelected}>
                            {saving ? "Đang phân ca…" : "Phân ca"}
                        </button>
                    </div>
                </div>
            )}

            {step === STEPS.RESULT && (
                <div className="mt-5 flex flex-col gap-4">
                    <div className="rounded-md bg-success-soft px-4 py-3" role="status">
                        <p className="num font-semibold text-success">{resultData?.message ?? `Đã tạo ${resultData?.created ?? 0} ca`}</p>
                        {(resultData?.skippedRows?.length ?? 0) > 0 && (
                            <p className="num mt-0.5 text-body">Bỏ qua {resultData.skippedRows.length} ca.</p>
                        )}
                    </div>

                    <div className="field">
                        <span className="label">Ca bỏ qua</span>
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th scope="col">Ngày</th>
                                        <th scope="col">Ca</th>
                                        <th scope="col">Lý do</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(resultData?.skippedRows?.length ?? 0) === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="text-muted">
                                                Không có
                                            </td>
                                        </tr>
                                    ) : (
                                        resultData.skippedRows.map((row, index) => (
                                            <tr key={`${row.date}-${row.slot}-${index}`}>
                                                <td className="num">{formatDayMonth(row.date)}</td>
                                                <td>{row.slot}</td>
                                                <td>{row.reason}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="modal-actions -mx-6 mt-2 border-t border-border px-6 pt-4">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setResultData(null);
                                setStep(STEPS.FORM);
                            }}
                        >
                            Xếp tiếp
                        </button>
                        <button type="button" className="btn btn-primary" onClick={finish}>
                            Xong
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default MonthlyShiftPopup;

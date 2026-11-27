import { useState } from "react";
import { CalendarClock, CalendarX2, Clock, Info, Plus, X } from "lucide-react";
import { toast } from "react-toastify";
import Modal from "@/components/ui/Modal";
import { CHANGE_REQUEST_TYPE, sendChangeRequest } from "@/services/appointmentChangeRequestService";
import { cx } from "@/utils/cx";
import { getClinicToday } from "@/utils/format";

const REASONS = ["Bận việc", "Bị ốm", "Đi xa", "Lý do khác"];
// Clinic opening hours, for the time picker
const OPEN_FROM = "08:00";
const OPEN_TO = "17:00";
const MAX_WISHES = 3;

// "2026-12-07" + "09:30" -> "07/12 · 09:30"
const wishText = ({ date, time }) => `${date.slice(8, 10)}/${date.slice(5, 7)} · ${time}`;

// "Xin đổi lịch / Xin huỷ" for a visit the clinic arranged. visit: { title, dateText, timeText, doctorName, sourceText,
// appointmentId | treatmentPlanStageId, isSession }. type: CHANGE_REQUEST_TYPE (the patient can still switch).
// onSent() after the request is saved; the visit itself does not change until the front desk acts.
const ChangeRequestModal = ({ visit, type: initialType, onSent, onClose }) => {
    const [today] = useState(getClinicToday);
    const [type, setType] = useState(initialType);
    const [reason, setReason] = useState(REASONS[0]);
    const [otherReason, setOtherReason] = useState("");
    const [wishes, setWishes] = useState([]);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const reschedule = type === CHANGE_REQUEST_TYPE.RESCHEDULE;

    const send = async (event) => {
        event.preventDefault();
        const finalReason = reason === "Lý do khác" ? otherReason.trim() : reason;
        if (!finalReason) {
            setError("Nhập lý do của bạn.");
            return;
        }
        setBusy(true);
        const response = await sendChangeRequest({
            appointmentId: visit.appointmentId ?? null,
            treatmentPlanStageId: visit.appointmentId ? null : visit.treatmentPlanStageId,
            type,
            reason: finalReason,
            preferredTimes: reschedule ? wishes.filter((wish) => wish.date && wish.time).map(wishText) : [],
            note,
        });
        setBusy(false);
        if (!response.success) {
            setError(response.message);
            return;
        }
        toast.success(response.message);
        onSent();
    };

    const typeButton = (value, Icon, label, hint) => {
        const selected = type === value;
        return (
            <button
                type="button"
                aria-pressed={selected}
                onClick={() => setType(value)}
                className={cx(
                    "flex flex-1 items-start gap-3 rounded-lg border-2 p-3 text-left transition-colors",
                    selected ? (value === CHANGE_REQUEST_TYPE.CANCEL ? "border-danger-solid bg-danger-soft" : "border-primary bg-primary-softer") : "border-border hover:border-border-strong",
                )}
            >
                <span className={cx("grid size-9 shrink-0 place-items-center rounded-md", selected ? "bg-canvas" : "bg-surface-tint", value === CHANGE_REQUEST_TYPE.CANCEL ? "text-danger" : "text-primary")}>
                    <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                    <span className="block font-semibold text-ink">{label}</span>
                    <span className="block text-caption text-muted">{hint}</span>
                </span>
            </button>
        );
    };

    return (
        <Modal title="Gửi yêu cầu cho lễ tân" onClose={onClose} closeDisabled={busy}>
            <form noValidate onSubmit={send} className="mt-5 flex flex-col gap-5">
                <div className="flex gap-3 rounded-lg border border-border bg-surface-tint p-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-canvas text-primary">
                        <CalendarClock className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <p className="font-semibold text-ink">{visit.title}</p>
                        <p className="text-body-sm text-body">{[visit.dateText, visit.timeText, visit.doctorName].filter(Boolean).join(" · ")}</p>
                        {visit.sourceText && <p className="text-caption text-muted">{visit.sourceText}</p>}
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                    {typeButton(CHANGE_REQUEST_TYPE.RESCHEDULE, CalendarClock, "Xin đổi lịch", "Lễ tân gọi lại để chọn giờ khác")}
                    {typeButton(CHANGE_REQUEST_TYPE.CANCEL, CalendarX2, "Xin huỷ", visit.isSession ? "Buổi quay lại \"chưa có lịch\"" : "Lễ tân xác nhận trước khi huỷ")}
                </div>

                <fieldset className="field">
                    <legend className="label label-required">Lý do</legend>
                    <div className="flex flex-wrap gap-2">
                        {REASONS.map((item) => (
                            <button
                                key={item}
                                type="button"
                                aria-pressed={reason === item}
                                onClick={() => {
                                    setReason(item);
                                    setError(null);
                                }}
                                className={cx(
                                    "min-h-9 rounded-full border px-4 text-body-sm transition-colors",
                                    reason === item ? "border-primary bg-primary text-on-primary" : "border-border bg-canvas text-ink hover:border-primary hover:text-primary",
                                )}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                    {reason === "Lý do khác" && (
                        <input
                            className="input mt-2"
                            maxLength={200}
                            placeholder="Nhập lý do của bạn"
                            aria-label="Lý do khác"
                            value={otherReason}
                            onChange={(event) => {
                                setOtherReason(event.target.value);
                                setError(null);
                            }}
                        />
                    )}
                </fieldset>

                {reschedule && (
                    <div className="field">
                        <p className="label">
                            Ngày giờ bạn mong muốn <span className="font-normal text-muted">(không bắt buộc, tối đa {MAX_WISHES}, giờ làm việc {OPEN_FROM}–{OPEN_TO})</span>
                        </p>
                        <div className="flex flex-col gap-2">
                            {wishes.map((wish, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        className="input flex-1"
                                        min={today}
                                        aria-label={`Ngày mong muốn ${index + 1}`}
                                        value={wish.date}
                                        onChange={(event) => setWishes((current) => current.map((item, i) => (i === index ? { ...item, date: event.target.value } : item)))}
                                    />
                                    <input
                                        type="time"
                                        className="input w-32"
                                        min={OPEN_FROM}
                                        max={OPEN_TO}
                                        step={1800}
                                        aria-label={`Giờ mong muốn ${index + 1}`}
                                        value={wish.time}
                                        onChange={(event) => setWishes((current) => current.map((item, i) => (i === index ? { ...item, time: event.target.value } : item)))}
                                    />
                                    <button type="button" className="btn btn-icon" aria-label="Bỏ giờ này" onClick={() => setWishes((current) => current.filter((_, i) => i !== index))}>
                                        <X className="size-4" aria-hidden="true" />
                                    </button>
                                </div>
                            ))}
                            {wishes.length === 0 && <p className="flex items-center gap-2 text-caption text-muted"><Clock className="size-4" aria-hidden="true" />Chưa chọn, lễ tân sẽ hỏi khi gọi cho bạn.</p>}
                            {wishes.length < MAX_WISHES && (
                                <button type="button" className="btn btn-secondary self-start" onClick={() => setWishes((current) => [...current, { date: "", time: "09:00" }])}>
                                    <Plus className="size-4" aria-hidden="true" />
                                    Thêm ngày giờ mong muốn
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="field">
                    <label htmlFor="change-request-note" className="label">
                        Ghi chú cho lễ tân <span className="font-normal text-muted">(không bắt buộc)</span>
                    </label>
                    <textarea
                        id="change-request-note"
                        rows={2}
                        maxLength={500}
                        className="input h-auto min-h-16 py-2"
                        placeholder="Ví dụ: gọi sau 17h giúp tôi"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                    />
                </div>

                <p className="flex gap-2 rounded-md bg-primary-softer px-3 py-2.5 text-body-sm text-ink">
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                        Lịch <strong>vẫn giữ nguyên</strong> cho đến khi lễ tân gọi lại và xác nhận. Gấp thì gọi hotline.
                    </span>
                </p>

                {error && (
                    <p role="alert" className="error-text">
                        {error}
                    </p>
                )}

                <div className="modal-actions -mx-6 border-t border-border px-6 pt-4">
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
                        Đóng
                    </button>
                    <button type="submit" className={cx("btn", reschedule ? "btn-primary" : "btn-danger")} disabled={busy}>
                        {busy && <span className="btn-spinner" aria-hidden="true" />}
                        {reschedule ? "Gửi yêu cầu đổi lịch" : "Gửi yêu cầu huỷ"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ChangeRequestModal;

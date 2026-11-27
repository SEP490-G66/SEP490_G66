import { useEffect, useId, useState } from "react";
import { ScanLine, Scissors } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { getSurgeryDoctorsOnDuty } from "@/services/examinationService";
import { cx } from "@/utils/cx";
import { GENERIC_ERROR_MESSAGE } from "@/utils/messages";

const NOTE_MAX = 300;

const REFER_ROOM = { IMAGING: "imaging", SURGERY: "surgery" };

const ROOMS = [
    {
        value: REFER_ROOM.IMAGING,
        icon: ScanLine,
        title: "Phòng chụp chiếu",
        text: "Bệnh nhân sang hàng chờ chụp; ở hàng chờ của bạn vẫn còn với trạng thái “Chờ chụp chiếu” và quay lại khi có kết quả.",
    },
    {
        value: REFER_ROOM.SURGERY,
        icon: Scissors,
        title: "Phòng tiểu phẫu",
        text: "Chuyển hẳn bệnh nhân cùng lượt khám (chẩn đoán, kế hoạch) sang bác sĩ phòng tiểu phẫu; bệnh nhân rời hàng chờ của bạn.",
    },
];

// "Chỉ định chuyển phòng" (Figma). Chụp chiếu goes on to the X-ray order (onImaging); tiểu phẫu picks a doctor who has
// started a shift in that room and sends { surgeryDoctorId, note } to onSurgery.
const ReferRoomDialog = ({ patientName, busy = false, onImaging, onSurgery, onClose }) => {
    const noteId = useId();
    const [room, setRoom] = useState(REFER_ROOM.IMAGING);
    const [doctors, setDoctors] = useState({ loaded: false, list: [], failed: false });
    const [doctorId, setDoctorId] = useState(null);
    const [note, setNote] = useState("");
    const [error, setError] = useState(null);

    const wantsSurgery = room === REFER_ROOM.SURGERY;
    useEffect(() => {
        if (!wantsSurgery || doctors.loaded) return;
        getSurgeryDoctorsOnDuty().then((response) => {
            const list = response.success ? response.data : [];
            setDoctors({ loaded: true, list, failed: !response.success });
            // The only doctor who can take the patient is picked already
            const ready = list.filter((doctor) => doctor.started);
            if (ready.length === 1) setDoctorId(ready[0].doctorId);
        });
    }, [wantsSurgery, doctors.loaded]);

    const submit = (event) => {
        event.preventDefault();
        if (!wantsSurgery) {
            onImaging();
            return;
        }
        if (!doctorId) {
            setError("Chọn bác sĩ phòng tiểu phẫu nhận bệnh nhân.");
            return;
        }
        onSurgery({ surgeryDoctorId: doctorId, note });
    };

    return (
        <Modal title="Chỉ định chuyển phòng" description={patientName} onClose={onClose} closeDisabled={busy}>
            <form noValidate onSubmit={submit} className="mt-5 flex flex-col gap-4">
                <fieldset className="flex flex-col gap-2.5">
                    <legend className="label mb-1">Chuyển sang</legend>
                    {ROOMS.map((option) => {
                        const Icon = option.icon;
                        const selected = room === option.value;
                        return (
                            <label
                                key={option.value}
                                className={cx(
                                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
                                    selected ? "border-primary bg-primary-soft" : "border-border hover:border-primary",
                                )}
                            >
                                <input
                                    type="radio"
                                    name="refer-room"
                                    className="mt-1 size-4 accent-primary"
                                    checked={selected}
                                    onChange={() => {
                                        setRoom(option.value);
                                        setError(null);
                                    }}
                                />
                                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                                <span className="min-w-0">
                                    <span className="block font-semibold text-ink">{option.title}</span>
                                    <span className="block text-caption text-muted">{option.text}</span>
                                </span>
                            </label>
                        );
                    })}
                </fieldset>

                {wantsSurgery && (
                    <>
                        <fieldset className="flex flex-col gap-2">
                            <legend className="label label-required mb-1">Bác sĩ phòng tiểu phẫu</legend>
                            {!doctors.loaded && <div className="skeleton h-11" aria-hidden="true" />}
                            {doctors.failed && <p role="alert" className="error-text">{GENERIC_ERROR_MESSAGE}</p>}
                            {doctors.loaded && !doctors.failed && doctors.list.length === 0 && (
                                <p className="rounded-md bg-surface-tint px-3 py-2.5 text-body-sm text-muted">Hôm nay không có bác sĩ nào trực phòng tiểu phẫu.</p>
                            )}
                            {doctors.list.map((doctor) => (
                                <label
                                    key={doctor.doctorId}
                                    className={cx(
                                        "flex items-center gap-3 rounded-lg border px-3.5 py-2.5",
                                        doctor.started ? "cursor-pointer border-border hover:border-primary" : "cursor-not-allowed border-border bg-surface-muted opacity-70",
                                        doctorId === doctor.doctorId && "border-primary bg-primary-soft",
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="refer-doctor"
                                        className="size-4 accent-primary"
                                        disabled={!doctor.started}
                                        checked={doctorId === doctor.doctorId}
                                        onChange={() => {
                                            setDoctorId(doctor.doctorId);
                                            setError(null);
                                        }}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-medium text-ink">{doctor.name}</span>
                                        <span className="block text-caption text-muted">
                                            {doctor.roomName} · {doctor.started ? `${doctor.waitingCount} bệnh nhân đang chờ` : "chưa bắt đầu ca"}
                                        </span>
                                    </span>
                                </label>
                            ))}
                            {error && <p className="error-text">{error}</p>}
                        </fieldset>
                        <div className="field">
                            <label htmlFor={noteId} className="label">
                                Ghi chú cho bác sĩ tiểu phẫu
                            </label>
                            <textarea
                                id={noteId}
                                rows={2}
                                maxLength={NOTE_MAX}
                                className="input h-auto min-h-16 py-2"
                                placeholder="Ví dụ: Nhổ răng 38 mọc lệch theo kế hoạch"
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                            />
                        </div>
                    </>
                )}

                <div className="modal-actions -mx-6 mt-1 border-t border-border px-6 pt-4">
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
                        Huỷ
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy && <span className="btn-spinner" aria-hidden="true" />}
                        {wantsSurgery ? "Chuyển sang tiểu phẫu" : "Tiếp tục · chỉ định chụp"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ReferRoomDialog;

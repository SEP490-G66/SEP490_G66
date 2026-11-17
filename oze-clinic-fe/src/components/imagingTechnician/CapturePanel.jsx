import { useId } from "react";
import { Image as ImageIcon } from "lucide-react";
import FormField from "@/components/ui/FormField";
import StatusBadge from "@/components/ui/StatusBadge";
import { cx } from "@/utils/cx";
import { formatClock } from "@/utils/format";
import {
    CAPTURE_IMAGE_COUNT_MAX,
    CAPTURE_STATES,
    CAPTURE_STATE_LABELS,
    DEVICE_READY,
    EXPOSURE_PRESETS,
    deviceStateLabel,
    imagingTypeLabel,
    modalitiesText,
    suggestedExposure,
} from "@/utils/imagingRequest";

const deviceText = (devices, deviceId) => {
    const device = devices.find((item) => item.id === deviceId);
    return [deviceId, device?.name].filter(Boolean).join(" · ");
};

// "XR-IO-01 · Virtual Intraoral Digital Sensor 1 · Quanh chóp, Cắn cánh · Sẵn sàng", or "… · không chụp được loại này"
const deviceOption = (devices, device) =>
    [deviceText(devices, device.id), modalitiesText(device.supportedModalities), device.supported ? deviceStateLabel(device.state) : "không chụp được loại này"]
        .filter(Boolean)
        .join(" · ");

const outOfRange = (value, range) => value !== "" && value != null && range && (Number(value) < range.min || Number(value) > range.max);

// One exposure value with its suggestion and usual range under it ("Gợi ý 70 · thường 60–90"); warned when outside the range.
// range: { suggested, min, max } of EXPOSURE_PRESETS, or none for an order type without a preset.
const ExposureField = ({ id, label, unit, value, range, onChange }) => {
    const warn = outOfRange(value, range);
    return (
        <div className="field">
            <label htmlFor={id} className="label">
                {label}
            </label>
            <input
                id={id}
                type="number"
                min={0}
                step="any"
                className={cx("input num", warn && "border-warning-solid")}
                placeholder="Theo máy"
                value={value ?? ""}
                onChange={onChange}
                aria-describedby={range ? `${id}-hint` : undefined}
            />
            {range && (
                <p id={`${id}-hint`} className={cx("num text-caption", warn ? "text-warning" : "text-muted")}>
                    {warn ? "Ngoài khoảng thường dùng " : `Gợi ý ${range.suggested} ${unit} · thường `}
                    {range.min}–{range.max} {unit}
                </p>
            )}
        </div>
    );
};

// Settings before the shot: device, number of images, exposure (suggested for the order type, empty: the device uses
// its own values). devices: every device (GET api/imaging-devices), each with supported = takes this order type; only a
// supported, READY one takes the order. setup: { deviceId, imageCount, kv, ma, seconds }; onSetupChange receives the changed fields.
const SetupForm = ({ imagingType, devices, setup, onSetupChange, onStart, busy }) => {
    const id = useId();
    const selected = devices.find((device) => device.id === setup.deviceId);
    const ready = Boolean(selected?.supported && selected.state === DEVICE_READY);
    const number = (key) => (event) => onSetupChange({ [key]: event.target.value });
    const preset = EXPOSURE_PRESETS[imagingType];
    const anyOutOfRange = preset && ["kv", "ma", "seconds"].some((key) => outOfRange(setup[key], preset[key]));

    return (
        <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
                event.preventDefault();
                if (!busy && ready) onStart();
            }}
        >
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <FormField id={`${id}-device`} label="Máy chụp">
                    <select id={`${id}-device`} className="input" value={setup.deviceId ?? ""} onChange={(event) => onSetupChange({ deviceId: event.target.value })}>
                        {devices.map((device) => (
                            <option key={device.id} value={device.id} disabled={!device.supported}>
                                {deviceOption(devices, device)}
                            </option>
                        ))}
                    </select>
                </FormField>
                <FormField id={`${id}-count`} label="Số ảnh">
                    <input id={`${id}-count`} type="number" min={1} max={CAPTURE_IMAGE_COUNT_MAX} className="input num" value={setup.imageCount ?? 1} onChange={number("imageCount")} />
                </FormField>
            </div>
            <div className="grid items-start gap-4 sm:grid-cols-3">
                <ExposureField id={`${id}-kv`} label="Điện áp (kV)" unit="kV" value={setup.kv} range={preset?.kv} onChange={number("kv")} />
                <ExposureField id={`${id}-ma`} label="Dòng (mA)" unit="mA" value={setup.ma} range={preset?.ma} onChange={number("ma")} />
                <ExposureField id={`${id}-sec`} label="Thời gian phát tia (s)" unit="s" value={setup.seconds} range={preset?.seconds} onChange={number("seconds")} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-caption text-muted">
                    {preset
                        ? `Thông số gợi ý cho “${imagingTypeLabel(imagingType)}” ở người lớn (tham khảo, có thể sửa). Để trống thì máy dùng thông số mặc định của nó.`
                        : "Chưa có thông số gợi ý cho loại chụp này. Để trống thì máy dùng thông số mặc định của nó."}
                </p>
                {preset && (
                    <button type="button" className="btn btn-secondary" onClick={() => onSetupChange(suggestedExposure(imagingType))}>
                        Dùng thông số gợi ý
                    </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={busy || !ready}>
                    {busy && <span className="btn-spinner" aria-hidden />}
                    Bắt đầu chụp
                </button>
            </div>
            {selected && !ready && (
                <p role="status" className="text-caption text-warning">
                    Máy {selected.id} đang ở trạng thái “{deviceStateLabel(selected.state)}”, chưa nhận lệnh chụp. Chọn máy khác hoặc chờ máy sẵn sàng.
                </p>
            )}
            {anyOutOfRange && (
                <p role="status" className="text-caption text-warning">
                    Có thông số ngoài khoảng thường dùng. Kiểm tra lại trước khi chụp, hoặc bấm “Dùng thông số gợi ý”.
                </p>
            )}
        </form>
    );
};

// Images returned by the device; a click opens the viewer (onOpenImage(index)). images: [{ id, url?, takenAt? }].
const Thumbnails = ({ images, onOpenImage }) => (
    <ul className="flex flex-wrap gap-3">
        {images.map((image, index) => {
            const caption = [`Ảnh ${index + 1}`, image.takenAt && formatClock(image.takenAt)].filter(Boolean).join(" · ");
            return (
                <li key={image.id}>
                    <button
                        type="button"
                        className="relative grid h-26 w-40 cursor-zoom-in place-items-center overflow-hidden rounded-md bg-surface-navy outline-none focus-visible:shadow-focus"
                        aria-label={`Phóng to ${caption}`}
                        onClick={() => onOpenImage?.(index)}
                    >
                        {image.url ? (
                            <img src={image.url} alt="" className="size-full object-cover" />
                        ) : (
                            <ImageIcon className="size-6 text-on-navy/60" aria-hidden="true" />
                        )}
                        <span className="num absolute bottom-1.5 left-2 text-caption text-on-navy">{caption}</span>
                    </button>
                </li>
            );
        })}
    </ul>
);

const ManualUploadButton = ({ onManualUpload }) =>
    onManualUpload && (
        <button type="button" className="btn btn-secondary" onClick={onManualUpload}>
            Tải ảnh thủ công
        </button>
    );

// "Máy chụp" block of the capture screen, one look per CAPTURE_STATES value:
// ready (SetupForm) → capturing (wait, Huỷ chụp) → completed (thumbnails) or failed (Chụp lại / Tải ảnh thủ công);
// unsupported: the order type has no device (CBCT, Cephalometric…); unavailable: the device is off or busy.
// devices: every device, marked supported for this order type; session: { deviceId, imageCount, sentAt, finishedAt };
// message: the device error or reason. embedded: drawn inside the order card (a band, not a card of its own).
const CapturePanel = ({
    embedded = false,
    state,
    imagingType,
    devices = [],
    setup = {},
    onSetupChange,
    session = {},
    images = [],
    message,
    busy = false,
    onStart,
    onCancel,
    onRetry,
    onManualUpload,
    onOpenImage,
}) => {
    const device = deviceText(devices, session.deviceId ?? setup.deviceId);

    return (
        <section aria-label="Máy chụp" className={embedded ? "border-t border-border" : "card-app p-0"}>
            <div className={cx("flex items-center justify-between gap-3 px-5", embedded ? "pt-4" : "border-b border-border py-3.5")}>
                <h4 className="font-heading text-body-md font-semibold text-ink">Máy chụp</h4>
                <StatusBadge status={state} labels={CAPTURE_STATE_LABELS} />
            </div>
            <div className="flex flex-col gap-4 px-5 py-4" aria-live="polite">
                {state === CAPTURE_STATES.READY && (
                    <SetupForm imagingType={imagingType} devices={devices} setup={setup} onSetupChange={onSetupChange} onStart={onStart} busy={busy} />
                )}

                {state === CAPTURE_STATES.CAPTURING && (
                    <>
                        <p className="num text-caption text-muted">
                            {[device, session.imageCount && `${session.imageCount} ảnh`, session.sentAt && `gửi lệnh lúc ${formatClock(session.sentAt)}`].filter(Boolean).join(" · ")}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="min-w-0 flex-1">Đang chờ máy trả ảnh. Ảnh sẽ tự hiện ở đây khi máy chụp xong.</p>
                            {onCancel && (
                                <button type="button" className="btn btn-secondary text-danger hover:text-danger" disabled={busy} onClick={onCancel}>
                                    Huỷ chụp
                                </button>
                            )}
                        </div>
                    </>
                )}

                {state === CAPTURE_STATES.COMPLETED && (
                    <>
                        <div className="alert alert-success">
                            <div>
                                <p className="font-semibold">
                                    Máy đã trả về {images.length} ảnh{session.finishedAt && ` lúc ${formatClock(session.finishedAt)}`}
                                </p>
                                <p className="text-body">{device} · bấm vào ảnh để phóng to.</p>
                            </div>
                        </div>
                        <Thumbnails images={images} onOpenImage={onOpenImage} />
                        <p className="text-caption text-muted">Kiểm tra ảnh rồi bấm Hoàn thành để gửi kết quả cho bác sĩ.</p>
                    </>
                )}

                {state === CAPTURE_STATES.FAILED && (
                    <>
                        <div className="alert alert-danger">
                            <div>
                                <p className="font-semibold">Chưa nhận được ảnh từ máy</p>
                                <p className="text-body">{message || "Máy báo lỗi hoặc mất kết nối."} Chụp lại, hoặc chụp trực tiếp trên máy rồi tải ảnh thủ công.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="num min-w-0 flex-1 text-caption text-muted">{device}</p>
                            <ManualUploadButton onManualUpload={onManualUpload} />
                            {onRetry && (
                                <button type="button" className="btn btn-primary" disabled={busy} onClick={onRetry}>
                                    Chụp lại
                                </button>
                            )}
                        </div>
                    </>
                )}

                {state === CAPTURE_STATES.UNSUPPORTED && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="min-w-0 flex-1">
                            Chưa có máy kết nối cho loại chụp “{imagingTypeLabel(imagingType)}”. Chụp trên máy riêng rồi tải ảnh thủ công.
                        </p>
                        <ManualUploadButton onManualUpload={onManualUpload} />
                    </div>
                )}

                {state === CAPTURE_STATES.UNAVAILABLE && (
                    <>
                        <div className="alert alert-warning">
                            <div>
                                <p className="font-semibold">Máy {session.deviceId ?? setup.deviceId ?? ""} chưa sẵn sàng</p>
                                <p className="text-body">{message || "Máy đang tắt, đang khởi động hoặc đang chụp cho bệnh nhân khác."}</p>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <ManualUploadButton onManualUpload={onManualUpload} />
                        </div>
                    </>
                )}
            </div>
        </section>
    );
};

export default CapturePanel;
